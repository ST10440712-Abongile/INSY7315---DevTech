const { db, admin } = require('../config/firebase');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES, canAssignRole } = require('../config/roles');

// List everyone on the signed-in user's tenant (their own business account),
// including pending invites that haven't been accepted yet.
const list = asyncHandler(async (req, res) => {
  const { tenantUid } = req.user;

  const membersSnap = await db.collection('users').where('tenantUid', '==', tenantUid).get();
  const members = membersSnap.docs.map((d) => {
    const { uid, email, role, createdAt } = d.data();
    return { uid, email, role, status: 'active', createdAt };
  });

  const invitesSnap = await db
    .collection('invites')
    .where('tenantUid', '==', tenantUid)
    .where('consumed', '==', false)
    .get();
  const pending = invitesSnap.docs.map((d) => {
    const { email, role, createdAt } = d.data();
    return { uid: null, email, role, status: 'pending', createdAt };
  });

  res.status(200).json({ data: [...members, ...pending] });
});

// Invite a teammate by email with a given role. If they already have an
// account, this does NOT retroactively move their existing data — it just
// grants access going forward the next time they log in under this
// invite. (Keeping onboarding simple: one tenant per email at a time.)
const invite = asyncHandler(async (req, res) => {
  const { tenantUid, role: actingRole, uid: invitedBy } = req.user;
  const { email, role } = req.validated;

  if (!canAssignRole(actingRole, role)) {
    throw AppError.forbidden(`Your role cannot assign the "${role}" role.`);
  }

  const normalizedEmail = email.toLowerCase();

  // Don't double-invite the same still-pending email to the same tenant.
  const existing = await db
    .collection('invites')
    .where('tenantUid', '==', tenantUid)
    .where('email', '==', normalizedEmail)
    .where('consumed', '==', false)
    .limit(1)
    .get();
  if (!existing.empty) {
    throw AppError.conflict('There is already a pending invite for this email.');
  }

  const ref = await db.collection('invites').add({
    tenantUid,
    email: normalizedEmail,
    role,
    invitedBy,
    consumed: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  res.status(201).json({ data: { id: ref.id, email: normalizedEmail, role, status: 'pending' } });
});

// Change an existing team member's role.
const updateRole = asyncHandler(async (req, res) => {
  const { tenantUid, role: actingRole } = req.user;
  const { role: newRole } = req.validated;
  const targetUid = req.params.uid;

  const targetRef = db.collection('users').doc(targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists || targetSnap.data().tenantUid !== tenantUid) {
    throw AppError.notFound('Team member not found.');
  }
  const target = targetSnap.data();

  if (!canAssignRole(actingRole, newRole)) {
    throw AppError.forbidden(`Your role cannot assign the "${newRole}" role.`);
  }
  if (target.role === 'owner' && actingRole !== 'owner') {
    throw AppError.forbidden('Only the Owner can change the Owner\'s role.');
  }

  await targetRef.update({ role: newRole });
  res.status(200).json({ data: { uid: targetUid, role: newRole } });
});

// Remove a team member's access to this tenant (they keep their Firebase
// account; they just lose access — their profile is reset to being the
// owner of their own, empty tenant, same as a brand-new signup).
const remove = asyncHandler(async (req, res) => {
  const { tenantUid, role: actingRole, uid: actingUid } = req.user;
  const targetUid = req.params.uid;

  if (targetUid === actingUid) {
    throw AppError.badRequest('You cannot remove yourself from the team.');
  }

  const targetRef = db.collection('users').doc(targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists || targetSnap.data().tenantUid !== tenantUid) {
    throw AppError.notFound('Team member not found.');
  }
  if (targetSnap.data().role === 'owner') {
    throw AppError.forbidden('The Owner cannot be removed.');
  }
  if (actingRole !== 'owner' && targetSnap.data().role === 'manager') {
    throw AppError.forbidden('Only the Owner can remove a Manager.');
  }

  await targetRef.update({ tenantUid: targetUid, role: 'owner' }); // demoted back to their own, empty tenant
  res.status(204).send();
});

module.exports = { list, invite, updateRole, remove, ROLES };
