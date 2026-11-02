# SkyGen Core v0.8.1 — Plot Teleporter & Generation Fix

Base: user-provided v0.8.0 Plot Generation Compatibility Fix.

## What changed
- Fix unloaded destination bug: keep temporary plot ticking area active until teleport actually finishes, then remove it 2 seconds later so client collision chunks can load.
- Plot Horn and My Plot menu now load/check/repair a plot and then automatically begin the existing five-second standstill countdown. No repeated horn presses needed.
- New plot assignments trigger starter island preparation in the background when the player first joins.
- Repair a missing 17x17 island using **keep** fill mode, which writes only into air and does not replace existing player builds. The island has dirt at Y=103-104, grass at Y=105, and safe arrival starts at Y=107.
- Verify the floor at 9 locations, and choose a clear landing at the center or nearby, avoiding blocks owners may have placed there.
- Visitor plot teleports use the same loaded-chunk safety path as owner's Plot Horn.
- Add safe failure feedback for missing cheats/ticking-area capacity, unloaded chunks, and blocked landings; never intentionally teleport into an unverified void island.
- Release temporary ticking areas if a countdown is cancelled, the player moves, the teleport fails, or the request times out.
- Preserve existing per-player plot assignment, ownership/trust, menu, economy, trading, shop, ranks, generators, and admin features.

## Requirements / use
- Bedrock add-on uses stable `@minecraft/server` 2.0.0 and `@minecraft/server-ui` 2.0.0.
- The Realm/world must permit commands and have a free ticking-area slot when building or teleporting to a distant plot.
- Back up the Realm, disable/deactivate older SkyGen versions, and import / activate both new packs.
- Test on a **copy** of your Realm before deploying to live players. All scripted mock tests and archive checks pass; a real Xbox/Realm run remains to be verified.

## Quick in-game test
1. In a new void world, join and wait for the "Plot #1 is ready" message.
2. Use the plot horn in hotbar slot 9. It should load your plot and initiate a 5-second countdown automatically.
3. Stay still; arrive at the grass starter island at plot X=512/Z=512, landing about Y=107.
4. Return to spawn, then use the plot horn again; it should work even when plot chunks were unloaded.
5. Place blocks above part of the floor, then repeat. Existing builds should remain untouched; alternate landing should be selected when center is blocked.
6. Walk during a countdown; it should cancel without teleport or stuck ticking areas.
7. Repeat for an invited visitor to a different plot, and verify plot assignment and original menu still work.

## Offline tests
`node tests/test_plot_teleport.cjs source/behavior_pack/scripts/main.js`
