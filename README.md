# SkyGen Core v0.9.3 — Custom Generator Items (Xbox Test Build)

All **42** generators now have individually named, non-stackable Bedrock custom items and distinct **64×64 transparent PNG** item icons. Players receive named custom generator cores instead of goat horns when purchasing. The existing secure per-token dynamic property ID and server-side issuance/redeem ledger remain mandatory.

**Previously issued v0.9.2 generator goat horns still work** through their existing verified-use handler. The original locked Spawn Horn and Plot Horn are unchanged. Old unverifiable name-only eggs remain blocked and require operator verification.

Using these new items relies on a Bedrock 2.0 custom item component (`skygen:generator_token_use`) registered via `system.beforeEvents.startup`. It handles `onUse` and `onUseOn` and routes both into the original token validation and placement path. If registration fails, new purchases fail closed rather than charge players for unusable items. Actual Xbox testing is essential.

See `docs/RELEASE_NOTES_v0.9.3.md` and `docs/REALM_CUSTOM_ITEM_TEST_v0.9.3.md`.

Do not install in the live Realm or merge the stable GitHub branch before the Xbox test-world checklist passes. Back up world data first. Downgrading v0.9.x to v0.8.3 requires a pre-upgrade world backup because generator storage is banked.
