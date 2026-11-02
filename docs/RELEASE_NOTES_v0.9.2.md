# SkyGen Core v0.9.2 — Generator Token Compatibility Fix

## Observed Xbox failure

On Minecraft Bedrock/Xbox, attempting to buy a Cobblestone generator in v0.9.1 showed:

> Item token identity unavailable; purchase disabled. UnsupportedFunctionalityError: Cannot set dynamic properties on ...

**Root cause:** v0.9.1 used `minecraft:egg`, a stackable item, as an authenticated generator token. `ItemStack.setDynamicProperty` only supports **non-stackable** items on Bedrock stable, so token creation failed **before** the purchase debited Credits.

## Repair

- Generator tokens are now an individually named, **non-stackable `minecraft:goat_horn`** item. A valid token's server-issued ID is stored in its item dynamic property and in the existing authoritative world ledger.
- Before charging Credits, the token's stack limit is checked to be 1, its item dynamic property is set, and the ID is read back to confirm it was stored.
- Generator redemption only accepts this new token item, checks player ownership and exact token ID, atomically debits the selected inventory slot before registering a generator, and marks the record spent. All v0.9.1 anti-duplication checks remain active.
- The two locked Spawn Horn / Plot Horn tools remain unchanged. The name and ID distinguish generator tokens from teleport horns.
- Old display-name-only generator eggs are **not** automatically accepted. Using one shows an operator-recovery message. Operators should verify previous purchases before issuing a replacement with `/scriptevent skygen:tokenrestore PlayerName | Generator Name`.
- No changes were made to player profiles, plots, ranks, skill tree, 42 generator definitions, skill/credit prices, shop, quests, marketplace or existing saved generator records. Behavior and resource pack UUIDs are unchanged.

## Verification

- **104 simulated tests passed:** 69 existing gameplay/persistence checks and 35 security checks, including 4 new token compatibility cases.
- Tests now reproduce Bedrock's refusal to write dynamic properties on stackable eggs and verify that new tokens work as non-stackable items.
- JavaScript syntax, both nested `.mcpack` archives, `.mcaddon` integrity and manifest UUID dependencies checked.
- **Actual Xbox/Realm operation still requires confirmation.** In-game test a single Cobblestone generator purchase, placement and persistence before merging or replacing your live Realm.

## Safety and rollback

- Back up the world before replacing the testing packs. Unused v0.8/v0.9.0 name-only eggs require operator review and reissuance.
- Returning from v0.9.x to v0.8.3 requires restoring a **pre-upgrade world backup** because of new generator storage.
- No automatic refunds are performed for ambiguous inventory deliveries or world-property writes; use operator security diagnostics for reconciliation.
