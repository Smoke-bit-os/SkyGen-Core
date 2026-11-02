# SkyGen v0.9.3 — Required Xbox Test-World Checklist

Back up your world first. In a **copy**, disable all older SkyGen behavior/resource packs. Activate ONLY the v0.9.3 BP + RP and restart.

- [ ] There are no Content Log errors for custom items, item atlas or `skygen:generator_token_use`.
- [ ] Confirm original compass, Spawn Horn (hotbar slot 8) and Plot Horn (slot 9) still work.
- [ ] Buy ONE Cobblestone generator. Credits are deducted once and `skygen:generator_cobblestone` appears with the correct gray/blue cube icon, not a horn or purple missing-texture tile.
- [ ] Use the Cobblestone core while looking at a regular plot block (not a chest/button); one token disappears and a working generator appears.
- [ ] Restart; generator and Credits persist.
- [ ] Purchase and use one other type (e.g. Coal). Verify its item art differs and it places the correct output.
- [ ] A copied/spent token or renamed custom item with no server-issued token ID cannot place a generator.
- [ ] A valid old v0.9.2 generator goat horn still works after upgrading; teleport horns still work.
- [ ] If the custom item use action does not trigger when tapping/right-clicking a block, try use in air facing the plot block and report which interaction does or does not work.
- [ ] Verify a player's existing rank/skills/plot/credits/orbits and previous generators survive join, restart, and rejoin.
- [ ] Verify all 42 item icons appear: use `/give @s skygen:generator_<resource>` in the test world as a **visual-only** check; `/give` items lack an issuance ID and must NOT place generators.
- [ ] Check custom item drops/trading/full inventory behaviour with a second player. A purchased token belongs to its buyer and must fail for another player.
- [ ] Do not merge to stable `main` or deploy live until the above pass.
