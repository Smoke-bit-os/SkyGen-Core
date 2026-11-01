# Teleport and void-spawn specification

- Spawn platform: stone bricks, 25×25, at Y=0, centered on X=0/Z=0.
- Spawn arrival: X=0.5, Y=2, Z=0.5.
- Fresh void-world players may begin at Y=-63; move them to a safe spawn once the platform exists.
- Reserved hotbar positions (human counting): slot 7 menu compass, slot 8 spawn horn, slot 9 plot horn.
- Teleport warm-up: five seconds standing still; show 5, 4, 3, 2, 1 on screen.
- Movement cancels teleport with a visible TELEPORT CANCELLED message.
- Clear pending teleport state on success, cancellation, error, disconnect and timeout.
- Apply five-second cooldown only after successful teleport.
- Reject overlapping teleport requests.
- Never teleport to a plot before its solid landing platform is ready.
- Verify behavior with multiple players in a disposable Bedrock world.
