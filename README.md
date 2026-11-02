# SkyGen Core v0.9.0 — Progression Expansion (TESTING)

**Minecraft Bedrock (Xbox / Realms)** — based on the user-tested v0.8.3 release.

## What's new

- **42 generators** across Starter (12), Mining (10), Nature & Nether (10), Endgame (10). Old six generators retain their exact names, output blocks, prices, and default periods.
- **42 unlockable skills**, seven each in Mining, Mobility, Survival, Exploration, Economy, and Engineering. Every rank-up awards one Skill Point; Ranks 10/20/30/40/50 award two bonus points each. A Rank 50 player is entitled to 59 total points, even on existing worlds.
- **Passive / toggleable / active effects** with skill prerequisites, rank gates, paid respec, on-plot-only effects and persistent ability cooldowns.
- **28 Server Shop items**, organized into categories and pages, with exact per-item quantities and optional economy bonuses.
- **Three daily quests** refreshed on UTC date change, rewarding Credits and XP.
- **Generator persistence migration:** transactional two-bank, verified, sharded world dynamic properties. Capacity is now 1,200 registry records (rather than 500); the preexisting `sg_generators` world property is preserved as a backup.
- **Performance management:** generator heartbeat processes at most 100 generators per second; regeneration delays use tick elapsed time. Player caps: 20 / 25 / 30 based on Engineering skills. Only one Ancient Debris generator per player.
- **Mining progression:** generator harvests award bonus XP; ordinary block XP is rate limited to reduce XP spam.

## Compatibility / preservation

Pack header and module UUIDs are **unchanged** from v0.8.3. Existing player profiles, Credits, Orbits, 50 ranks, plot assignments, token names, marketplace/trades, hotbar tools, and original menu options are preserved. The two new main-menu entries are **Skill Tree** and **Daily Quests**. The original ten entries remain in order.

**IMPORTANT:** After a v0.9.0 registry migration, do not downgrade to v0.8.3 on the same live world without restoring the pre-upgrade world backup: old code cannot read the newer generator sharded data. v0.8.3 remains the stable production release until you test this package in a COPY of your Realm.

## Installation

1. Make a backup / Realm world copy. Never test a new development release directly on the live world.
2. Import `SkyGen_Core_v0.9.0_Generators_Skill_Tree.mcaddon` (it includes both packs).
3. Deactivate old SkyGen versions, enable v0.9.0 Behavior + Resource Packs, enable cheats for ticking areas.
4. Enter a test world and check plot generation / both horns; then verify existing plot ownership, balances and generators.
5. Open **SkyGen Menu → Generators** or **Skill Tree** and test purchases / rank points. If a test fails, restore the world copy backup.

## Tests

`node tests/test_skygen_v081.cjs behavior_pack/scripts/main.js`

`node tests/test_skygen_v090_legacy.cjs behavior_pack/scripts/main.js`

`node tests/test_skygen_v090_preinstall.cjs behavior_pack/scripts/main.js`

`node tests/test_skygen_v090.cjs behavior_pack/scripts/main.js`

**69 mocked regression tests passing**, Node JavaScript syntax check, nested ZIP integrity, manifest dependency verification. Mock tests do not substitute for real Xbox/Realm testing.

## Source tree

- `behavior_pack/` and `resource_pack/` — standalone pack source files
- `generator_catalog.json` — all 42 generator types/prices/unlock ranks
- `skill_catalog.json` — all 42 skill nodes, prerequisites and costs
- `tests/` — Node simulated regression suites
- `docs/` — release notes, migration details, install checklist and checksums
