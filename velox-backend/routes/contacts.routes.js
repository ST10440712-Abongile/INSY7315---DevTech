const router = require('express').Router();
const { requireAuth, requirePermission } = require('../middleware/auth');
const { validateBody, EMAIL_RE } = require('../middleware/validate');
const ctrl = require('../controllers/contacts.controller');

const schema = {
  name: { type: 'string', required: true, maxLen: 120 },
  org: { type: 'string', maxLen: 150 },
  email: { type: 'string', pattern: EMAIL_RE, maxLen: 150 },
  phone: { type: 'string', maxLen: 40 },
  title: { type: 'string', maxLen: 100 },
  notes: { type: 'string', maxLen: 2000 },
  businessId: { type: 'string', maxLen: 128 },
};

router.use(requireAuth); // every route below requires a valid Firebase session

// Per config/roles.js: Owner, Manager, Sales can read/write contacts.
// Finance staff has no access here at all (403, not just a hidden button).
router.get('/', requirePermission('contacts', 'r'), ctrl.list);
router.get('/:id', requirePermission('contacts', 'r'), ctrl.getOne);
router.post('/', requirePermission('contacts', 'w'), validateBody(schema), ctrl.create);
router.put('/:id', requirePermission('contacts', 'w'), validateBody(schema), ctrl.update);
router.delete('/:id', requirePermission('contacts', 'w'), ctrl.remove);

module.exports = router;
