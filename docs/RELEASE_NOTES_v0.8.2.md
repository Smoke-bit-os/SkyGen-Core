# SkyGen Core v0.8.2 — Repair Notes

## Fixes from v0.8.1 audit

1. **API start-up:** optional pre-place event can be unavailable without aborting registration; stable pre-interact protects containers/placements; after-place correction is defense in depth. Plot visiting is disabled if the stable interaction guard cannot be registered.
2. **Spawn:** `ensureSpawn()` checks a safe solid landing and never runs the previous destructive air-fill. The platform uses `fill ... keep` only if necessary; failed/unloaded spawn does not trigger a blind teleport. Fresh join rescue is scheduled even if claim/profile errors occur.
3. **Plot generation:** checks all 289 grass-floor tiles, fills missing soil/grass with air-only `keep`, preserves existing structures, stages the destination until the teleport finishes and caps 6 concurrent plot ticking areas.
4. **Plot persistence:** reserves the plot index before assigning and validates ownership to avoid duplicate plot assignments; already assigned plot/profile keys are unchanged.
5. **Plot ticking areas:** tracks active `sg_pN` names and reclaims only SkyGen-named stale areas on startup; cleans on cancel, timeout, success and player leave.
6. **Permissions:** cancels break, interaction and supported pre-place actions; optional after-place safeguard. Security checks no longer apply to Nether or End coordinates.
7. **Trading:** swaps both players' offered slots directly (retaining the full cloned ItemStack) instead of removing both and calling `addItem`; if the second slot write fails, attempts to restore original stacks and reports failures to operators.
8. **Marketplace:** plain commodity whitelist prevents serialized complex item metadata loss. Legacy unsupported items and interrupted `creating/reserved/sold/returning` transactions are marked `review`, not restored or sold speculatively. Added operator listing diagnostics.
9. **Generators:** no silent `slice(0,500)` truncation; verified registry writes and size limits, fail-closed corrupt data, rollback failed placement/upgrade/delete and throttle unloaded-chunk warnings. A 501-record legacy registry is preserved in memory, but new placement is refused until within capacity.
10. **Shop/wallet:** item purchases charge before delivery and refund definite undelivered quantities. Profile and market property writes are verified; corrupt player data refuses silent reset.
11. **Forms and UI:** standard action forms and most direct dialogs retry `UserBusy` on Xbox; original menu retained, help and diagnostics version updated.
12. **Manifest:** version 0.8.2, engine minimum 1.21.90 for stable script API 2.0.0; identifiers/UUIDs are unchanged for existing world-player data compatibility.

## Important remaining limits — do not claim live-world verification

- Marketplace transactions involve independent world-property, player-property and inventory writes that Bedrock does not make atomic. On a power cut/crash, an ambiguous in-flight transaction is quarantined for **manual operator reconciliation**, never automatically replayed. Operator command: `/scriptevent skygen:marketreview`.
- The remaining admin/market review experience is informational; it does not auto-restore custom/enhanced legacy items because those metadata bytes were never saved by older versions.
- A second independent inventory write can still fail during rollback; this is logged prominently. A forced engine shutdown in the middle of the same-tick trade cannot be made perfectly atomic.
- Post-placement safeguards must be tested on a real Bedrock world; interaction protection is expected in the chosen stable API but is dependent on the Realm runtime and other add-ons. Unauthorized after-place corrections may replace a just-placed block with air.
- This does **not** generate a true void-world preset in a normal overworld. It constructs starter platforms within the dimension, as previous versions did.
- No in-game or multiplayer Xbox/Realm verification is possible in this environment. This is a **testing release** until user acceptance.
