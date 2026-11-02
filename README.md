# SkyGen Core v0.8.2 — Full Stability Repair (test build)

Minecraft Bedrock on Xbox/Realms. Version 0.8.2 is based on the provided v0.8.1 test build; the familiar original SkyGen menu, 50 ranks, 18,000,000 Credits per Orbit conversion, admin tools, generator mechanics and plot ownership keys remain in place.

## Install (back up first)

1. Make a **copy** of your Realm/world. Back up the real world before testing.
2. Import `releases/SkyGen_Core_v0.8.2_Full_Stability_Repair.mcaddon` into Minecraft Bedrock.
3. Disable earlier SkyGen Behavior and Resource Packs in the world copy. Activate both v0.8.2 packs.
4. Cheats must be enabled for `/fill`, `/setworldspawn`, and temporary `/tickingarea` setup.
5. Test first spawn, Plot Horn, new plot, visitor restrictions, full inventory trades, generators across a restart, and market cancellation/restart.
6. Check Minecraft's **Content Log** for errors. Do not deploy on your production Realm until in-game checks pass.

Minimum Bedrock engine **1.21.90** with stable `@minecraft/server` and `@minecraft/server-ui` **2.0.0**.

## Contents

- `behavior_pack/scripts/main.js` — original feature set with repaired safety routines
- `behavior_pack/manifest.json`, `resource_pack/manifest.json`
- `releases/SkyGen_Core_v0.8.2_Full_Stability_Repair.mcaddon` — installable add-on
- `tests/test_plot_teleport.cjs` — nine original plot regressions
- `tests/test_stability_v082.cjs` — 26 further regression scenarios
- `docs/RELEASE_NOTES_v0.8.2.md`, `docs/REALM_TEST_CHECKLIST.md`

## Validation

`node tests/test_plot_teleport.cjs behavior_pack/scripts/main.js`

`node tests/test_stability_v082.cjs behavior_pack/scripts/main.js`

The two test suites are mocked Node.js simulations, not Xbox/Realm live execution.

## Operator review of interrupted market transactions

`/scriptevent skygen:marketreview`

The command prints held/review listings. An operator must reconcile the actual items and wallets manually; the pack deliberately does not auto-refund uncertain transactions because doing so could duplicate items or Credits.
