const FirestoreRepository = require('../repositories/FirestoreRepository');
const { assertOwner } = require('../middleware/auth');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const repo = new FirestoreRepository('businesses');

const list = asyncHandler(async (req, res) => {
  const businesses = await repo.findMany({
    filters: [['ownerUid', '==', req.user.tenantUid]],
    orderBy: { field: 'createdAt', direction: 'desc' },
  });
  res.status(200).json({ data: businesses });
});

const create = asyncHandler(async (req, res) => {
  const biz = await repo.create({ ...req.validated, ownerUid: req.user.tenantUid });
  res.status(201).json({ data: biz });
});

const update = asyncHandler(async (req, res) => {
  const existing = await repo.findById(req.params.id);
  assertOwner(existing, req.user.tenantUid);
  const updated = await repo.update(req.params.id, req.validated);
  res.status(200).json({ data: updated });
});

const remove = asyncHandler(async (req, res) => {
  const existing = await repo.findById(req.params.id);
  assertOwner(existing, req.user.tenantUid);

  // Business rule: don't allow deleting a business that still has
  // contacts or deals under it — surface a clear 409 instead of
  // silently orphaning child records.
  const FirestoreRepositoryForDeals = new FirestoreRepository('deals');
  const linkedDeals = await FirestoreRepositoryForDeals.findMany({
    filters: [['businessId', '==', req.params.id]],
    limit: 1,
  });
  if (linkedDeals.length) {
    throw AppError.conflict('Cannot delete a business that still has pipeline deals linked to it.');
  }

  await repo.delete(req.params.id);
  res.status(204).send();
});

module.exports = { list, create, update, remove };
