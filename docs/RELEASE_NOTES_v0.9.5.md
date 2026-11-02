# SkyGen Core v0.9.5 — Command Help (testing)

- Adds `/scriptevent skygen:help`, `/scriptevent skygen:help generators`, `/scriptevent skygen:help admin` and `/scriptevent skygen:help all`.
- Operator-only pages require `isOperator` and never mutate wallets, ranks or permissions.
- Covers all seven pre-existing SkyGen command IDs plus `skygen:help`, with usage examples and generator menu pointers.
- Changes only the command listener, help display function, version metadata, documentation, and new regression tests.
- Retains the original BP/RP/module UUIDs; all saved player/world property keys; all 42 custom in-world generator cores, 126 face textures and 42 custom item textures.
- No generator, item, shop, permission, trading, plot or data migration change.
- **Compatibility:** Bedrock 1.21.100 or later. Install on a backed-up test world and check Xbox chat before updating live Realm. No in-game testing performed by the assistant.
