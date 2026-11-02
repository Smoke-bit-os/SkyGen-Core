# Acceptance checklist — test on a backed-up world/Realm copy

- [ ] Disable duplicate previous SkyGen behavior/resource packs; activate both v0.8.2 packs.
- [ ] New world starts without script/content-log errors, even after reload/restart.
- [ ] Custom blocks above Y=0 at spawn survive repeated join, Spawn Horn and world restart.
- [ ] First player gets plot #1, next player plot #2; each 17×17 starter island has no gaps.
- [ ] Plot Horn works on unloaded plots and waits five seconds without ever dropping into void.
- [ ] Blocked plot center selects a safe alternate landing; moving during countdown cancels and cleans areas.
- [ ] `/tickingarea list` shows no stale `sg_pN` entries after a completed/cancelled teleport; existing custom areas are untouched.
- [ ] Non-owner cannot place, break or open chest on the other plot. Trusted player can build; invited visitor can only visit.
- [ ] Rank, XP, admin axe, original menu, Credits and Orbits including quantity exchange still work.
- [ ] Generator purchase, place, mine/regenerate, upgrade and delete preserve registry after restart.
- [ ] Large generator fleet refuses new additions safely when persistence capacity is exceeded.
- [ ] Shop buy/sell with full/partial inventory does not grant unpaid items or lose credits silently.
- [ ] Market only lists ordinary commodities; enchanted tools cannot be listed; old unsupported listings appear for operator review.
- [ ] Restart mid-market and inspect `/scriptevent skygen:marketreview` as an operator; no sale is replayed automatically.
- [ ] Trade with both inventories full, retry after failed form, disconnect during trade; originals are not lost.
- [ ] Observe Content Log on Xbox/Realm after all test cases.
