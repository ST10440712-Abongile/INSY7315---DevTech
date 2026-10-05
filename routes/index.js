const router = require('express').Router();

// One mount point per resource — keeps app.js clean and makes the whole
// API surface readable at a glance from this single file.
router.use('/auth', require('./auth.routes'));
router.use('/businesses', require('./businesses.routes'));
router.use('/contacts', require('./contacts.routes'));
router.use('/deals', require('./deals.routes'));
router.use('/invoices', require('./invoices.routes'));
router.use('/team', require('./team.routes'));

module.exports = router;
