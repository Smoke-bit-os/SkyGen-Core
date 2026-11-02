# v0.9.5 Xbox Help Smoke Test

- [ ] Back up world and install both BP/RP v0.9.5; disable older active SkyGen packs.
- [ ] Chat: `/scriptevent skygen:help` shows player command list.
- [ ] Chat: `/scriptevent skygen:help generators` explains placement and menu navigation.
- [ ] As operator: `/scriptevent skygen:help admin` shows all operator commands.
- [ ] As non-operator with command access: `skygen:help admin` refuses to reveal operator page. If Xbox denies `/scriptevent` before script execution, that is game permission enforcement.
- [ ] Chat: `/scriptevent skygen:help all` gives operator help only to operators.
- [ ] Unknown help topic displays usage rather than failing.
- [ ] Compass, teleport horns, admin axe and original SkyGen commands still work.
- [ ] Existing and new 3D generator cores render/regenerate after restart with no data loss.
- [ ] Recheck operator permissions and saved balances after restarting.
