const { auth, db } = require('../config/firebase');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { hasPermission } = require('../config/roles');

// ── Authentication ──────────────────────────────────────────────────────
// The frontend signs in with the Firebase client SDK, gets a short-lived
// ID token (JWT) from Firebase, and sends it as:
//   Authorization: Bearer <token>
// This middleware verifies that token's signature and expiry *server-side*
// with Firebase's own public keys — this is real authentication, unlike
// the old localStorage-only gate. A forged or expired token is rejected.
//
// It then loads the user's Firestore profile to find out which *tenant*
// (business account) they operate under and what *role* they hold there —
// both are required for every authorization check downstream. A user with
// no profile yet (very first request after signup, before /auth/bootstrap
// has run) is let through with tenantUid/role left null; only the
// bootstrap route itself should ever see that state.
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw AppError.unauthorized('Missing Authorization header');
  }

  let decoded;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch (err) {
    throw AppError.unauthorized('Invalid or expired session — please sign in again');
  }

  const profileSnap = await db.collection('users').doc(decoded.uid).get();
  const profile = profileSnap.exists ? profileSnap.data() : null;

  req.user = {
    uid: decoded.uid,
    email: decoded.email || null,
    tenantUid: profile?.tenantUid || null, // which business account this user's data belongs to
    role: profile?.role || null,           // this user's role under that tenant
  };
  next();
});

// ── Authorization: ownership ────────────────────────────────────────────
// Confirms the record being acted on belongs to the signed-in user's
// tenant (business account), not just that *some* user is signed in.
function assertOwner(doc, tenantUid) {
  if (!doc) throw AppError.notFound();
  if (doc.ownerUid !== tenantUid) throw AppError.forbidden();
}

// ── Authorization: role-based permissions ───────────────────────────────
// Call after requireAuth, before the controller. Rejects with 403 if the
// signed-in user's role doesn't carry the required permission level
// ('r' or 'w') on the given resource. This is the server-side enforcement
// of the role matrix in config/roles.js — the real gate, independent of
// whatever the frontend chooses to show or hide.
function requirePermission(resource, action) {
  return (req, res, next) => {
    if (!req.user.tenantUid || !req.user.role) {
      throw AppError.forbidden('Your account has not finished setup — please sign in again.');
    }
    if (!hasPermission(req.user.role, resource, action)) {
      throw AppError.forbidden(`Your role (${req.user.role}) does not have access to ${resource}.`);
    }
    next();
  };
}

module.exports = { requireAuth, assertOwner, requirePermission };
