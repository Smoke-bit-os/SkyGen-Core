import { world, system, ItemStack, ItemLockMode } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

// SkyGen Core foundation: void spawn + three tools + cancellable teleports.
// This is a clean baseline; plots/economy from v0.2.4 still require migration.
const SPAWN = { x: 0.5, y: 2, z: 0.5 };
const WARMUP = 100, COOLDOWN = 100;
const pending = new Map(), cooldown = new Map();
const TOOLS = [
  { slot: 6, type: "minecraft:compass", name: "§bSkyGen Menu" },
  { slot: 7, type: "minecraft:goat_horn", name: "§6Go to Spawn" },
  { slot: 8, type: "minecraft:goat_horn", name: "§aGo to Plot" }
];
function say(p, message) { try { p.onScreenDisplay.setActionBar(message); } catch {} }
function title(p, message, color = "§e") {
  try { p.onScreenDisplay.setTitle(color + message, { fadeInDuration: 0, stayDuration: 20, fadeOutDuration: 0 }); } catch {}
}
function spawnPlatform() {
  const d = world.getDimension("overworld");
  // Use command fill because the 25x25 area may not be loaded block-by-block.
  try { d.runCommand("fill -12 0 -12 12 0 12 stone_bricks"); } catch {}
  try { d.runCommand("setworldspawn 0 2 0"); } catch {}
}
function ensureTools(p) {
  const inv = p.getComponent("minecraft:inventory")?.container;
  if (!inv) return;
  for (const t of TOOLS) {
    const item = inv.getItem(t.slot);
    if (item?.typeId === t.type && item.nameTag === t.name) continue;
    const tool = new ItemStack(t.type, 1);
    tool.nameTag = t.name;
    tool.lockMode = ItemLockMode.slot;
    tool.keepOnDeath = true;
    try { inv.setItem(t.slot, tool); } catch {}
  }
}
function cancel(p, why = "TELEPORT CANCELLED") {
  pending.delete(p.id);
  title(p, why, "§c");
  say(p, "§c" + why);
}
function begin(p, destination) {
  if (pending.has(p.id)) { say(p, "§eTeleport already counting down"); return; }
  if ((cooldown.get(p.id) ?? 0) > system.currentTick) { say(p, "§cTeleport cooling down"); return; }
  const start = { ...p.location };
  pending.set(p.id, { start, destination, dimension: p.dimension.id, startTick: system.currentTick, lastShown: -1 });
  title(p, "5");
}
function showMenu(p) {
  const form = new ActionFormData().title("SkyGen Core").body("Choose a destination").button("Go to Spawn").button("Go to Plot");
  form.show(p).then(r => { if (r.canceled) return; if (r.selection === 0) begin(p, SPAWN); else if (r.selection === 1) plot(p); }).catch(() => {});
}
function plot(p) {
  const raw = p.getDynamicProperty("sg_plot");
  if (typeof raw !== "string") { say(p, "§cYou need a plot before teleporting"); return; }
  let pos;
  try { pos = JSON.parse(raw); } catch { say(p, "§cPlot data is invalid"); return; }
  if (![pos.x, pos.y, pos.z].every(Number.isFinite)) return;
  begin(p, { x: pos.x + 0.5, y: pos.y + 2, z: pos.z + 0.5 });
}
world.afterEvents.itemUse.subscribe(e => {
  const p = e.source;
  if (p.typeId !== "minecraft:player") return;
  const slot = p.selectedSlotIndex;
  if (slot === 6 && e.itemStack?.nameTag === TOOLS[0].name) showMenu(p);
  else if (slot === 7 && e.itemStack?.nameTag === TOOLS[1].name) begin(p, SPAWN);
  else if (slot === 8 && e.itemStack?.nameTag === TOOLS[2].name) plot(p);
});
world.afterEvents.playerSpawn.subscribe(e => {
  system.runTimeout(() => {
    try {
      spawnPlatform();
      ensureTools(e.player);
      // Rescue players starting in void superflat worlds.
      if (e.player.location.y < -50) e.player.teleport(SPAWN, { dimension: world.getDimension("overworld") });
    } catch {}
  }, 20);
});
system.runInterval(() => {
  for (const p of world.getAllPlayers()) {
    ensureTools(p);
    const task = pending.get(p.id);
    if (!task) continue;
    const here = p.location;
    if (p.dimension.id !== task.dimension || Math.abs(here.x - task.start.x) > 0.2 ||
        Math.abs(here.y - task.start.y) > 0.2 || Math.abs(here.z - task.start.z) > 0.2) {
      cancel(p); continue;
    }
    const elapsed = system.currentTick - task.startTick;
    if (elapsed > 140) { cancel(p, "TELEPORT TIMED OUT"); continue; }
    const remaining = Math.max(1, Math.ceil((WARMUP - elapsed) / 20));
    if (elapsed < WARMUP && remaining !== task.lastShown) {
      task.lastShown = remaining;
      title(p, String(remaining));
      say(p, "§eTeleporting in " + remaining + " — stand still");
    }
    if (elapsed >= WARMUP) {
      pending.delete(p.id);
      try {
        p.teleport(task.destination, { dimension: world.getDimension("overworld") });
        cooldown.set(p.id, system.currentTick + COOLDOWN);
        title(p, "TELEPORTED!", "§a");
      } catch { title(p, "TELEPORT FAILED", "§c"); }
    }
  }
  for (const id of pending.keys()) if (!world.getAllPlayers().some(p => p.id === id)) pending.delete(id);
}, 1);
system.runTimeout(spawnPlatform, 40);
