const { db, admin } = require('../config/firebase');
const asyncHandler = require('../utils/asyncHandler');

// Called once by the frontend right after a successful Firebase sign-in or
// registration. Firebase Auth already created the *account*; this creates
// the matching Firestore *profile document* the rest of the app reads from
// (idempotent — safe to call every login, it won't duplicate or overwrite
// existing data beyond touching lastLoginAt).
//
// Role/tenant assignment, on first bootstrap only:
//   1. If an Owner/Manager already invited this email (a doc in `invites`
//      with matching email and consumed:false), this user joins that
//      tenant with the invited role, and the invite is marked consumed.
//   2. Otherwise, this is a brand-new business account: the user becomes
//      the Owner of their own tenant (tenantUid = their own uid).
const bootstrapProfile = asyncHandler(async (req, res) => {
  const { uid, email } = req.user;
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    let tenantUid = uid;
    let role = 'owner';
    let invitedBy = null;

    if (email) {
      const inviteQuery = await db
        .collection('invites')
        .where('email', '==', email.toLowerCase())
        .where('consumed', '==', false)
        .limit(1)
        .get();

      if (!inviteQuery.empty) {
        const inviteDoc = inviteQuery.docs[0];
        const invite = inviteDoc.data();
        tenantUid = invite.tenantUid;
        role = invite.role;
        invitedBy = invite.invitedBy;
        await inviteDoc.ref.update({ consumed: true, consumedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }

    await ref.set({
      uid,
      email,
      tenantUid,
      role,
      invitedBy,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await ref.update({ lastLoginAt: admin.firestore.FieldValue.serverTimestamp() });
  }

  const finalSnap = await ref.get();
  res.status(200).json({ data: finalSnap.data() });
});

module.exports = { bootstrapProfile };
