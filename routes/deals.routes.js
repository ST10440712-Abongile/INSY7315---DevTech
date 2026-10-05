const router = require('express').Router();
const { requireAuth, requirePermission } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const ctrl = require('../controllers/deals.controller');

const schema = {
  client: { type: 'string', required: true, maxLen: 150 },
  title: { type: 'string', required: true, maxLen: 200 },
  contact: { type: 'string', maxLen: 200 },         // free-text contact/email, kept for backward-compat
  contactId: { type: 'string', maxLen: 128 },        // the real FK -> contacts.id
  sector: { type: 'string', enum: ['gov', 'soe', 'ngo', 'edu', 'private', 'professional'], default: 'gov' },
  type: { type: 'string', maxLen: 60, default: 'Training' },
  stage: { type: 'string', enum: ['lead', 'proposal', 'po', 'active', 'done', 'lost'], default: 'lead' },
  value: { type: 'number', min: 0, default: 0 },
  prob: { type: 'number', min: 0, max: 100, default: 25 },
  close: { type: 'string', maxLen: 20 },
  notes: { type: 'string', maxLen: 2000 },
  businessId: { type: 'string', maxLen: 128 },
};

router.use(requireAuth);

// Per config/roles.js: Owner, Manager, Sales can read/write deals.
// Finance staff has no access here (scoped to Finance & Billing only).
router.get('/', requirePermission('deals', 'r'), ctrl.list);
router.get('/:id/contact', requirePermission('deals', 'r'), ctrl.getLinkedContact);
router.post('/', requirePermission('deals', 'w'), validateBody(schema), ctrl.create);
router.put('/:id', requirePermission('deals', 'w'), validateBody(schema), ctrl.update);
router.delete('/:id', requirePermission('deals', 'w'), ctrl.remove);

module.exports = router;
