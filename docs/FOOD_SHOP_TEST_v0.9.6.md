# Xbox Food Shop Test Checklist

- [ ] Back up the world and import both v0.9.6 behavior and resource packs; deactivate older SkyGen packs.
- [ ] Open slot-7 compass, main menu displays **Food Shop** directly below **Server Shop**.
- [ ] Food Shop opens Buy / Sell / Back and five food categories.
- [ ] Confirm 25 exact vanilla foods and prices; check all five categories and navigation.
- [ ] Purchase 1 Bread, then 16 Steak, then 64 Cooked Salmon. Credits change once, exact items delivered.
- [ ] Purchase a Mushroom Stew and Rabbit Stew (non-stackable); inventory handles each one in a distinct slot.
- [ ] Full inventory and insufficient Credits block purchases without changing balances.
- [ ] Cancel category, quantity, and transaction confirmation; no items or Credits changed.
- [ ] Sell 1 plain Bread and 16 plain Apples; Credits awarded, items deducted.
- [ ] Rename a Food item; ensure it cannot be sold via the standard shop.
- [ ] Buy or sell 0, negative, decimal, >2304 items (each should be rejected).
- [ ] Retest old Server Shop, original six generator purchases, one 3D base, new Help page `/scriptevent skygen:help food`, Spawn Horn, Plot Horn.
- [ ] Leave and restart test world: existing Credits, Orbits, skill points, ranks and generator records preserved.
- [ ] Test at least one shop transaction with two players online.
