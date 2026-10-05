const router = require('express').Router();
const { requireAuth, requirePermission } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const ctrl = require('../controllers/invoices.controller');

const schema = {
  client: { type: 'string', required: true, maxLen: 150 },
  dealId: { type: 'string', maxLen: 128 },
  amount: { type: 'number', required: true, min: 0 },
  status: { type: 'string', enum: ['draft', 'sent', 'paid', 'void', 'partial'], default: 'draft' },
  dueDate: { type: 'string', maxLen: 20 },
  businessId: { type: 'string', maxLen: 128 },
};

router.use(requireAuth);

// Per config/roles.js: ONLY Owner and Finance staff can touch invoices.
// This is the concrete rule from the brief — Manager gets general access
// everywhere else but explicitly NOT here, and it's enforced server-side
// so it can't be worked around by calling the API directly.
router.get('/', requirePermission('invoices', 'r'), ctrl.list);        // ?status=overdue to filter
router.post('/', requirePermission('invoices', 'w'), validateBody(schema), ctrl.create);
router.put('/:id', requirePermission('invoices', 'w'), validateBody(schema), ctrl.update);
router.delete('/:id', requirePermission('invoices', 'w'), ctrl.remove);

module.exports = router;
