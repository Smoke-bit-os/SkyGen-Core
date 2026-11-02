# SkyGen v0.9.2 — Xbox Generator Token Smoke Test

Test on a **backup world** with cheats enabled, and activate *only* the v0.9.2 behavior and resource packs.

1. Join and confirm existing Plot Horn (slot 9) and Spawn Horn (slot 8) still teleport.
2. Check your Credits amount. Buy **one Cobblestone generator** (500 Credits before any skill discount).
3. Confirm the purchase succeeds without the red UnsupportedFunctionalityError. The new token looks like a **goat horn**, is named `SkyGen Cobblestone Generator`, and occupies one inventory slot.
4. Confirm Credits decrease **only once**, and there is exactly one issued token.
5. On your own plot, look at a suitable block with two empty spaces above and use the new named generator token.
6. Confirm it consumes exactly once, creates the bedrock base and cobblestone output, and cannot be reused.
7. Confirm the original two teleport horns retain their functions.
8. Restart the test world; confirm generator, wallet, original plot and skills persist.
9. Test a forged horn renamed to `SkyGen Cobblestone Generator` but without a server-issued ID; it must **not** create a generator.
10. Test an old name-only generator egg; it must not generate a block or consume Credits, and should tell you to contact the operator.

If any step fails, send the exact red error and the step number. Keep v0.9.1 / v0.9.2 off the live Realm until this passes.
