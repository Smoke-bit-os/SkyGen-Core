# SkyGen Core v0.9.4 — Custom 3D Generator Bases

**Status: Bedrock/Xbox/Realm testing candidate. Stable main unchanged.**

## New features

- **42 custom physical generator base blocks** replace the visible bedrock at the base coordinate; generated resource blocks still appear above.
- **126 original pixel-art block-face textures:** a top, side, and bottom per generator (64×64 RGBA). The old **42 item textures** stay unchanged, giving **168 total generator texture PNGs**.
- Distinct material colors and mechanical power-core artwork coordinated with the v0.9.3 inventory icons.
- Custom cores are solid, collision-enabled, not mineable/explodable, and marked immovable to pistons (minimum supported Bedrock 1.21.100).
- Generators already registered in v0.9.3 are **migrated lazily** when their chunks are loaded: registered `minecraft:bedrock` -> matching core. The script does not scan for unregistered bedrock, force chunks to load, or rewrite arbitrary player blocks.
- Generator deletion supports both new custom bases and registered legacy bedrock. Generator regeneration, admin force output, and mining protection use the matching registered base.
- New placement requires two air blocks, so existing bedrock or player blocks cannot be overwritten.

## Preserved

- All 42 v0.9.3 secure custom generator items; unique server-issued token IDs; previously issued v0.9.2 goat horn token redemptions; spawn/plot horns.
- Generator catalog, prices, output block IDs, periods, levels, plot/owner records, credits/orbits, ranks, skill tree, shop, trades, quests and marketplace.
- All original BP/RP/module UUIDs and player/world dynamic property names.

## Data safety, compatibility and rollback

- **Back up your Realm world before installing.** A backup/world copy is required for testing.
- Minimum Minecraft Bedrock engine **1.21.100** (the `minecraft:movable` component requires it). No preview/experimental toggle expected for these components, but Xbox needs confirmation.
- A failed or unloaded registered legacy base is left alone for the next scheduled attempt. Other blocks in its place are not overwritten.
- **Downgrading after migration requires restoring a pre-v0.9.4 world backup** because v0.9.3 cannot render the custom in-world core blocks; do not merely remove the packs.
- Unknown/suspect base blocks are never overwritten automatically. Operator should resolve unusual records manually after verifying ownership.
- As with prior versions, crashes between world block changes and generator registry updates cannot be made into one cross-system atomic transaction; preserve snapshots and test deletion/restart under controlled conditions.

## Automated testing

- **141 simulated checks passed**: 114 earlier checks plus 27 new core/migration/deletion tests.
- 42 custom block JSONs, 126 unique 64×64 opaque block-face PNGs, correct terrain atlas entries, 42 original item mappings, exact pack UUIDs and matching `[0,9,4]` manifest dependencies all passed.
- Script syntax and nested archive checks passed. Real-world Xbox rendering and migration are not verified yet.
