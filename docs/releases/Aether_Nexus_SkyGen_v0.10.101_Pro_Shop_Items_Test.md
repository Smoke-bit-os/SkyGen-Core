# Aether Nexus SkyGen v0.10.101 — Pro Shop Items Test

v0.10.101 is the latest test build. The repository's latest owner-approved stable release is [v0.10.91](Aether_Nexus_SkyGen_v0.10.91_STABLE.md).

[Download the Bedrock add-on](../../releases/Aether_Nexus_SkyGen_v0.10.101_Pro_Shop_Items_Test.mcaddon) · [Download the matching source ZIP](../../releases/Aether_Nexus_SkyGen_v0.10.101_Source.zip) · [Open the SkyGen website](https://aether-nexus-skygen.piledegret32.chatgpt.site)

## Pro Shop additions

Open Pro Shop → Utility Items & Sell-All Chest. Each confirmed purchase delivers one item using the existing Credit checkout.

| Item | Price |
| --- | --- |
| Ender Chest | 3,000 Credits |
| Pointed Dripstone | 500 Credits |
| Lava Bucket | 750 Credits |

## Features carried into this build

- Captured spawn and Nine Islands structures, floating text, and scoreboards.
- Area abilities across the Nine Islands while walking or flying.
- Capture the Flag, King of the Hill, and Generator Rush.
- 45-second join windows after two players join, with movement locked while queued.
- Melee weapon combat in Capture the Flag and King of the Hill.
- Preloaded remote arenas and chunk checks before travel.
- Operator travel through Admin Axe → Arena Teleports.

## Capture the Flag scoring

Approach the enemy flag to pick it up. Carry it to your team's colored glass stand while your own flag is home. The first team to three captures wins.

## Clean-world setup

1. Import the `.mcaddon` into Minecraft Bedrock.
2. Create a new world using the flat-world preset The Void.
3. Activate the v0.10.101 behavior and resource packs.
4. Enable cheats so the owner or an operator can run the build commands.
5. Enter the Overworld and start the spawn builder.
6. Check city and arena status before joining a game or visiting an arena.

```mcfunction
/scriptevent skyrealm:build start
/scriptevent skyrealm:build status
/scriptevent skygen:arenas status
```

Use the corresponding resume command when its builder reports a paused state.

```mcfunction
/scriptevent skyrealm:build resume
/scriptevent skygen:arenas resume
```

Get the Admin Axe as an operator, then open Arena Teleports.

```mcfunction
/scriptevent skygen:adminaxe
```

## Verification

The v0.10.101 purchase checks previously ran on Bedrock Dedicated Server 1.26.63.1 with a simulated player. They exercised the existing shop navigation and confirmation callbacks, Credit deductions, item delivery for all three additions, repeated Pointed Dripstone checkout, cancellation, insufficient Credits, and full inventory. The test fixture supplied form selections for the simulated player.

For this GitHub update, the installer and its two nested packs passed CRC checks. The source ZIP contains all 798 package files, verified byte-for-byte against the installer. All 79 JavaScript files passed syntax checks, and their relative imports resolved.

Xbox and live Realm validation of v0.10.101 is pending.

## Package and source identity

Both packs carry version `[0, 10, 101]` and minimum engine version `[1, 26, 40]`. The behavior pack depends on stable `@minecraft/server` `2.9.0` and `@minecraft/server-ui` `2.0.0`.

| File | SHA-256 |
| --- | --- |
| `Aether_Nexus_SkyGen_v0.10.101_Pro_Shop_Items_Test.mcaddon` | `f47a082ead7dab552350395e8f8e3f4ed5bb7c87141f37b37f9e0b8a16c6108e` |
| `Aether_Nexus_SkyGen_v0.10.101_Source.zip` | `2f92d03218461fe89010ee98b6f6c8e3fe46d7dc7eb62d0458bc6e9cca07310f` |
