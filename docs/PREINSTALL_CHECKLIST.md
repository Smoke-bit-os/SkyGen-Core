# Pre-install checklist — SkyGen Core v0.8.3

1. Back up the Realm. Prefer a dedicated new test world or downloaded Realm copy.
2. Confirm the world uses your intended sky/void map or prebuilt safe spawn, not an untouched normal terrain world (the add-on cannot change the world generator).
3. Confirm cheats and scripting are enabled and there is at least one free ticking-area slot.
4. Import `SkyGen_Core_v0.8.3_Preinstall_Verified.mcaddon` once; enable *both* v0.8.3 behavior and resource packs in the world and turn off the older SkyGen versions.
5. Initial join: verify you are rescued to a solid spawn platform; compass in slot 7, Spawn Horn slot 8, Plot Horn slot 9.
6. Use Plot Horn: assigned plot starter floor should form at Y=105 and player safely arrive near Y=107 after countdown. Try again from spawn after plot chunks unload, then restart world and verify same plot and balances.
7. Verify another player receives a different plot; visiting without permission fails; trusted players can build only where allowed.
8. Buy and sell 1, 16, 64, and max-quantity shop items; check Credits before and after. Exchange multiple Orbits at 18,000,000 Credits each.
9. Test generators with a single token, ore mining/respawn, upgrades, deletion, and world restart.
10. Test one ordinary marketplace listing/cancellation/sale and one item-for-item trade. Customized market items should be rejected.
11. Check logs for startup errors and try `/scriptevent skygen:debug` (player source) and `/scriptevent skygen:marketreview` (operator) if needed.
12. Only use the exact same v0.8.3 package for the live Realm after the copy passes. Never overwrite a working world without a backup.
