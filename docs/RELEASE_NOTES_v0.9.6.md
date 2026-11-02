# SkyGen Core v0.9.6 — In-Menu Food Shop

- Main menu adds **Food Shop** directly after Server Shop; no tab redesign.
- 25 vanilla Bedrock foods, across Basics (6), Cooked Meats (5), Seafood (3), Snacks (5), Premium (6).
- Buy and sell Credits via the **same** quantity, inventory capacity, named/lore/locked-item restrictions and confirmation flow as the existing Server Shop.
- Multi-stack purchases split by the actual Bedrock item `maxAmount` so soup and other non-stackable food is supported.
- Original Server Shop catalog, prices and layout unchanged. Premium food is expensive enough to avoid trivializing survival. No separate food currency, new dynamic properties or world data migrations.
- New `/scriptevent skygen:help food` topic; normal compass can access shop without command permissions.
- The existing resale logic is not fully atomic across player inventory and profile storage; uncertain outcomes require operator review, and a shop delivery/storage failure will not issue unverified refunds. Test in a world copy.
- All v0.9.5 42 generator items, 42 in-world base blocks, 126 block-face textures, 42 item icons, UUIDs and player data preserved.
