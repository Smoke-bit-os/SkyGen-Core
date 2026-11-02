# Safe migration and rollback

1. **Copy your Realm world first** and save a separate v0.8.3 backup.
2. Pack UUIDs are preserved. Old `sg_profile` data is read unchanged. Newly purchased skills and daily progress are additive fields in that same profile.
3. Before the first generator change, v0.9.0 reads the original `sg_generators` data. At the first generator save, v0.9.0 writes complete data to the inactive bank and then publishes a verified commit marker (`sg_generators_v2_commit`). This leaves the original legacy blob untouched.
4. Each subsequent save writes the other bank, verifies every shard, and commits the new marker last. On a write failure, the old marker remains authoritative; gameplay purchase / placement cancels.
5. **Do not simply disable v0.9.0 and reactivate v0.8.3 in the same upgraded world.** v0.8.3 cannot read v0.9.0's new generator records. Use the world backup made before installing.
6. If the script reports registry checksum/capacity errors, don't erase the data; ask an operator to investigate and keep backups.
7. The 1,200 record server-wide cap and 20/25/30 player caps are deliberate, not unlimited.

No data deletion or UUID rotation is performed by this update.
