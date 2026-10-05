const FirestoreRepository = require('../repositories/FirestoreRepository');
const { assertOwner } = require('../middleware/auth');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const repo = new FirestoreRepository('deals');
const contactsRepo = new FirestoreRepository('contacts');

// Business rule: a deal may only link to a contact that (a) exists and
// (b) belongs to the same user. This is exactly the integrity check that
// used to live only in the frontend's findContactForDeal() — now it's
// enforced server-side too, so it can't be bypassed by calling the API
// directly.
async function assertContactOwnership(contactId, ownerUid) {
  if (!contactId) return; // linking is optional
  const contact = await contactsRepo.findById(contactId);
  if (!contact || contact.ownerUid !== ownerUid) {
    throw AppError.badRequest('contactId does not refer to a contact you own.', 'INVALID_REFERENCE');
  }
}

const list = asyncHandler(async (req, res) => {
  const filters = [['ownerUid', '==', req.user.tenantUid]];
  if (req.query.stage) filters.push(['stage', '==', req.query.stage]);

  const deals = await repo.findMany({
    filters,
    orderBy: { field: 'createdAt', direction: 'desc' },
  });
  res.status(200).json({ data: deals });
});

const create = asyncHandler(async (req, res) => {
  await assertContactOwnership(req.validated.contactId, req.user.tenantUid);
  const deal = await repo.create({ ...req.validated, ownerUid: req.user.tenantUid });
  res.status(201).json({ data: deal });
});

const update = asyncHandler(async (req, res) => {
  const existing = await repo.findById(req.params.id);
  assertOwner(existing, req.user.tenantUid);
  await assertContactOwnership(req.validated.contactId, req.user.tenantUid);
  const updated = await repo.update(req.params.id, req.validated);
  res.status(200).json({ data: updated });
});

const remove = asyncHandler(async (req, res) => {
  const existing = await repo.findById(req.params.id);
  assertOwner(existing, req.user.tenantUid);
  await repo.delete(req.params.id);
  res.status(204).send();
});

// GET /deals/:id/contact — resolves and returns the linked contact in one
// call, mirroring the old frontend's findContactForDeal() but trustworthy,
// since it re-verifies ownership server-side rather than trusting the
// client's local DB.
const getLinkedContact = asyncHandler(async (req, res) => {
  const deal = await repo.findById(req.params.id);
  assertOwner(deal, req.user.tenantUid);
  if (!deal.contactId) return res.status(200).json({ data: null });

  const contact = await contactsRepo.findById(deal.contactId);
  if (!contact || contact.ownerUid !== req.user.tenantUid) {
    return res.status(200).json({ data: null }); // stale/broken link — fail soft
  }
  res.status(200).json({ data: contact });
});

module.exports = { list, create, update, remove, getLinkedContact };
