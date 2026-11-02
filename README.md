# SkyGen Core — v0.8.1 Plot Teleporter & Generation Fix (testing)

Minecraft Bedrock / Xbox Realms add-on. This branch contains a plot-generation/teleport fix based on the supplied v0.8.0 package.

## Downloads

- [SkyGen Core v0.8.1 installable MCADDON](releases/SkyGen_Core_v0.8.1_Plot_Teleporter_Generation_Fix.mcaddon)
- [v0.8.1 release notes and test checklist](docs/RELEASE_NOTES_v0.8.1.md)

## Source

- `behavior_pack/manifest.json` and `behavior_pack/scripts/main.js`
- `resource_pack/manifest.json`
- `tests/test_plot_teleport.cjs` — nine mocked Node.js tests

## Important

The v0.7.6 release on `main` was previously user-tested. The v0.8.1 plot changes passed syntax and mock tests, but must be tested in a Minecraft Realm/world copy before merging to `main`.

**Test:** `node tests/test_plot_teleport.cjs behavior_pack/scripts/main.js`
