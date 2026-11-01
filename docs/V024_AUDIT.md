# v0.2.4 source audit

The user-supplied v0.2.4 archive contains two nested `.mcpack` files: a behavior pack with `scripts/main.js` (15,743 bytes) and manifest, plus a resource-pack manifest. ZIP integrity and `node --check` passed.

## Confirmed issues in source

1. The pack manifests label the pack `v0.2.2` despite version arrays `[0,2,4]`.
2. Plot teleport targets the remote plot **before** generating the starter island. Players can fall into void while generation runs five ticks later.
3. `claim()` assigns the plot permanently before confirming island generation; distant unloaded chunks can prevent the island from being built.
4. `createSpawn()` uses commands that can fail when spawn chunks are unloaded, but the rescue attempts to teleport players regardless.
5. Generator placement is stored only in an in-memory Map, so generators are lost on script/world restart.
6. Player marketplace and secure trading explicitly display 'not enabled yet'.
7. There is no automated Bedrock runtime test in this repository.

## Status

The repository's `behavior_pack/scripts/main.js` is a separate minimal navigation baseline, **not the full 0.2.4 game script**. Do not publish it as a full release. Source migration and safe void-plot generation remain necessary before release.
