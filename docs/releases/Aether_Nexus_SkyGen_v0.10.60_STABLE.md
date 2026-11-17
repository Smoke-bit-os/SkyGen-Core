# Aether Nexus SkyGen v0.10.60 — Owner-Approved Stable Release

**Status:** STABLE (owner designation, November 11, 2026)  
**Platform:** Minecraft Bedrock / Xbox / Realms

## Acceptance reported by project owner
- Three people participated in the latest gameplay test.
- No noticeable lag was reported.
- All features exercised during those tests were reported working.
- Owner explicitly approved v0.10.60 as the frozen stable version.

This is not a claim that every quest, security scenario, rank, hardware configuration, or larger Realm population has been tested.

## Artifact identity

- Expected package: `Aether_Nexus_SkyGen_v0.10.60_STABLE.mcaddon`
- SHA-256: `b8a031ac0e1727676f56fd7f22376d0176a6e2caa05ffbca777b08ec328ba6b6`
- Behavior pack / resource pack: `0.10.60` / `0.10.60`
- This package was copied byte-for-byte from the previously tested v0.10.60 compact-scoreboard candidate and its archives passed CRC checks.

[Download the verified v0.10.60 add-on](../../releases/Aether_Nexus_SkyGen_v0.10.60_STABLE.mcaddon) · [Download its full source ZIP](../../releases/Aether_Nexus_SkyGen_v0.10.60_Source.zip) · [Check SHA-256 hashes](../../releases/SHA256SUMS_v0.10.60.txt)

The source ZIP contains all 550 files from the stable package under `behavior_pack/` and `resource_pack/`. The package matches the SHA-256 recorded above.

## Major features included in the reported stable build

- 1,000 ranks and rank Codex groups of 100
- 1,000 quest definitions, including Ascended and weekly Elite contracts
- Credits, Orbits, bank, trading, shops, and dual-currency approved elite purchases
- 42 private generator types, 50 public mine output locations, nine city districts
- Personal right-side HUD with compact scoreboard and three cosmetic badge icons
- Xbox-first navigation, 26-zone World Builder, and performance/security hardening

## Frozen-release policy

- Protected historic baseline: v0.10.47
- Owner-approved frozen stable reference: v0.10.60
- Future work must branch to a new version; do not silently alter this release.
- Keep a world backup before any Realm replacement.

## Recommended future regression coverage
- Restart/disconnect and exactly-once economic transactions
- Generator ownership and token recovery under multiplayer activity
- Higher rank/quest XP and wallet cap behavior
- Larger population, Xbox UI scale and long-duration Realm load testing
