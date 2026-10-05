const { db, admin } = require('../config/firebase');

// ── Repository Pattern ──────────────────────────────────────────────────
// Controllers never talk to Firestore directly. Instead they go through a
// Repository instance for their collection. This means:
//   1. Firestore-specific code (timestamps, snapshot parsing) lives in ONE
//      place instead of being copy-pasted into every controller.
//   2. If the project ever migrated off Firestore (e.g. to PostgreSQL),
//      only this class — not the controllers — would need to change.
//   3. It's trivially mockable in unit tests.
class FirestoreRepository {
  constructor(collectionName) {
    this.collection = db.collection(collectionName);
  }

  async create(data) {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const ref = await this.collection.add({ ...data, createdAt: now, updatedAt: now });
    const snap = await ref.get();
    return { id: ref.id, ...snap.data() };
  }

  async findById(id) {
    const snap = await this.collection.doc(id).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  // filters: array of [field, op, value] Firestore query tuples
  async findMany({ filters = [], orderBy = null, limit = null } = {}) {
    let q = this.collection;
    for (const [field, op, value] of filters) q = q.where(field, op, value);
    if (orderBy) q = q.orderBy(orderBy.field, orderBy.direction || 'asc');
    if (limit) q = q.limit(limit);
    const snap = await q.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async update(id, data) {
    const ref = this.collection.doc(id);
    await ref.update({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    const snap = await ref.get();
    return { id: snap.id, ...snap.data() };
  }

  async delete(id) {
    await this.collection.doc(id).delete();
  }
}

module.exports = FirestoreRepository;
