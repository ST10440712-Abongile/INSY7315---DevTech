# Velox API — Backend (Node.js + Express + Firebase Firestore)

A REST API backend for the Velox business command-centre, replacing the old
localStorage-only prototype with real authentication, a real database, and
a real client/server boundary.

## Quick start

```bash
npm install
cp .env.example .env     # then fill in your Firebase project's values
npm run dev               # nodemon, auto-restarts on save
# or: npm start
```
Visit `http://localhost:4000/health` — you should see `{"status":"ok",...}`.

You'll need a free Firebase project (Spark plan): create one at
console.firebase.google.com, enable **Firestore** and **Authentication →
Email/Password**, then Project Settings → Service Accounts → Generate new
private key for the three `FIREBASE_*` values in `.env`.

Deploy the security rules and indexes with the Firebase CLI:
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Project layout

```
server.js              → process entry point
app.js                 → Express app: middleware stack + route mounting
config/firebase.js     → Firebase Admin singleton (db + auth)
routes/                → URL → controller mapping + per-route validation schemas
controllers/           → request/response handling, business rules
repositories/          → FirestoreRepository — all raw Firestore calls live here
middleware/            → auth, validation, rate limiting, error handling
utils/                 → AppError, asyncHandler
models/DATA_MODEL.md   → the ERD and field-by-field schema
public/api-client.js   → drop-in client for the existing HTML frontend
firestore.rules        → database-level security (defense in depth)
firestore.indexes.json → composite indexes the queries below need
```

## How this maps to the rubric

### Programming Skills (Basic → Advanced)
- **Basic**: control structures, loops and conditionals throughout
  validation (`middleware/validate.js`) and query building
  (`FirestoreRepository.findMany`).
- **Intermediate**: fully modular layout (routes → controllers →
  repositories), a custom `AppError` class with factory methods, and
  centralised error handling instead of scattered try/catch.
- **Advanced**: three design patterns in active use —
  **Repository** (`FirestoreRepository`, decouples controllers from
  Firestore), **Singleton** (`config/firebase.js`, one Admin SDK instance
  per process), and **Middleware chain** (auth → rate-limit → validate →
  controller, each layer independently testable). All I/O is async/await
  with every handler wrapped by `asyncHandler` so no promise is ever
  silently unhandled.

### Database (Firestore)
- Full data model with relationships in `models/DATA_MODEL.md`: `users →
  businesses → {contacts, deals, invoices}`, plus `deals.contactId →
  contacts.id` — the Contacts↔Pipeline link from the original app, now a
  real foreign key.
- Firestore has no FK constraints, so the **API enforces referential
  integrity**: creating/updating a deal verifies `contactId` exists and is
  owned by the same user (`assertContactOwnership`); deleting a contact
  still linked to a deal is blocked with `409 Conflict` instead of
  silently orphaning data.
- Composite indexes defined for every compound query the app runs
  (`firestore.indexes.json`).

