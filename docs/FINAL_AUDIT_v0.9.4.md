# v0.9.4 Release-Gate Audit

- 42/42 distinct registered core block IDs; 42/42 retained item identifiers.
- 126/126 original opaque 64×64 top/side/bottom block PNG files, 42/42 existing item icons; **168 unique PNGs**.
- 126/126 terrain atlas mappings and per-face `minecraft:material_instances` records validated.
- Mining/explosion false, piston immovable, geometry/full-block and collision components tested statically.
- Generator placement, heartbeat migration, deletion, operator output, rollback and block protection updated.
- 141/141 simulated checks pass (test_generator_cores_v094.cjs=27, test_security_v091.cjs=45, test_skygen_v081.cjs=9, test_skygen_v090.cjs=25, test_skygen_v090_legacy.cjs=26, test_skygen_v090_preinstall.cjs=9).
- No changes to existing pack UUIDs or player/world save keys.
- 2 nested valid MCPACK files; all archive CRC checks pass. Minimum supported Bedrock engine 1.21.100.
- **Not tested on actual Xbox/Realm**; restore pre-upgrade backup to downgrade, and do not merge to stable until verified.

## SHA-256
- MCADDON `5ea0391276981d2371f436819820fa9d5bc6d77bd09d535f177b1a6c838a3706`
- Source ZIP `380fad6e906f9525a74499454ade3ef7564daa5899b531b2d31801e12dff7c97`
- JavaScript `2da5f67c1532ed05f1c0c592e20ece16ad15b807f6c6f0be4142d00138a8b117`
