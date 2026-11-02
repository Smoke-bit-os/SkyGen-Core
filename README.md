# SkyGen Core v0.9.1 — Security & Stability Hardening

Minecraft Bedrock/Xbox Realm add-on. **Testing release** built from the v0.9.0 progression expansion, with 42 generator types, 42 skills, six branches, 50 ranks, expanded Server Shop, daily quests, admin tools, plot/teleport safety and 18,000,000-Credits-per-Orbit conversion.

## Install

Import `SkyGen_Core_v0.9.1_Security_Stability_Hardening.mcaddon`, activate both versioned packs and deactivate older SkyGen packs. **Back up the world before changing anything**; test a world copy first.

## Security changes

See `docs/RELEASE_NOTES_v0.9.1.md` for the complete change list and limitations, plus `docs/REALM_SECURITY_TEST_CHECKLIST.md` for multiplayer test steps. The executable token issuance, item swap, seller payout ledger and explosion guards are in `behavior_pack/scripts/main.js`.

## Operator recovery

- `/scriptevent skygen:security`
- `/scriptevent skygen:marketreview`
- `/scriptevent skygen:tokenrestore PlayerName | Generator Name`

Older *unused* generator eggs do not have cryptographically authenticated IDs; the operator must validate their purchase and replace them manually. Name-only eggs are blocked by design.

## Automated testing

Run `node tests/test_security_v091.cjs behavior_pack/scripts/main.js` and all other `.cjs` files in `tests/` with the same script path. These are **simulations**, not Xbox gameplay tests. The test suite reports **100 passing checks** (69 adapted prior + 31 security scenarios).

## Packaging

- `behavior_pack/` / `resource_pack/`: sources and manifests
- `generator_catalog.json`, `skill_catalog.json`: reference progression catalogs
- `docs/`: release notes, migration, security checklist and SHA-256
- `tests/`: reproducible mocked regression harnesses
- `releases/`: installable `.mcaddon`

## Stability policy

`main` remains on previously player-tested v0.8.3 until v0.9.1 is tested on a backed-up Xbox/Realm copy. Roll back to v0.8.3 **only by restoring the pre-v0.9 world backup** after generator registry migration.
