# Aether Nexus SkyGen — Project Repository

## Latest owner-approved stable build: v0.10.60

**v0.10.60 STABLE** was approved following a three-player Bedrock test with no noticeable lag and all tested features working, as reported by the project owner. The released package is frozen and identified by SHA-256:

`b8a031ac0e1727676f56fd7f22376d0176a6e2caa05ffbca777b08ec328ba6b6`

**[Read the v0.10.60 release record](docs/releases/Aether_Nexus_SkyGen_v0.10.60_STABLE.md).**

> **Download status:** The v0.10.60 `.mcaddon` has **not yet been uploaded to GitHub**. The repository's currently downloadable `releases/` files and source directories represent an older v0.8.3-era snapshot. Do not install one of them expecting v0.10.60.

The original v0.10.47 baseline remains protected; new development should branch from a copy of the owner-approved v0.10.60 package, not overwrite it.

---

## Historical repository snapshot (v0.8.3)

Minecraft Bedrock / Xbox Realms behavior and resource pack. This is a single installable `.mcaddon` containing the tested code-level revisions of v0.8.2 plus focused final fixes.

## One-file install
Download `releases/SkyGen_Core_v0.8.3_Preinstall_Verified.mcaddon` and import it once using your normal Bedrock pack-install process. In world settings, deactivate old SkyGen packs and select v0.8.3 BP and RP. Make a Realm backup first; test a copy before altering the live world. Cheats must be enabled for script-run `/tickingarea` operations. The world must have an appropriate void/skyblock-style layout; this behavior pack does not replace the world generator.

## Preserved
- Original 10-button main menu, locked hotbar items, 50 ranks, plot ownership, credits, Orbits, admin manager, generators, shop, trading, and commodity marketplace
- Behavior and resource pack UUIDs and script module UUIDs identical to v0.8.2/v0.7.6; existing player data keys remain unchanged
- `@minecraft/server` and `@minecraft/server-ui` stable 2.0.0 dependencies (minimum Minecraft Bedrock 1.21.90)

## Changes since v0.8.2
- Shop quantities 1–2304 now use exact per-item Credits pricing (no mistaken bundle-multiple restriction)
- Pre-existing bedrock is not removed by a failed generator build; newly created bedrock is rolled back
- First-use Plot Horn can finish initial assignment without forcing a rejoin
- Initial spawn rescue starts earlier and avoids duplicate teleports
- Marketplace rejects keep-on-death or adventure-restricted/dynamic-property commodity stacks that would lose metadata on a type-only listing

## Verification
44 simulated checks passed (9 plot, 26 stability, 9 final pre-install). JavaScript syntax, MCADDON and nested MCPACK ZIP CRC, pack dependency graph, UUID stability, and header/module versions checked. This is not an in-game test, and real Xbox/Realm behavior is not guaranteed.

**Support:** If an older v0.8.2 copy has not yet been installed, do not install it first. Install v0.8.3 instead. Keep `main` stable until Bedrock testing.
