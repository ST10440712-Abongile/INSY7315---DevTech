// ═══════════════════════════════════════════════════════════════════════
// Role-Based Access Control — single source of truth.
//
// A "tenant" is one business account (created by its Owner/CEO). Every
// team member operates *under* a tenant with one role. Permissions are
// per-resource, as 'r' (read), 'w' (read+write), or absent (no access).
// Routes enforce this with requirePermission() below — the frontend may
// also hide buttons for a cleaner UX, but the real gate is here, on the
// server, where it can't be bypassed by calling the API directly.
// ═══════════════════════════════════════════════════════════════════════

const ROLES = ['owner', 'manager', 'finance', 'sales'];

const PERMISSIONS = {
  // Owner/CEO — full access to everything, including team management.
  owner: {
    businesses: 'w', contacts: 'w', deals: 'w', invoices: 'w', proposals: 'w', team: 'w',
  },
  // Manager — general day-to-day access, explicitly excluding Finance & Billing.
  manager: {
    businesses: 'w', contacts: 'w', deals: 'w', invoices: 'none', proposals: 'w', team: 'w',
  },
  // Finance staff — scoped to Finance & Billing only.
  finance: {
    businesses: 'r', contacts: 'none', deals: 'none', invoices: 'w', proposals: 'none', team: 'none',
  },
  // Sales/Pipeline staff — scoped to pipeline, contacts, and proposals.
  sales: {
    businesses: 'r', contacts: 'w', deals: 'w', invoices: 'none', proposals: 'w', team: 'none',
  },
};

// Only Owner or Manager may invite teammates or change roles — and only
// an Owner may grant/revoke the Owner role itself (a Manager can't
// promote themselves or anyone else to Owner).
function canManageTeam(role) {
  return PERMISSIONS[role]?.team === 'w';
}
function canAssignRole(actingRole, targetRole) {
  if (!canManageTeam(actingRole)) return false;
  if (targetRole === 'owner' && actingRole !== 'owner') return false;
  return ROLES.includes(targetRole);
}

function hasPermission(role, resource, action) {
  const level = PERMISSIONS[role]?.[resource] || 'none';
  if (level === 'none') return false;
  if (action === 'r') return level === 'r' || level === 'w';
  if (action === 'w') return level === 'w';
  return false;
}

module.exports = { ROLES, PERMISSIONS, hasPermission, canManageTeam, canAssignRole };
