# SkyGen Core v0.9.2 — Generator Token Compatibility Fix

**Minecraft Bedrock/Xbox testing build**, based on v0.9.1 Security & Stability Hardening.

Includes all 42 generators, 42 skills, 50 ranks, daily quests, plots, safe teleports, shop and 18,000,000-Credits-per-Orbit exchange, plus the v0.9.1 security protections.

## Why v0.9.2?

In-game Xbox testing uncovered a real v0.9.1 error: Bedrock does not support `ItemStack.setDynamicProperty` on stackable items, but generator tokens used ordinary eggs. Purchases failed before a Credit debit. v0.9.2 issues **non-stackable goat-horn generator tokens** so their server-issued identities can be written and read back. This preserves token replay protection.

See `docs/RELEASE_NOTES_v0.9.2.md` for details and `docs/REALM_TOKEN_TEST_v0.9.2.md` for an in-game checklist. The two existing teleport horns still function and use distinct names; generator tokens are separately named and ID-verified.

## Installing and rolling back

Back up your world and test in a copy. Import `SkyGen_Core_v0.9.2_Generator_Token_Compatibility_Fix.mcaddon`, disable previous SkyGen pack versions, and activate its behavior and resource packs. All pack UUIDs remain unchanged. Do not merge to GitHub stable `main` until tested.

Returning from the v0.9 generator bank to older v0.8.3 requires **restoring the world backup**, not just swapping packs.

## Source and tests

- Behavior pack: `behavior_pack/`, Resource pack: `resource_pack/`
- `tests/` contains automated simulated tests: **104 passed** including Bedrock stackability emulation; **not** Xbox live tests.
- `docs/` contains release notes, security testing and migration guidance.
- `releases/` includes the installable `.mcaddon`.
