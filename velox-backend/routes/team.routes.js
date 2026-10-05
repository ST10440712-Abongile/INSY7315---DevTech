const router = require('express').Router();
const { requireAuth, requirePermission } = require('../middleware/auth');
const { validateBody, EMAIL_RE } = require('../middleware/validate');
const { ROLES } = require('../config/roles');
const ctrl = require('../controllers/team.controller');

const inviteSchema = {
  email: { type: 'string', required: true, pattern: EMAIL_RE, maxLen: 150 },
  role: { type: 'string', required: true, enum: ROLES },
};
const roleSchema = {
  role: { type: 'string', required: true, enum: ROLES },
};

router.use(requireAuth);

// Every team route requires 'team':'w' permission — per config/roles.js,
// that's Owner and Manager only (Finance/Sales get no team access at all).
router.get('/', requirePermission('team', 'r'), ctrl.list);
router.post('/invite', requirePermission('team', 'w'), validateBody(inviteSchema), ctrl.invite);
router.put('/:uid/role', requirePermission('team', 'w'), validateBody(roleSchema), ctrl.updateRole);
router.delete('/:uid', requirePermission('team', 'w'), ctrl.remove);

module.exports = router;
