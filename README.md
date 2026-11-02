# SkyGen Core v0.9.4 — Custom Generator Bases

42 unique generator inventory items (v0.9.3) + 42 matching full-cube in-world custom generator blocks.
Each block uses an original 64×64 top, side and bottom texture: 126 block-face textures, plus the preserved 42 inventory icons.

**Install the .mcaddon on a copied world with matching behavior and resource packs. Minimum Minecraft Bedrock 1.21.100.**

The registered generator base at Y is now `skygen:<name>_generator_core`, generated material remains at Y+1. Previously registered bedrock bases convert only in loaded chunks via the normal heartbeat. User data, pack UUIDs and generator prices remain untouched. Never downgrade without a pre-upgrade world backup.

See `docs/XBOX_REALM_TEST_CHECKLIST_v0.9.4.md`, `docs/RELEASE_NOTES_v0.9.4.md`, and `docs/v0.9.4_42_block_texture_audit.csv`.

141 simulated regression checks passed; Xbox/Realm verification still required.
