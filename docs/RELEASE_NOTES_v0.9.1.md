# SkyGen Core v0.9.1 — Security & Stability Hardening

**Status: Xbox/Realm testing release. Do not merge to stable `main` until in-game validation.**

This release builds on v0.9.0 without removing the 42 generators, 42 skills, 50 ranks, original menu, Credits/Orbits exchange, shops, plots, quests, or saved world/pack IDs.

## Security fixes

1. **Generator-token authentication:** server-issued unique token ID stored both on the egg and in an authoritative per-token world ledger. A display-name-only egg or already spent token is rejected. Token uses are handled through cancellable `beforeEvents.itemUse` to prevent vanilla egg consumption. The selected slot must still hold the exact issued token; otherwise, no generator is created. Token reservations and debit occur before world/registry changes.
2. **Recoverable generator placement:** rollback preserves existing bedrock. On ambiguous persistence/inventory failures tokens become **review-only**, never automatically reissued. New output XP is only awarded if the script generated it.
3. **Marketplace settlement:** seller proceeds use unique listing IDs, monotonically increasing per-seller payout sequences, and a recipient-side applied-sequence marker saved in the **same** profile write as Credits. Clearing a queue can fail without crediting the seller twice. Legacy numeric proceeds are marked paid once in the profile before clearing.
4. **Player trades:** use documented `Container.swapItems(fromSlot, toSlot, otherContainer)` instead of two independent inventory writes. Any uncertain swap becomes an operator review record; trades are refused when this API is unavailable.
5. **Explosion protection:** cancel explosions whose impacted blocks include spawn or any plot. A failure when inspecting an explosion cancels it for safety. TNT, creepers and TNT minecarts are covered *when their effects pass through this API event*.
6. **Plot claim recovery:** per-player claim reservation is saved and used to finish partially committed allocations without creating another plot.
7. **Bedrock skill compatibility:** Ocean Runner now grants supported Speed I while underwater instead of Java-only Dolphin's Grace. Existing skill IDs/point costs are preserved.
8. **Abuse limits:** max 5 active marketplace listings per player, generator output XP requires authenticated generation, and ordinary mining XP is capped at 10 per minute per player. Passive effects refresh at 10 ticks for quicker plot/PvP cleanup and do not downgrade stronger potions.

## Operator commands

- `/scriptevent skygen:security` — inspect flagged generator tokens/trades (operator only).
- `/scriptevent skygen:marketreview` — inspect blocked/uncertain marketplace listings (operator only).
- `/scriptevent skygen:tokenrestore PlayerName | Generator Name` — **operator-only** manual issuance of a verified token after confirming a legitimate older purchase. There is no automatic approval of name-only legacy eggs.

## Known limits and safety

- Bedrock's Script API cannot make a world-dynamic-property write, a player-dynamic-property write, an inventory transfer and a world-block change into one true durable transaction. Ambiguous operations are **quarantined for operator review**, not automatically replayed.
- Plot boundaries are protected against player changes and Script API explosion events; mechanically driven pistons, flowing fluids and other add-ons require a live-World integration test. Do not claim an absolute anti-grief guarantee solely from mocked testing.
- Legacy display-name-only generator eggs cannot be trusted. Operators must verify and replace genuine unused eggs as described above. This is an intentional security breaking change affecting previously purchased unused eggs.
- World/property ledger keys accumulate for token issuance and operator records; review long-running Realm storage and logs periodically.
- The v0.9.x generator registry uses new banked properties; restoring v0.8.3 requires restoring a **pre-upgrade world backup**, not only replacing the pack.
- Existing 69 adapted prior tests plus **31 security regression tests** passed under mocked Bedrock APIs. These do not substitute for tests on an Xbox/Realm copy.

## Testing instructions

See `docs/REALM_SECURITY_TEST_CHECKLIST.md` before upgrading the live Realm.
