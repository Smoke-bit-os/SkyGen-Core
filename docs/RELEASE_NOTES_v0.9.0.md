# Release notes: v0.9.0 testing build

## Generator expansion

42 distinct generator types, categorized and paged. The existing Cobblestone/Coal/Iron/Gold/Diamond/Emerald tokens and regeneration settings are unchanged. Other generators have rank unlock requirements (new purchases only); already-owned old tokens continue to work. Generator levels remain 1–5. The registry now supports up to 1,200 records in an atomic-commit sharded bank system; the old registry is not erased. A default player can own 20 generators, expanding to 25 and 30 with Engineering skills. Ancient Debris is restricted to one per player.

## Skill Tree

42 skills, six branches: Mining, Mobility, Survival, Exploration, Economy, Engineering. Rank requirements and prerequisite chains apply. Earned points are derived from rank, so old players receive them without duplication: total at Rank 50 = 59 points. Skills spend 1–4 points each; choices matter. Respec available for `10,000 + Rank × 200` Credits.

### Potion effects
Haste, Speed, Jump Boost, Slow Falling, Resistance, Regeneration, Health Boost, Fire Resistance, Night Vision, Water Breathing, Conduit Power, Dolphin's Grace, plus active Absorption, Saturation, and Invisibility. Potion effects are only granted while on the owner's plot (or actively used there), removed when leaving when possible, and not granted in shared PvP zones. Skills like teleport cooldown, generator speed, economic discounts, mining XP and slot expansions have functional non-potion implementations.

### Important note about PvP and effects
There is no custom Warzone coordinate configuration in this release. Skills don't activate off a player's own plot. A short residual effect can still exist around travel or interruption, as Minecraft effect updates aren't globally atomic. This is not a server-wide PvP/anti-cheat solution.

## Economy, quests and menus
Server Shop catalog expands 4 → 28 items with categories/pages. Original prices unchanged. Three daily quests (mine 50 blocks, harvest 10 generators, place 1 generator) reset at midnight UTC. Original menu order, Credits/Orbits exchange rate (18 million to 1), 50 rank names, and admin controls remain.

## Generator persistence migration
A save migrates `sg_generators` to verified banks `sg_g2_<bank>_<index>` with `sg_generators_v2_commit`. The metadata commit marker is switched only when all new shards pass readback. Legacy storage remains untouched; corrupted data causes fail-closed behavior rather than an empty save.

## Validation and limitations
69 simulation checks passed: 9 plot-flow, 26 prior stability checks adapted to new persistent format, 9 preinstall checks adapted to extended menu, and 25 v0.9-specific checks. JS syntax and pack ZIP checks pass. Does not guarantee the Realm behavior until tested on Xbox. Avoid downgrading a migrated world without restoring an older backup.
