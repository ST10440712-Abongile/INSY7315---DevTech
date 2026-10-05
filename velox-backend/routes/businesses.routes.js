const router = require('express').Router();
const { requireAuth, requirePermission } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const ctrl = require('../controllers/businesses.controller');

const schema = {
  name: { type: 'string', required: true, maxLen: 150 },
  type: { type: 'string', enum: ['company', 'sole-prop', 'ngo', 'other'], default: 'company' },
  reg: { type: 'string', maxLen: 60 },
  color: { type: 'string', maxLen: 20 },
  address: { type: 'string', maxLen: 200 },
  vat: { type: 'boolean' },
};

router.use(requireAuth); // every route below requires a valid session

// Per config/roles.js: everyone can read which business(es) they're part
// of (needed context for every other panel), but only Owner/Manager can
// create, edit, or delete a business entity.
router.get('/', requirePermission('businesses', 'r'), ctrl.list);
router.post('/', requirePermission('businesses', 'w'), validateBody(schema), ctrl.create);
router.put('/:id', requirePermission('businesses', 'w'), validateBody(schema), ctrl.update);
router.delete('/:id', requirePermission('businesses', 'w'), ctrl.remove);

module.exports = router;
