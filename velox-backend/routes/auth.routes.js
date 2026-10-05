const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { bootstrapProfile } = require('../controllers/auth.controller');

// POST /api/auth/bootstrap — call right after Firebase sign-in/register
router.post('/bootstrap', requireAuth, bootstrapProfile);

module.exports = router;
