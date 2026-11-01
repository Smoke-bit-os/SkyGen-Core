# v0.2.6 test report and experimental patch

## User-confirmed v0.2.5 failures

- Void spawn platform builds at correct position with correct blocks.
- Spawn Horn teleport does not complete.
- Plot Horn teleport does not complete.
- Countdown shows only `5`, never 4,3,2,1.
- Movement does not cancel teleport.

## v0.2.6 experimental changes

- Replaced teleport tick loop with a defensive per-player countdown loop.
- Repaint title and action bar each tick, and send numbered chat updates every second.
- Cancel at movement exceeding 0.15 blocks on any axis, with visible message.
- Show actual teleport errors in chat, and clear pending requests on failures.
- Re-run spawn-platform setup rather than relying on a persistent ready flag.
- Repack manifests at version 0.2.6.

**Verification:** JavaScript syntax and ZIP integrity passed. No Minecraft runtime verification yet. The full v0.2.6 source remains in the experimental `.mcaddon` package, not yet committed to GitHub. The GitHub `behavior_pack/scripts/main.js` is still a separate navigation baseline.

## Required next test

On a disposable world with older packs disabled, test spawn horn, movement cancellation, plot horn, and report any red chat error text. If the countdown still sticks at 5, inspect Minecraft Content Log for script exceptions.
