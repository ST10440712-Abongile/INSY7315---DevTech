const FirestoreRepository = require('../repositories/FirestoreRepository');
const { assertOwner } = require('../middleware/auth');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const repo = new FirestoreRepository('contacts');
const dealsRepo = new FirestoreRepository('deals');

const list = asyncHandler(async (req, res) => {
  const contacts = await repo.findMany({
    filters: [['ownerUid', '==', req.user.tenantUid]],
    orderBy: { field: 'createdAt', direction: 'desc' },
  });
  res.status(200).json({ data: contacts });
});

const getOne = asyncHandler(async (req, res) => {
  const contact = await repo.findById(req.params.id);
  assertOwner(contact, req.user.tenantUid);
  res.status(200).json({ data: contact });
});

const create = asyncHandler(async (req, res) => {
  const contact = await repo.create({ ...req.validated, ownerUid: req.user.tenantUid });
  res.status(201).json({ data: contact });
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

  // Referential integrity rule (see models/DATA_MODEL.md): don't allow
  // deleting a contact that a deal still points to. Firestore itself
  // wouldn't stop this, so the API enforces it.
  const linkedDeals = await dealsRepo.findMany({
    filters: [['contactId', '==', req.params.id]],
    limit: 1,
  });
  if (linkedDeals.length) {
    throw AppError.conflict('This contact is linked to one or more pipeline deals. Unlink it first.');
  }

  await repo.delete(req.params.id);
  res.status(204).send();
});

module.exports = { list, getOne, create, update, remove };
