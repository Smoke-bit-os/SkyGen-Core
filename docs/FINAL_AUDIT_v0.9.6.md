# SkyGen v0.9.6 — Food Shop Release Audit

- New Food Shop button next to unchanged Server Shop; same underlying purchase/sale engine.
- 25 named vanilla food SKUs in 5 categories: Basics 6, Cooked Meats 5, Seafood 3, Snacks 5, Premium 6.
- Buy/sell supports whole number quantities 1–2304, confirms Credit cost, checks capacity and balances, and rejects named/lore/locked sale items.
- No pack UUIDs or persistent dynamic property keys modified. v0.9.5 generator code and assets retained.
- 42 custom generator blocks, 126 block-face PNGs, 42 inventory token items and 42 icon PNGs retained.
- **185/185 simulated regression tests passed:**
  - test_food_shop_v096.cjs: 31 passing
  - test_generator_cores_v094.cjs: 27 passing
  - test_help_v095.cjs: 13 passing
  - test_security_v091.cjs: 45 passing
  - test_skygen_v081.cjs: 9 passing
  - test_skygen_v090.cjs: 25 passing
  - test_skygen_v090_legacy.cjs: 26 passing
  - test_skygen_v090_preinstall.cjs: 9 passing
- Minecraft Xbox in-game tests have **not** been performed in this environment.
- Existing shop transactions cannot be made atomic across inventory and profile writes; partial transactions require operator review. Back up Realm first.
