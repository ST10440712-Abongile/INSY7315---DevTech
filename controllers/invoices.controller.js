const FirestoreRepository = require('../repositories/FirestoreRepository');
const { assertOwner } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const repo = new FirestoreRepository('invoices');

const list = asyncHandler(async (req, res) => {
  const filters = [['ownerUid', '==', req.user.tenantUid]];
  if (req.query.status) filters.push(['status', '==', req.query.status]);

  const invoices = await repo.findMany({
    filters,
    orderBy: { field: 'dueDate', direction: 'asc' },
  });
  res.status(200).json({ data: invoices });
});

const create = asyncHandler(async (req, res) => {
  const invoice = await repo.create({ ...req.validated, ownerUid: req.user.tenantUid });
  res.status(201).json({ data: invoice });
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
  await repo.delete(req.params.id);
  res.status(204).send();
});

module.exports = { list, create, update, remove };
