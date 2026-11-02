# SkyGen Core v0.8.3 — Pre-install audit release

## Final audit gate

- Source JavaScript syntax: PASS
- MCADDON outer ZIP CRC: PASS
- Two embedded MCPACK ZIP CRCs: PASS
- BP/RP dependency UUID references: PASS
- All BP/RP and module versions: 0.8.3
- UUIDs unchanged from v0.7.6 through v0.8.3: PASS
- Nine plot-teleport mock tests: PASS
- 26 v0.8.2 stability regression tests: PASS
- Nine additional pre-install mock tests: PASS
- Total: 44 passing simulations, zero failing

## Resolved in this build

1. Server Shop accepts any quantity 1–2304 at exactly calculated per-item Credits price; previous v0.8.2 incorrectly rejected non-bundle quantities.
2. Failure during generator creation cannot remove pre-existing bedrock, and new bases are rolled back if output placement fails.
3. First-use plot assignment is recovered automatically when the Plot Horn is used before the join handler has claimed a plot.
4. Initial join rescue begins immediately before profile/claim processing, with duplicate requests avoided.
5. Marketplace refuses to list otherwise ordinary commodity stacks with keep-on-death, adventure restrictions, or dynamic-property metadata because listing records cannot preserve those attributes.

## Known limitations / caution

- Automated tests simulate Bedrock; they are not Xbox or Realms integration tests.
- Commands using `/tickingarea` require cheats and available ticking-area capacity.
- Add-on creates platforms in the Overworld; it does not install a void world generator, nor clear existing terrain by force.
- Marketplace recovery cannot be fully atomic across wallet and inventory; uncertain transactions are intentionally held for manual operator review via `/scriptevent skygen:marketreview`.
- Prior v0.8.2 market restrictions on customized items remain intentional, preventing metadata loss.
- A live world backup is necessary before testing.

## Suggested final acceptance gate

Create/copy a safe test world, import v0.8.3, enable both v0.8.3 packs, then verify new join, first assignment, Plot Horn, returning to a previously assigned plot, Spawn Horn, all shop purchase quantities, Orbit exchange, generator place/mine/restart/upgrade, marketplace, trading, permissions, and restart persistence. Only promote the same installed pack to your live Realm after those checks pass.
