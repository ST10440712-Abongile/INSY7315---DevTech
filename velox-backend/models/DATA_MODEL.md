# Velox Data Model (Firestore)

Firestore is a NoSQL document database — "tables" are called **collections**,
and rows are **documents**. Relationships are modelled with reference fields
(an ID stored on the child document pointing at its parent), enforced at the
application layer (API) rather than by the database itself, since Firestore
has no foreign keys. This file is the ERD: it documents every collection,
field, relationship, and the integrity rules the API enforces for you.

## Entity-Relationship Diagram (text form)

```
users (1) ──────< (many) businesses
businesses (1) ──< (many) contacts
businesses (1) ──< (many) deals
businesses (1) ──< (many) invoices
contacts   (1) ──< (many) deals        [deal.contactId -> contact.id]
deals      (1) ──< (many) invoices     [invoice.dealId -> deal.id, optional]
```

Every business-owned record also carries `ownerUid` — a denormalised copy of
the **tenant's** UID (i.e. `users/{uid}.tenantUid`, not necessarily the
individual who happens to be signed in) — so every single query and every
authorization check can filter/verify by tenant in one step, without an
extra lookup through `businesses`. This is a deliberate denormalisation
(common, correct practice in NoSQL design) that trades a little storage for
much cheaper, simpler, and faster reads and security checks.

### Multi-user teams & roles
One business account (one "tenant") can have several people signed in
under it — an Owner/CEO plus any number of invited teammates — each with
their own Firebase login but all reading and writing the *same* set of
businesses/contacts/deals/invoices. This is what `tenantUid` is for:
every record is scoped to the tenant, not to whichever individual created
it, so the whole team sees the same data.

What each role can do is a single table in `config/roles.js`:

| Resource | Owner | Manager | Finance | Sales |
|---|---|---|---|---|
| Businesses | read/write | read/write | read only | read only |
| Contacts | read/write | read/write | **no access** | read/write |
| Pipeline (Deals) | read/write | read/write | **no access** | read/write |
| Finance & Billing (Invoices) | read/write | **no access** | read/write | **no access** |
| Proposals | read/write | read/write | **no access** | read/write |
| Team management | read/write | read/write | **no access** | **no access** |

This is enforced by `requirePermission(resource, action)` middleware on
every route (see `middleware/auth.js` + `config/roles.js`) — a 403 is
returned server-side if the caller's role doesn't carry the permission,
regardless of what the frontend does or doesn't show. Only an Owner can
grant the Owner role to someone else; a Manager can invite/assign Manager,
Finance, or Sales, but never Owner (`canAssignRole()` in `config/roles.js`).

## Collections

### `users/{uid}`
Mirrors Firebase Auth, plus the two fields that make role-based access
work. Created automatically on first login (see
`controllers/auth.controller.js`).
| Field | Type | Notes |
|---|---|---|
| uid | string (doc ID) | Firebase Auth UID — primary key |
| email | string | from Firebase Auth token |
| **tenantUid** | string | **which business account this user's data belongs to.** For an Owner, this equals their own `uid`. For an invited teammate, it's the Owner's `uid` — this is how a whole team shares one set of businesses/contacts/deals/invoices instead of everyone having their own empty copy. |
| **role** | string | one of `owner` / `manager` / `finance` / `sales` — see `config/roles.js` for exactly what each can do |
| invitedBy | string \| null | uid of whoever invited this user, if applicable |
| createdAt / lastLoginAt | timestamp | server-set |

### `invites/{id}`
A pending invitation — consumed and deleted-in-spirit (flagged, not
removed, for an audit trail) the first time the invited email logs in.
| Field | Type | Notes |
|---|---|---|
| tenantUid | string | which business account this invite grants access to |
| email | string | lowercased, matched against the Firebase Auth email at login |
| role | string | the role this person will receive |
| invitedBy | string | uid of the Owner/Manager who sent it |
| consumed | boolean | flips to true once the invited user logs in |
| createdAt / consumedAt | timestamp | server-set |

### `businesses/{businessId}`
| Field | Type | Notes |
|---|---|---|
| id | string (doc ID) | auto-generated |
| ownerUid | string | **FK** → users.uid |
| name | string | required |
| type | string | 'company' / 'sole-prop' / etc |
| reg | string | registration number, optional |
| color | string | hex, for UI |
| address | string | optional |
| vat | boolean | |
| createdAt / updatedAt | timestamp | server-set |

### `contacts/{contactId}`
| Field | Type | Notes |
|---|---|---|
| id | string (doc ID) | auto-generated |
| businessId | string | **FK** → businesses.id |
| ownerUid | string | **FK** → users.uid (denormalised, see above) |
| name | string | required |
| org | string | optional |
| email | string | validated format |
| phone | string | optional |
| title | string | job title, optional |
| notes | string | optional |
| createdAt / updatedAt | timestamp | server-set |

### `deals/{dealId}`  (Pipeline)
| Field | Type | Notes |
|---|---|---|
| id | string (doc ID) | auto-generated |
| businessId | string | **FK** → businesses.id |
| ownerUid | string | **FK** → users.uid |
| contactId | string \| null | **FK** → contacts.id (the linking feature) |
| client | string | required |
| title | string | required |
| sector | string | enum: gov/soe/ngo/edu/private/professional |
| type | string | e.g. 'Training' |
| stage | string | enum: lead/qualified/proposal/negotiation/won/lost |
| value | number | >= 0 |
| prob | number | 0–100 |
| close | string (ISO date) | expected close date |
| notes | string | optional |
| createdAt / updatedAt | timestamp | server-set |

### `invoices/{invoiceId}`
| Field | Type | Notes |
|---|---|---|
| id | string (doc ID) | auto-generated |
| businessId | string | **FK** → businesses.id |
| ownerUid | string | **FK** → users.uid |
| dealId | string \| null | **FK** → deals.id, optional |
| client | string | required |
| amount | number | >= 0 |
| status | string | enum: draft/sent/paid/overdue |
| dueDate | string (ISO date) | |
| createdAt / updatedAt | timestamp | server-set |

## Referential integrity (enforced in the API, not the DB)

Firestore won't stop you writing a `deals.contactId` that points at a
contact which doesn't exist — so the API does it instead:
- `POST /deals` and `PUT /deals/:id` verify `contactId` exists **and**
  belongs to the same `ownerUid` before saving (see
  `controllers/deals.controller.js` → `assertContactOwnership`).
- Deleting a contact that is still linked to deals is blocked with a
  `409 Conflict` rather than silently orphaning the reference.

## Indexes
Firestore auto-indexes single fields. Composite indexes are needed for the
compound queries this API runs (defined in `firestore.indexes.json`):
- `contacts`: `ownerUid ASC, createdAt DESC`
- `deals`: `ownerUid ASC, stage ASC, createdAt DESC`
- `deals`: `ownerUid ASC, contactId ASC`
- `invoices`: `ownerUid ASC, status ASC, dueDate ASC`