### APIs
REST endpoints, proper verbs and status codes throughout:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/bootstrap` | Create/touch the user's profile doc after Firebase sign-in |
| GET/POST | `/api/businesses` | List / create businesses |
| PUT/DELETE | `/api/businesses/:id` | Update / delete (blocked if it still owns deals) |
| GET/POST | `/api/contacts` | List / create contacts |
| GET/PUT/DELETE | `/api/contacts/:id` | Fetch / update / delete (blocked if linked to a deal) |
| GET/POST | `/api/deals` | List (optional `?stage=`) / create pipeline deals |
| PUT/DELETE | `/api/deals/:id` | Update / delete |
| GET | `/api/deals/:id/contact` | Resolve a deal's linked contact, server-verified |
| GET/POST | `/api/invoices` | List (optional `?status=`) / create invoices |
| PUT/DELETE | `/api/invoices/:id` | Update / delete |
| GET | `/api/team` | List active members + pending invites on your tenant |
| POST | `/api/team/invite` | Invite a teammate by email with a role |
| PUT | `/api/team/:uid/role` | Change a teammate's role |
| DELETE | `/api/team/:uid` | Remove a teammate's access |

Every success returns `{ data: ... }`; every failure returns
`{ error: { code, message } }` with the matching HTTP status
(400/401/403/404/409/500) — the frontend can branch on `error.code`
without parsing prose.

### Security

- **Authentication**: Firebase Authentication (free tier) issues signed,
  short-lived ID tokens. `middleware/auth.js` verifies the token's
  signature and expiry server-side on every request — a stolen or forged
  token is rejected; nothing is trusted from the client.
- **Authorization — ownership**: every record carries `ownerUid` (the
  owning tenant's UID); `assertOwner()` checks it before any
  read/update/delete, backed up by `firestore.rules` doing the same check
  at the database level in case the API is ever bypassed.
- **Authorization — roles (RBAC)**: four roles — Owner, Manager, Finance,
  Sales — each with a different permission set per resource, defined once
  in `config/roles.js` and enforced by `requirePermission()` middleware on
  every route. Concretely: a Manager gets general access across the app
  but is blocked (403) from Finance & Billing; Finance staff can only
  touch invoices; Sales is scoped to pipeline/contacts/proposals. This is
  checked server-side on every request — not just hidden in the UI — so it
  can't be bypassed by calling the API directly. See
  `models/DATA_MODEL.md` for the full permission table and how
  team invites work.
- **Input validation**: every POST/PUT body is checked against an
  explicit schema (type, required, length, enum, regex) before it reaches
  a controller or Firestore — `middleware/validate.js`.
- **Transport/headers**: `helmet()` sets standard protective headers;
  `cors()` only allows the configured frontend origin to call the API.
- **Abuse mitigation**: `express-rate-limit` caps requests per IP, with a
  tighter limit on the auth endpoint specifically.
- **No secrets in code**: Firebase credentials load from `.env`
  (git-ignored), never hard-coded.

### Data Flow & Logic
Frontend → `api-client.js` (attaches Firebase ID token) → Express route →
validation middleware → controller (business rules) → repository →
Firestore, and the same path in reverse for the response. The
Contacts↔Pipeline link that used to be reconstructed client-side on every
render now lives once, correctly, in the database (`deals.contactId`) and
is resolved by `GET /deals/:id/contact` — one source of truth instead of
the frontend's best-effort name/email matching.

## Wiring this into your existing HTML file

`public/api-client.js` is written to drop into your Velox HTML app with
minimal changes:
1. Add the two Firebase SDK `<script>` tags it expects (see the comment at
   the top of the file) and fill in `FIREBASE_CONFIG`/`API_BASE_URL`.
2. Replace the old `doLogin()`/`doRegister()`/`authLogout()` functions with
   calls to `VeloxAuth.login()`, `.register()`, `.logout()`.
3. Replace reads/writes against the in-memory `DB.contacts` / `DB.deals`
   arrays with `VeloxContacts.*` / `VeloxDeals.*` calls, and re-render from
   whatever they return.

This is the same shape of change for every module (contacts → deals →
invoices → businesses) — happy to walk through wiring up a specific panel
next if you want to tackle them one at a time.
INSY7315---DevTech

YouTube Video Link: https://youtu.be/EUMpB-3WuYY

# Velox App

Velox is a business management application built to benefit Aquarius Ndalo Holdings Pty Ltd. It streamlines day-to-day operations by bringing proposals, pipeline tracking, billing, finance, contacts, and business management into a single, easy-to-navigate platform.

Purpose

Velox was created to give Aquarius Ndalo Holdings a simpler, more secure way to manage its core business processes — from tracking proposals and pipeline opportunities, to billing and finance, contacts, and general business administration all in one app.

Key Features

Login Page

Finance page authentication 

Simple navigation — a clean, simple interface that's easy to learn and use
Improved security — stronger access controls compared to previous systems

AI agent integration — an AI agent assists users within the app which can navigate a lot better through the application to give you the best assistance but also relevant assistance.

Centralized modules — proposals, pipeline, billing, finance, contacts, business, and settings, all accessible from one home page.

# Getting Started

Login / Register — On opening the app, users are met with a login page where they can either log in to an existing account or register a new one.

Home Page — After logging in, users land on a home page featuring a navigation menu with the following sections:
Proposals
Pipeline
Billing
Finance
Contacts
Business
Settings

# Finance Access
The Finance section requires a separate, restricted login for additional security.
so in order to test it out you must use the following information:

Username: admin
Password: Velox@2026

# Technical tools

Firebase

Node.js

Languages: CSS, JavaScript, Html

IDE: Visual Studio 2022

AI Agent: Integrated within the app to assist users

# Security

Velox has been designed with security as a priority, offering improved protections over previous systems, including restricted access to sensitive areas such as Finance and the overall general access to the application .

About

This project is developed for and  benefits Aquarius Ndalo Holdings (Pty) Ltd, based on the foundation of the app that they started developing but we added our own features to not only improve the app but make it more secure and user-friendly.

Hosting and CI/CD Pipeline

Application Hosting

The Velox application has been deployed using Render to provide a publicly accessible hosted environment.

**Live Application:**  
https://ndalo-agents.onrender.com

The application is connected to the project's GitHub repository and is deployed from the `main` branch. Render is configured to automatically deploy new changes merged into the `main` branch, ensuring that the hosted application remains up to date with the latest approved version.

GitHub Repository and Branch Management

GitHub is used for source control and collaborative development. The project uses separate branches for development and feature work before changes are merged into the `main` branch.

The `main` branch represents the stable version of the application and is used as the deployment branch.

This branch-based workflow allows team members to develop features independently, review changes through pull requests, and merge approved changes into the stable application.

GitHub Actions CI/CD Pipeline

A GitHub Actions workflow has been implemented to support continuous integration and deployment.

The workflow is located at:

`.github/workflows/main.yml`

The pipeline performs the following stages:

1. **Automated Testing / Validation**
   - Checks out the latest project code.
   - Performs automated project checks before deployment.
   - Ensures that changes are validated before they reach the deployment stage.

2. **Automated Deployment**
   - The deployment stage runs after the testing stage.
   - Deployment is configured to run when changes are pushed or merged into the `main` branch.
   - The pipeline is configured to trigger deployment to the Render hosting environment.

 CI/CD Workflow

The development and deployment process follows this workflow:

`Feature Branch → Pull Request → main → GitHub Actions → Automated Tests → Render Deployment`

This CI/CD process helps maintain code quality, provides a consistent deployment process, and reduces the need for manual deployment after approved changes are merged.

 Hosting and CI/CD Responsibility

**Task 2 – Hosting and GitHub/Pipeline Implementation**

The hosting and CI/CD implementation was completed as part of Task 2, including:

- Deployment of the Velox application to Render.
- Configuration of the public hosted application.
- GitHub branch and merge workflow.
- Creation of the GitHub Actions CI/CD workflow.
- Configuration of automated testing/validation.
- Configuration of automated deployment to Render.
