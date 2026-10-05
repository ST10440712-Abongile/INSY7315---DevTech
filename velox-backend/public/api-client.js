// ═══════════════════════════════════════════════════════════════════════
// Velox API Client — drop this into your HTML app to replace the old
// localStorage-only auth and give Pipeline/Contacts/Billing/Businesses
// real server-backed storage.
//
// SETUP IN YOUR HTML FILE:
//   1. Add before this script:
//        <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
//        <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
//   2. Fill in FIREBASE_CONFIG and API_BASE_URL below.
//   3. Include this file: <script src="api-client.js"></script>
// ═══════════════════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey: 'YOUR_FIREBASE_API_KEY',             // PLACEHOLDER — Firebase Console > Project Settings > General > Web app config
  authDomain: 'YOUR_PROJECT.firebaseapp.com',  // PLACEHOLDER
  projectId: 'YOUR_PROJECT_ID',                // PLACEHOLDER
};
// PLACEHOLDER — swap for the live API URL once hosted, e.g.:
//   'https://velox-api.onrender.com/api'
const API_BASE_URL = 'http://localhost:4000/api';

firebase.initializeApp(FIREBASE_CONFIG);
const fbAuth = firebase.auth();

// ── Low-level request helper ──────────────────────────────────────────
// Attaches the current user's Firebase ID token (a short-lived JWT) to
// every request, so the backend's requireAuth middleware can verify who's
// calling without the client ever handling or storing a password itself.
async function apiRequest(path, { method = 'GET', body } = {}) {
  const user = fbAuth.currentUser;
  const headers = { 'Content-Type': 'application/json' };
  if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null; // no content (successful delete)
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || `Request failed (${res.status})`);
  }
  return json.data;
}

// ── Auth ───────────────────────────────────────────────────────────────
const VeloxAuth = {
  async register(email, password) {
    const cred = await fbAuth.createUserWithEmailAndPassword(email, password);
    await apiRequest('/auth/bootstrap', { method: 'POST' }); // creates the Firestore profile doc
    return cred.user;
  },
  async login(email, password) {
    const cred = await fbAuth.signInWithEmailAndPassword(email, password);
    await apiRequest('/auth/bootstrap', { method: 'POST' });
    return cred.user;
  },
  logout() {
    return fbAuth.signOut();
  },
  onChange(callback) {
    return fbAuth.onAuthStateChanged(callback);
  },
  currentUser() {
    return fbAuth.currentUser;
  },
};

// ── Resource clients — thin, uniform wrappers over the REST endpoints ──
const VeloxContacts = {
  list: () => apiRequest('/contacts'),
  get: (id) => apiRequest(`/contacts/${id}`),
  create: (data) => apiRequest('/contacts', { method: 'POST', body: data }),
  update: (id, data) => apiRequest(`/contacts/${id}`, { method: 'PUT', body: data }),
  remove: (id) => apiRequest(`/contacts/${id}`, { method: 'DELETE' }),
};

const VeloxDeals = {
  list: (stage) => apiRequest(stage ? `/deals?stage=${encodeURIComponent(stage)}` : '/deals'),
  create: (data) => apiRequest('/deals', { method: 'POST', body: data }),
  update: (id, data) => apiRequest(`/deals/${id}`, { method: 'PUT', body: data }),
  remove: (id) => apiRequest(`/deals/${id}`, { method: 'DELETE' }),
  getLinkedContact: (id) => apiRequest(`/deals/${id}/contact`), // server-verified, replaces client-side findContactForDeal()
};

const VeloxInvoices = {
  list: (status) => apiRequest(status ? `/invoices?status=${encodeURIComponent(status)}` : '/invoices'),
  create: (data) => apiRequest('/invoices', { method: 'POST', body: data }),
  update: (id, data) => apiRequest(`/invoices/${id}`, { method: 'PUT', body: data }),
  remove: (id) => apiRequest(`/invoices/${id}`, { method: 'DELETE' }),
};

const VeloxBusinesses = {
  list: () => apiRequest('/businesses'),
  create: (data) => apiRequest('/businesses', { method: 'POST', body: data }),
  update: (id, data) => apiRequest(`/businesses/${id}`, { method: 'PUT', body: data }),
  remove: (id) => apiRequest(`/businesses/${id}`, { method: 'DELETE' }),
};

// Team/role management — only Owner and Manager will get a 2xx from
// invite/updateRole/remove; everyone else gets a clear 403 from the API.
const VeloxTeam = {
  list: () => apiRequest('/team'),
  invite: (email, role) => apiRequest('/team/invite', { method: 'POST', body: { email, role } }),
  updateRole: (uid, role) => apiRequest(`/team/${uid}/role`, { method: 'PUT', body: { role } }),
  remove: (uid) => apiRequest(`/team/${uid}`, { method: 'DELETE' }),
};

// Call after login to know what to show in the UI — e.g. hide the
// Finance & Billing menu tile entirely for a Sales role. This is a UX
// nicety only; the real enforcement already happened on the server.
function canSeeInApp(role, resource) {
  const map = {
    owner:   ['businesses', 'contacts', 'deals', 'invoices', 'proposals', 'team'],
    manager: ['businesses', 'contacts', 'deals', 'proposals', 'team'],
    finance: ['businesses', 'invoices'],
    sales:   ['businesses', 'contacts', 'deals', 'proposals'],
  };
  return (map[role] || []).includes(resource);
}
