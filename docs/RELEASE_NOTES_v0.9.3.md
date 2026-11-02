# SkyGen Core v0.9.3 — Custom Generator Item Collection

## Changed

- 42 unique item identifiers: `skygen:generator_<resource>`; every resource maps to one `behavior_pack/items/*.json` definition and one `resource_pack/textures/items/*.png` file.
- New tokens are **non-stackable** (`minecraft:max_stack_size: 1`), carry the saved `sg_token_id` dynamic property, and must be issued/authorized through the existing world token ledger. Forged or reused custom items are rejected.
- All icons are 64×64 RGBA PNG and assigned via `resource_pack/textures/item_texture.json` and `minecraft:icon`.
- Register `skygen:generator_token_use` through Script API 2.0 early startup; onUse and onUseOn share one deduplicated placement callback.
- The script **fails closed** if registration cannot complete. New purchases are disabled without charges rather than generating a unusable item.
- Previously purchased v0.9.2 goat horn tokens remain valid; SkyGen's two locked teleport horns are unchanged.

## Unchanged

42 actual generator types, generator prices/unlock ranks/regeneration, 42 skills, 50 ranks, plots/ownership and safe teleport, Credits and Orbits (18M exchange), marketplace, trading, admin privileges, daily quests, generator banked persistence and all BP/RP/module UUIDs. Never automatically recognize name-only old eggs as purchases.

## Known test limitations

Automated tests use a mocked Bedrock API; Minecraft Xbox still needs verification that custom onUse/onUseOn fires on controller and that the texture atlas resolves. Some custom items may behave differently when used on interactive blocks; test against ordinary plot blocks and air. No test can guarantee all world/server interruptions are atomic. On ambiguous token writes, consult operator diagnostics; do not automatically reissue.

## Automated validation

- 114 simulated tests passed across 5 suites; 42 generator JSON/item/atlas records passed all checks.
- Exact versions `[0,9,3]` and UUID preservation checked.
