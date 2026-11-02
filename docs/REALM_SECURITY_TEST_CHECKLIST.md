# SkyGen v0.9.1 Realm Testing Checklist

Always test in a **copy of the Realm** with the same world settings and cheats enabled.

- [ ] Import behavior + resource packs from the v0.9.1 `.mcaddon` and deactivate all old versions.
- [ ] Confirm no JavaScript startup errors; original SkyGen tools and menu appear.
- [ ] Join as two players, verify ownership/teleport and that old plot data survives.
- [ ] Verify all 42 generators appear, rank locks work, old registered generators regenerate and new registry survives restart.
- [ ] Buy two generator tokens. Confirm Credits debited exactly once and eggs have distinct issued identities.
- [ ] Hold a genuine new token, place a generator; verify exactly one egg consumed and one generator created.
- [ ] Test one renamed vanilla egg; no generator may appear (and egg should not be thrown).
- [ ] Test first-time plot allocation, safe return teleport, and previous bedrock within a placement target.
- [ ] Check `/scriptevent skygen:security` and operator-only token recovery for a verified legacy egg.
- [ ] Complete an item-for-item trade with two players and full inventories. Confirm no loss/duping.
- [ ] List/buy/cancel regular marketplace items; seller payout once after a rejoin/restart.
- [ ] Verify ordinary purchases, sales, exchange quantity, Credits/Orbits, rank XP and shop pricing remain correct.
- [ ] Confirm TNT explosions that touch spawn/other plots do not damage those regions.
- [ ] Test TNT minecarts, creeper explosions, pistons, fluids, dispensers and boundary situations with a second player.
- [ ] Verify skill branches/effects and Ocean Runner (Speed underwater), and check PvP boundary effects stop promptly.
- [ ] Restart a test world, verify wallets, plots, generators, skill points, pending listings and admin privileges persist.
- [ ] Keep backups. Do **not** merge to stable main until all necessary Xbox/Realm tests succeed.
