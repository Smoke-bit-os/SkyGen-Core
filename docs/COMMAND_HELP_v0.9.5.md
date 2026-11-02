# SkyGen Core v0.9.5 — Command Help

Execute as an authorized player in Minecraft Bedrock chat with command permissions:

| Command | Access | Result |
| --- | --- | --- |
| `/scriptevent skygen:help` | Players with command access | Lists general commands |
| `/scriptevent skygen:help player` | Players with command access | Lists general commands |
| `/scriptevent skygen:help generators` | Players with command access | Shows generator UI / placement tips |
| `/scriptevent skygen:help admin` | Realm operators | Lists operator-only commands |
| `/scriptevent skygen:help all` | Players with command access | General commands; operators additionally see operator page |
| `/scriptevent skygen:menu` | Players with command access | Opens SkyGen menu |
| `/scriptevent skygen:debug` | Players with command access | Diagnostic permission status |
| `/scriptevent skygen:adminaxe` | SkyGen admins | Get/locate Admin Axe |
| `/scriptevent skygen:admin grant PlayerName` | Realm operators | Grant SkyGen admin to exact-name online player |
| `/scriptevent skygen:admin revoke PlayerName` | Realm operators | Revoke SkyGen admin |
| `/scriptevent skygen:security` | Realm operators | Inspect questionable tokens / trade records |
| `/scriptevent skygen:marketreview` | Realm operators | Inspect marketplace review cases |
| `/scriptevent skygen:tokenrestore PlayerName | Cobblestone` | Realm operators | Replace verified old token; check purchase before using |

This help does not grant command privileges: Bedrock permissions/cheats may prevent non-operators from running `/scriptevent` at all. The script requires a **player-origin** command: command-block/console execution lacks the player source and is ignored. The normal locked compass/horns continue working without typing anything.
