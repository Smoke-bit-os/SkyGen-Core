import {world,system,ItemStack,ItemLockMode} from '@minecraft/server';
import {ActionFormData,ModalFormData,MessageFormData} from '@minecraft/server-ui';
const C={spawn:{x:0.5,y:2,z:0.5},base:{x:512,y:106,z:512},spacing:128,columns:8,radius:24,warmup:100,cooldown:100,exchange:18000000};
const TOOLS=[{slot:6,type:'minecraft:compass',name:'§bSkyGen Menu'},{slot:7,type:'minecraft:goat_horn',name:'§6Go to Spawn'},{slot:8,type:'minecraft:goat_horn',name:'§aGo to Plot'}];
const GENS=[
 {"name":"Cobblestone","block":"minecraft:cobblestone","cost":500,"period":200,"category":"Starter","unlock":1},
 {"name":"Coal","block":"minecraft:coal_ore","cost":2500,"period":300,"category":"Mining","unlock":1},
 {"name":"Iron","block":"minecraft:iron_ore","cost":10000,"period":400,"category":"Mining","unlock":1},
 {"name":"Gold","block":"minecraft:gold_ore","cost":40000,"period":500,"category":"Mining","unlock":1},
 {"name":"Diamond","block":"minecraft:diamond_ore","cost":200000,"period":600,"category":"Mining","unlock":1},
 {"name":"Emerald","block":"minecraft:emerald_ore","cost":500000,"period":800,"category":"Mining","unlock":1},
 {"name":"Stone","block":"minecraft:stone","cost":700,"period":220,"category":"Starter","unlock":2},
 {"name":"Deepslate","block":"minecraft:deepslate","cost":1100,"period":220,"category":"Starter","unlock":3},
 {"name":"Dirt","block":"minecraft:dirt","cost":500,"period":180,"category":"Starter","unlock":1},
 {"name":"Gravel","block":"minecraft:gravel","cost":900,"period":220,"category":"Starter","unlock":3},
 {"name":"Sand","block":"minecraft:sand","cost":950,"period":220,"category":"Starter","unlock":3},
 {"name":"Clay","block":"minecraft:clay","cost":1200,"period":260,"category":"Starter","unlock":4},
 {"name":"Oak Logs","block":"minecraft:oak_log","cost":1800,"period":240,"category":"Starter","unlock":4},
 {"name":"Spruce Logs","block":"minecraft:spruce_log","cost":2200,"period":260,"category":"Starter","unlock":5},
 {"name":"Birch Logs","block":"minecraft:birch_log","cost":2200,"period":260,"category":"Starter","unlock":5},
 {"name":"Cherry Logs","block":"minecraft:cherry_log","cost":4500,"period":280,"category":"Starter","unlock":8},
 {"name":"Mangrove Logs","block":"minecraft:mangrove_log","cost":5200,"period":300,"category":"Starter","unlock":10},
 {"name":"Copper","block":"minecraft:copper_ore","cost":7500,"period":320,"category":"Mining","unlock":8},
 {"name":"Redstone","block":"minecraft:redstone_ore","cost":18000,"period":380,"category":"Mining","unlock":12},
 {"name":"Lapis Lazuli","block":"minecraft:lapis_ore","cost":24000,"period":440,"category":"Mining","unlock":16},
 {"name":"Nether Quartz","block":"minecraft:nether_quartz_ore","cost":30000,"period":500,"category":"Mining","unlock":18},
 {"name":"Nether Gold","block":"minecraft:nether_gold_ore","cost":60000,"period":560,"category":"Mining","unlock":20},
 {"name":"Moss","block":"minecraft:moss_block","cost":15000,"period":300,"category":"Nature","unlock":15},
 {"name":"Netherrack","block":"minecraft:netherrack","cost":17500,"period":300,"category":"Nature","unlock":16},
 {"name":"Soul Sand","block":"minecraft:soul_sand","cost":21000,"period":360,"category":"Nature","unlock":18},
 {"name":"Basalt","block":"minecraft:basalt","cost":26000,"period":380,"category":"Nature","unlock":20},
 {"name":"Blackstone","block":"minecraft:blackstone","cost":32000,"period":400,"category":"Nature","unlock":22},
 {"name":"Glowstone","block":"minecraft:glowstone","cost":55000,"period":480,"category":"Nature","unlock":25},
 {"name":"Magma","block":"minecraft:magma","cost":65000,"period":500,"category":"Nature","unlock":27},
 {"name":"Calcite","block":"minecraft:calcite","cost":72000,"period":520,"category":"Nature","unlock":30},
 {"name":"Tuff","block":"minecraft:tuff","cost":76000,"period":520,"category":"Nature","unlock":30},
 {"name":"Amethyst Block","block":"minecraft:amethyst_block","cost":100000,"period":560,"category":"Nature","unlock":35},
 {"name":"Obsidian","block":"minecraft:obsidian","cost":150000,"period":650,"category":"Endgame","unlock":30},
 {"name":"Prismarine","block":"minecraft:prismarine","cost":165000,"period":660,"category":"Endgame","unlock":32},
 {"name":"Sea Lantern","block":"minecraft:sea_lantern","cost":190000,"period":700,"category":"Endgame","unlock":34},
 {"name":"End Stone","block":"minecraft:end_stone","cost":220000,"period":720,"category":"Endgame","unlock":36},
 {"name":"Purpur Block","block":"minecraft:purpur_block","cost":260000,"period":740,"category":"Endgame","unlock":38},
 {"name":"Sculk","block":"minecraft:sculk","cost":330000,"period":760,"category":"Endgame","unlock":40},
 {"name":"Crying Obsidian","block":"minecraft:crying_obsidian","cost":420000,"period":800,"category":"Endgame","unlock":42},
 {"name":"Gilded Blackstone","block":"minecraft:gilded_blackstone","cost":520000,"period":840,"category":"Endgame","unlock":44},
 {"name":"Shroomlight","block":"minecraft:shroomlight","cost":620000,"period":880,"category":"Endgame","unlock":46},
 {"name":"Ancient Debris","block":"minecraft:ancient_debris","cost":1900000,"period":1600,"category":"Endgame","unlock":48}
];

// Stable namespaced item IDs. Keep these unchanged across future versions so
// previously purchased unused custom tokens remain valid.
const GENERATOR_ITEM_BY_NAME=new Map(GENS.map(g=>[g.name,'skygen:generator_'+g.name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')]));
const GENERATOR_ITEM_TYPE_IDS=new Set(GENERATOR_ITEM_BY_NAME.values());
function generatorItemId(g){return GENERATOR_ITEM_BY_NAME.get(g.name)}
// Names of the 42 registered in-world cores are stable; changing IDs would
// orphan already-placed custom blocks in saved Realm chunks.
const GENERATOR_CORE_BY_NAME=new Map(GENS.map(g=>[g.name,'skygen:'+g.name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')+'_generator_core']));
function generatorCoreType(g){return GENERATOR_CORE_BY_NAME.get(g.type||g.name)||''}
function isGeneratorBase(g,base){return !!base&&(base.typeId===generatorCoreType(g)||base.typeId==='minecraft:bedrock')}
// Only migrate a bedrock block directly backed by an authenticated registry
// record; no chunk force-loading, scanning, or replacement of player builds.
function migrateGeneratorCore(g,base){
 const expected=generatorCoreType(g);
 if(!expected||!base)return false;
 if(base.typeId===expected)return true;
 if(base.typeId!=='minecraft:bedrock')return false;
 base.setType(expected);
 if(world.getDimension('overworld').getBlock({x:g.x,y:g.y,z:g.z})?.typeId!==expected)throw Error('Generator core migration not verified at '+g.x+','+g.y+','+g.z);
 return true;
}
function validTokenItemType(type,name){return type==='minecraft:goat_horn'||type===GENERATOR_ITEM_BY_NAME.get(name)}
const SHOP=[{name:'Cobblestone × 16',id:'minecraft:cobblestone',count:16,buy:80,sell:16},{name:'Oak Logs × 16',id:'minecraft:oak_log',count:16,buy:160,sell:32},{name:'Iron Ingots × 8',id:'minecraft:iron_ingot',count:8,buy:400,sell:80},{name:'Diamond × 1',id:'minecraft:diamond',count:1,buy:500,sell:100},{"name":"Stone","id":"minecraft:stone","count":16,"buy":128,"sell":32,"category":"Starter"},{"name":"Dirt","id":"minecraft:dirt","count":16,"buy":64,"sell":16,"category":"Starter"},{"name":"Gravel","id":"minecraft:gravel","count":16,"buy":128,"sell":32,"category":"Starter"},{"name":"Sand","id":"minecraft:sand","count":16,"buy":128,"sell":32,"category":"Starter"},{"name":"Clay","id":"minecraft:clay_ball","count":16,"buy":160,"sell":32,"category":"Starter"},{"name":"Spruce Logs","id":"minecraft:spruce_log","count":16,"buy":192,"sell":48,"category":"Starter"},{"name":"Birch Logs","id":"minecraft:birch_log","count":16,"buy":192,"sell":48,"category":"Starter"},{"name":"Cherry Logs","id":"minecraft:cherry_log","count":16,"buy":320,"sell":80,"category":"Starter"},{"name":"Copper Ingots","id":"minecraft:copper_ingot","count":8,"buy":280,"sell":64,"category":"Ores"},{"name":"Coal","id":"minecraft:coal","count":16,"buy":240,"sell":48,"category":"Ores"},{"name":"Gold Ingots","id":"minecraft:gold_ingot","count":8,"buy":800,"sell":160,"category":"Ores"},{"name":"Redstone Dust","id":"minecraft:redstone","count":16,"buy":240,"sell":64,"category":"Ores"},{"name":"Lapis Lazuli","id":"minecraft:lapis_lazuli","count":16,"buy":288,"sell":64,"category":"Ores"},{"name":"Emerald","id":"minecraft:emerald","count":1,"buy":1500,"sell":300,"category":"Ores"},{"name":"Nether Quartz","id":"minecraft:quartz","count":16,"buy":320,"sell":64,"category":"Nether"},{"name":"Netherrack","id":"minecraft:netherrack","count":16,"buy":128,"sell":32,"category":"Nether"},{"name":"Soul Sand","id":"minecraft:soul_sand","count":8,"buy":160,"sell":40,"category":"Nether"},{"name":"Blackstone","id":"minecraft:blackstone","count":16,"buy":480,"sell":128,"category":"Nether"},{"name":"Glowstone Dust","id":"minecraft:glowstone_dust","count":16,"buy":640,"sell":160,"category":"Nether"},{"name":"Magma Cream","id":"minecraft:magma_cream","count":8,"buy":800,"sell":200,"category":"Nether"},{"name":"Obsidian","id":"minecraft:obsidian","count":4,"buy":1200,"sell":320,"category":"Endgame"},{"name":"Prismarine","id":"minecraft:prismarine","count":8,"buy":1600,"sell":400,"category":"Endgame"},{"name":"End Stone","id":"minecraft:end_stone","count":8,"buy":1600,"sell":400,"category":"Endgame"},{"name":"Sculk","id":"minecraft:sculk","count":8,"buy":2400,"sell":640,"category":"Endgame"}];
const pending=new Map(),cooldowns=new Map(),generators=new Map(),trades=new Map(),visitRequests=new Map();
const genEmptySeconds=new Map();
let genWatchdogRuns=0, genLastTick=-1, genLastError="none", genStartupTick=system.currentTick;
const genErrors=[];
// Register commands early so a later optional event subscription cannot disable them.
try{
 system.afterEvents.scriptEventReceive.subscribe(e=>{
  if(!['skygen:menu','skygen:adminaxe','skygen:admin','skygen:debug','skygen:marketreview','skygen:security','skygen:tokenrestore'].includes(e.id))return;
  const actor=e.sourceEntity;
  console.warn('[SkyGen CMD] received '+e.id+' source='+e.sourceType+' player='+(actor?.name||'none'));
  if(!actor||actor.typeId!=='minecraft:player'){console.warn('[SkyGen CMD] no player source; use command from player chat');return;}
  try{actor.sendMessage('§7SkyGen received '+e.id+(e.message?' '+e.message:''));}catch{}
  system.run(()=>{
   try{
    if(e.id==='skygen:menu')menu(actor);
    else if(e.id==='skygen:adminaxe')issueAdminAxe(actor);
    else if(e.id==='skygen:admin')adminCommand(actor,e.message);
    else if(e.id==='skygen:marketreview')marketReviewCommand(actor);
    else if(e.id==='skygen:security')securityReviewCommand(actor);
    else if(e.id==='skygen:tokenrestore')adminTokenRestore(actor,e.message);
    else actor.sendMessage('§aSkyGen command handler active. OP='+isOperator(actor)+' Admin='+isAdmin(actor)+' PermissionLevel='+String(actor.playerPermissionLevel)+' isOpAPI='+String(typeof actor.isOp));
   }catch(err){console.warn('[SkyGen CMD] '+err);try{actor.sendMessage('§cSkyGen command error: '+err)}catch{}}
  });
 });
 console.warn('[SkyGen CMD] command listener registered');
}catch(err){console.warn('[SkyGen CMD] LISTENER REGISTRATION FAILED '+err)}

const GEN_REGISTRY_LIMIT=1200, GEN_REGISTRY_BYTES=12000, GEN_REGISTRY_SHARDS=24;
const GEN_STORAGE_META='sg_generators_v2_commit', GEN_STORAGE_LEGACY='sg_generators';
const GEN_BASE_SLOTS=20;
const genErrorTick=new Map();
function genError(message,key='general'){
 genLastError=String(message);
 const now=system.currentTick,last=genErrorTick.get(key)??-99999;
 if(now-last<1200)return;
 genErrorTick.set(key,now);
 genErrors.push(`${now}: ${genLastError}`);
 if(genErrors.length>20)genErrors.shift();
 console.warn('SkyGen generator: '+genLastError);
}
// Register the generator heartbeat BEFORE optional UI/event subscriptions.
// A later unsupported event must not prevent generator processing.
// Schedule independently with runTimeout; this path is independent of other intervals.
function generatorHeartbeat(){
 try{genWatchdog()}catch(e){genError('heartbeat '+e)}
 finally{system.runTimeout(generatorHeartbeat,20)}
}
system.runTimeout(generatorHeartbeat,20);
system.runTimeout(()=>{try{genLoad()}catch(e){console.warn('SkyGen generator loading: '+e)}},40);
const MAX_LISTINGS=80, MARKET_KEY='sg_market_v1';
const keyForPlot=id=>'sg_plot_'+id;
function ownerId(id){return String(world.getDynamicProperty(keyForPlot(id))||'')}
function trusted(id){try{return JSON.parse(String(world.getDynamicProperty('sg_trust_'+id)||'[]'))}catch{return []}}
function canBuild(p,id){return id>=0&&(ownerId(id)===p.id||trusted(id).includes(p.id))}
function visitors(id){try{const a=JSON.parse(String(world.getDynamicProperty('sg_visitors_'+id)||'[]'));return Array.isArray(a)?a:[]}catch{return []}}
let interactionGuardAvailable=false;
function canVisit(p,id){
 if(id<0)return false;
 if(ownerId(id)===p.id)return true;
 // Do not admit visitors when the stable container-interaction guard is missing.
 return interactionGuardAvailable&&(visitors(id).includes(p.id)||trusted(id).includes(p.id));
}
function setVisit(id,ids){world.setDynamicProperty('sg_visitors_'+id,JSON.stringify([...new Set(ids)]))}

function protectedAt(p,x,z){if(p.dimension?.id!=='minecraft:overworld')return false;if(inSpawn(x,z))return true;const id=plotAt(x,z);return id>=0&&!canBuild(p,id)}
function marketRead(){
 const raw=world.getDynamicProperty(MARKET_KEY);
 if(raw===undefined||raw===null)return [];
 let records;
 try{records=JSON.parse(String(raw))}catch{throw Error('Market data corrupt: preserving original data. Operator recovery required.')}
 if(!Array.isArray(records))throw Error('Market data has invalid structure; refusing overwrite.');
 return records;
}
function marketSave(v){
 const json=JSON.stringify(v);
 if(json.length>30000)throw Error('Marketplace persistence capacity exhausted');
 world.setDynamicProperty(MARKET_KEY,json);
 if(world.getDynamicProperty(MARKET_KEY)!==json)throw Error('Marketplace write verification failed');
 return true;
}
function inventory(p){return p.getComponent('minecraft:inventory')?.container}
function itemChoices(p){const inv=inventory(p),a=[];if(!inv)return a;for(let slot=0;slot<inv.size;slot++){const it=inv.getItem(slot);if(it&&!isTool(it)&&it.lockMode===ItemLockMode.none&&it.typeId!=='minecraft:air'&&!it.nameTag?.startsWith('§bSkyGen '))a.push({slot,it})}return a}
function fit(p,it){const inv=inventory(p);if(!inv)return false;for(let i=0;i<inv.size;i++){const q=inv.getItem(i);if(!q)return true;if(q.typeId===it.typeId&&!q.nameTag&&!it.nameTag&&q.amount+it.amount<=q.maxAmount)return true}return false}
function give(p,it){return !inventory(p)?.addItem(it)}
function removeExact(p,slot,id,count){const inv=inventory(p),it=inv?.getItem(slot);if(!it||it.typeId!==id||it.amount<count||isTool(it)||it.lockMode!==ItemLockMode.none)return false;if(it.amount===count)inv.setItem(slot,undefined);else{it.amount-=count;inv.setItem(slot,it)}return true}
function buildGenerator(g){
 const dim=world.getDimension('overworld');
 const base=dim.getBlock({x:g.x,y:g.y,z:g.z});
 const output=dim.getBlock({x:g.x,y:g.y+1,z:g.z});
 if(!base||!output)return false;
 // New placements may NEVER overwrite player blocks or preexisting bedrock.
 // Registered legacy bedrock is migrated only in the watchdog below.
 if(!base.isAir||!output.isAir)return false;
 const core=generatorCoreType(g);
 if(!core)throw Error('Unknown generator core for '+g.type);
 try{
  base.setType(core);
  if(dim.getBlock({x:g.x,y:g.y,z:g.z})?.typeId!==core)throw Error('Generator base placement not verified');
  output.setType(g.block);
  if(dim.getBlock({x:g.x,y:g.y+1,z:g.z})?.typeId!==g.block)throw Error('Generator output placement not verified');
  return true;
 }catch(err){
  // Scope rollback to blocks this invocation created, never unrelated blocks.
  try{if(dim.getBlock({x:g.x,y:g.y+1,z:g.z})?.typeId===g.block)output.setType('minecraft:air')}catch{}
  try{if(dim.getBlock({x:g.x,y:g.y,z:g.z})?.typeId===core)base.setType('minecraft:air')}catch{}
  throw err;
 }
}
// Delete only the registered core and its expected output. On a failed block
// write, restore the previous state before the management UI restores registry.
function eraseGeneratorWorldBlocks(dim,g){
 const loc={x:g.x,y:g.y,z:g.z},above={x:g.x,y:g.y+1,z:g.z};
 const base=dim.getBlock(loc),output=dim.getBlock(above);
 if(!base||!output||!isGeneratorBase(g,base))throw Error('Registered generator base unavailable/mismatched');
 const oldBase=base.typeId,oldOutput=output.typeId;
 try{
  if(oldOutput===g.block){
   output.setType('minecraft:air');
   if(dim.getBlock(above)?.typeId!=='minecraft:air')throw Error('Output erase not verified');
  }
  base.setType('minecraft:air');
  if(dim.getBlock(loc)?.typeId!=='minecraft:air')throw Error('Core erase not verified');
 }catch(err){
  // Restore only if the current block is air; never overwrite player changes.
  try{if(dim.getBlock(loc)?.typeId==='minecraft:air')base.setType(oldBase)}catch(e){genError('CRITICAL core delete rollback '+e,'rollback')}
  try{if(oldOutput===g.block&&dim.getBlock(above)?.typeId==='minecraft:air')output.setType(oldOutput)}catch(e){genError('CRITICAL output delete rollback '+e,'rollback')}
  throw err;
 }
}
// Two-bank / multi-key registry. Never truncate records or overwrite the
// legacy sg_generators backup. The commit marker is the final atomic write.
let generatorRegistryLoaded=false;
function generatorChecksum(raw){
 let h=2166136261;for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619)}
 return (h>>>0).toString(16);
}
function generatorChunks(raw){
 const chunks=[];for(let i=0;i<raw.length;i+=GEN_REGISTRY_BYTES)chunks.push(raw.slice(i,i+GEN_REGISTRY_BYTES));
 return chunks.length?chunks:['[]'];
}
function generatorRead(){
 const metaRaw=world.getDynamicProperty(GEN_STORAGE_META);
 if(metaRaw===undefined||metaRaw===null){
  const legacy=world.getDynamicProperty(GEN_STORAGE_LEGACY);
  return legacy===undefined||legacy===null?[]:JSON.parse(String(legacy));
 }
 const meta=JSON.parse(String(metaRaw));
 if(!meta||meta.v!==2||![0,1].includes(meta.bank)||!Number.isSafeInteger(meta.chunks)||meta.chunks<1||meta.chunks>GEN_REGISTRY_SHARDS||typeof meta.checksum!=='string')throw Error('Invalid generator v2 manifest');
 let raw='';for(let i=0;i<meta.chunks;i++){
  const part=world.getDynamicProperty('sg_g2_'+meta.bank+'_'+i);
  if(typeof part!=='string')throw Error('Missing generator data shard '+i);
  raw+=part;
 }
 if(generatorChecksum(raw)!==meta.checksum)throw Error('Generator registry checksum failed; backup preserved');
 const records=JSON.parse(raw);
 if(!Array.isArray(records)||records.length!==meta.records)throw Error('Generator registry record count invalid');
 return records;
}
function genSave(){
 try{
  if(!generatorRegistryLoaded)throw Error('Generator registry has not loaded safely');
  if(generators.size>GEN_REGISTRY_LIMIT)throw Error('Generator registry limit reached');
  const raw=JSON.stringify([...generators]);
  const chunks=generatorChunks(raw);
  if(chunks.length>GEN_REGISTRY_SHARDS)throw Error('Generator registry storage full; no records discarded');
  const previous=world.getDynamicProperty(GEN_STORAGE_META);
  const previousMeta=previous===undefined||previous===null?null:JSON.parse(String(previous));
  const bank=previousMeta?.bank===0?1:0;
  for(let i=0;i<chunks.length;i++){
   const key='sg_g2_'+bank+'_'+i;
   world.setDynamicProperty(key,chunks[i]);
   if(world.getDynamicProperty(key)!==chunks[i])throw Error('Generator shard write not verified '+i);
  }
  const meta=JSON.stringify({v:2,bank,chunks:chunks.length,records:generators.size,checksum:generatorChecksum(raw)});
  world.setDynamicProperty(GEN_STORAGE_META,meta);
  if(world.getDynamicProperty(GEN_STORAGE_META)!==meta)throw Error('Generator commit marker write failed');
  return true;
 }catch(e){genError('save '+e,'save');return false}
}
function genLoad(){
 try{
  const records=generatorRead();
  if(!Array.isArray(records))throw Error('Invalid generator registry');
  const incoming=new Map();
  for(const entry of records){
   if(!Array.isArray(entry)||entry.length!==2)throw Error('Invalid generator entry');
   const [k,v]=entry;
   if(typeof k!=='string'||!v||!GENS.some(g=>g.name===v.type)||!Number.isFinite(v.x)||!Number.isFinite(v.y)||!Number.isFinite(v.z))throw Error('Invalid generator '+k);
   if(incoming.has(k))throw Error('Duplicate generator '+k);
   incoming.set(k,v);
  }
  if(incoming.size>GEN_REGISTRY_LIMIT)throw Error('Generator registry exceeds maximum; data preserved');
  generators.clear();for(const [k,v] of incoming)generators.set(k,v);
  generatorRegistryLoaded=true;
 }catch(e){generatorRegistryLoaded=false;genError('CRITICAL registry load failed; persistence disabled: '+e,'load')}
}
function playerByName(name){return world.getAllPlayers().find(q=>q.name.toLowerCase()===String(name).toLowerCase())}

const SPAWN_RADIUS=12;
const showTeleportText=(p,text)=>{try{p.onScreenDisplay.setTitle(text,{fadeInDuration:0,stayDuration:20,fadeOutDuration:0})}catch{}try{p.onScreenDisplay.setActionBar(text)}catch{}};
function inSpawn(x,z){return Math.abs(x)<=SPAWN_RADIUS&&Math.abs(z)<=SPAWN_RADIUS}
function spawnFloorBlock(dim,x,y,z){return loadedPlotBlock(dim,x,y,z)}
function spawnLanding(){
 const dim=world.getDimension('overworld');
 // Prefer the center, but do not clear user builds to make headroom.
 for(const [dx,dz] of [[0,0],[3,0],[-3,0],[0,3],[0,-3],[6,0],[-6,0],[0,6],[0,-6],[9,0],[-9,0],[0,9],[0,-9]]){
  const x=dx,z=dz,below=spawnFloorBlock(dim,x,0,z);
  if(!below||below.isAir||below.typeId==='minecraft:water'||below.typeId==='minecraft:lava')continue;
  if([1,2,3].every(y=>spawnFloorBlock(dim,x,y,z)?.isAir))return {x:x+0.5,y:1,z:z+0.5};
 }
 return undefined;
}
function createSpawn(){
 try{
  const dim=world.getDimension('overworld');
  // Fill only air at Y=0. Never replace/erase an existing lobby building.
  dim.runCommand('fill -12 0 -12 12 0 12 stone_bricks keep');
  const target=spawnLanding();
  if(!target)return false;
  try{dim.runCommand('setworldspawn '+Math.floor(target.x)+' '+Math.floor(target.y)+' '+Math.floor(target.z))}catch(e){console.warn('[SkyGen] setworldspawn: '+e)}
  world.setDynamicProperty('sg_spawn_ready',true);
  return true;
 }catch(err){console.warn('[SkyGen] Spawn setup failed: '+err);return false}
}
function ensureSpawn(){
 const ready=spawnLanding();
 if(ready){if(world.getDynamicProperty('sg_spawn_ready')!==true)world.setDynamicProperty('sg_spawn_ready',true);return ready}
 if(!createSpawn())return undefined;
 return spawnLanding();
}
const spawnStages=new Map();
let spawnAreaActive=false;
function safeSpawnTravel(p,immediate=false){
 if(!p?.isValid)return;
 const begin=system.currentTick,id=p.id;
 if(spawnStages.has(id))return;
 if(!immediate&&pending.has(id))return p.sendMessage('§eTeleport already counting down.');
 if(!immediate&&system.currentTick<(cooldowns.get(id)||0))return p.sendMessage('§cTeleport cooldown is active.');
 const state={finished:false,area:false},dim=world.getDimension('overworld');
 spawnStages.set(id,state);
 function release(){
  if(state.finished)return;
  state.finished=true;if(spawnStages.get(id)===state)spawnStages.delete(id);
  if(state.area&&spawnStages.size===0){
   try{dim.runCommand('tickingarea remove sg_spawn_safe');spawnAreaActive=false}
   catch(e){console.warn('[SkyGen] spawn area cleanup '+e)}
  }
 }
 if(!spawnAreaActive){
  try{dim.runCommand('tickingarea remove sg_spawn_safe')}catch{}
  try{dim.runCommand('tickingarea add circle 0 0 0 1 sg_spawn_safe false');spawnAreaActive=true}catch(e){console.warn('[SkyGen] spawn chunk stage '+e)}
 }
 state.area=spawnAreaActive;
 state.release=release;
 function check(){
  if(state.finished)return;
  if(!p.isValid){release();return}
  let target;
  try{target=ensureSpawn()}catch(e){console.warn('[SkyGen] spawn verify '+e)}
  if(target){
   if(immediate){
    try{
     if(typeof p.tryTeleport==='function'){if(!p.tryTeleport(target,{dimension:dim,checkForBlocks:false}))throw Error('Spawn chunk not ready')}
     else p.teleport(target,{dimension:dim,checkForBlocks:false});
     cooldowns.set(id,system.currentTick+teleportCooldown(p));
     p.sendMessage('§aSafe SkyGen spawn reached.');
    }catch(e){p.sendMessage('§cSpawn rescue unavailable; your world needs spawn chunks loaded: '+e)}
    release();
   }else{
    if(!tpRequest(p,target,'spawn',undefined,release,true))release();
   }
   return;
  }
  if(system.currentTick-begin>240){p.sendMessage('§cSpawn could not be verified. No unsafe teleport attempted.');release();return}
  system.runTimeout(check,10);
 }
 system.runTimeout(check,immediate?1:10);
}
function profile(p){
 const defaults={credits:1000,orbits:0,rank:1,xp:0,plot:-1};
 const raw=p.getDynamicProperty('sg_profile');
 if(raw===undefined||raw===null)return defaults;
 if(typeof raw!=='string')throw Error('SkyGen profile storage is invalid; refusing to reset player data');
 let data;try{data=JSON.parse(raw)}catch{throw Error('SkyGen player profile is corrupt. Operator recovery required; data not overwritten.')}
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('SkyGen profile has invalid structure');
 for(const name of ['credits','orbits','rank','xp','plot']){
  const v=data[name];if(v!==undefined&&(!Number.isSafeInteger(v)||v< (name==='plot'?-1:0)))throw Error('SkyGen profile has invalid '+name+'; data not overwritten');
 }
 return {...defaults,...data};
}
function save(p,d){
 const json=JSON.stringify(d);
 p.setDynamicProperty('sg_profile',json);
 if(p.getDynamicProperty('sg_profile')!==json)throw Error('Player profile did not persist');
}
const SKILL_BRANCHES=["Mining", "Mobility", "Survival", "Exploration", "Economy", "Engineering"];
const SKILLS=[{"id":"miner_haste_1","name":"Quick Hands I","desc":"Haste I on your plot","cost":1,"rank":2,"branch":"Mining","prev":null},{"id":"miner_haste_2","name":"Quick Hands II","desc":"Haste II on your plot","cost":2,"rank":10,"branch":"Mining","prev":"miner_haste_1"},{"id":"miner_xp_1","name":"Prospector I","desc":"+10% generator mining XP","cost":1,"rank":12,"branch":"Mining","prev":"miner_haste_2"},{"id":"miner_xp_2","name":"Prospector II","desc":"+25% generator mining XP","cost":2,"rank":20,"branch":"Mining","prev":"miner_xp_1"},{"id":"miner_luck_1","name":"Lucky Strikes I","desc":"2% chance of a bonus material","cost":2,"rank":25,"branch":"Mining","prev":"miner_xp_2"},{"id":"miner_luck_2","name":"Lucky Strikes II","desc":"4% chance of a bonus material","cost":3,"rank":35,"branch":"Mining","prev":"miner_luck_1"},{"id":"miner_master","name":"Master Miner","desc":"+50% generator mining XP total","cost":4,"rank":45,"branch":"Mining","prev":"miner_luck_2"},{"id":"move_speed_1","name":"Swift Steps I","desc":"Speed I on your plot","cost":1,"rank":2,"branch":"Mobility","prev":null},{"id":"move_speed_2","name":"Swift Steps II","desc":"Speed II on your plot","cost":2,"rank":12,"branch":"Mobility","prev":"move_speed_1"},{"id":"move_jump_1","name":"High Jumper I","desc":"Jump Boost I, toggleable","cost":1,"rank":8,"branch":"Mobility","prev":"move_speed_2"},{"id":"move_jump_2","name":"High Jumper II","desc":"Jump Boost II, toggleable","cost":2,"rank":18,"branch":"Mobility","prev":"move_jump_1"},{"id":"move_fall","name":"Feather Foot","desc":"Slow Falling, toggleable","cost":2,"rank":25,"branch":"Mobility","prev":"move_jump_2"},{"id":"move_tp_1","name":"Fast Traveler","desc":"Teleport cooldown 20% shorter","cost":3,"rank":35,"branch":"Mobility","prev":"move_fall"},{"id":"move_tp_2","name":"Wayfinder","desc":"Teleport cooldown 40% shorter","cost":4,"rank":45,"branch":"Mobility","prev":"move_tp_1"},{"id":"surv_resist","name":"Stone Skin","desc":"Resistance I on your plot","cost":1,"rank":5,"branch":"Survival","prev":null},{"id":"surv_regen","name":"Vitality","desc":"Regeneration I on your plot","cost":2,"rank":15,"branch":"Survival","prev":"surv_resist"},{"id":"surv_health","name":"Fortified","desc":"Health Boost I on your plot","cost":2,"rank":20,"branch":"Survival","prev":"surv_regen"},{"id":"surv_fire","name":"Flameproof","desc":"Fire Resistance on your plot","cost":2,"rank":25,"branch":"Survival","prev":"surv_health"},{"id":"surv_absorb","name":"Second Wind","desc":"Active Absorption, 2-minute cooldown","cost":2,"rank":30,"branch":"Survival","prev":"surv_fire"},{"id":"surv_regen2","name":"Greater Vitality","desc":"Regeneration II on your plot","cost":3,"rank":40,"branch":"Survival","prev":"surv_absorb"},{"id":"surv_saturate","name":"Survival Feast","desc":"Active Saturation, 5-minute cooldown","cost":4,"rank":48,"branch":"Survival","prev":"surv_regen2"},{"id":"explore_night","name":"Night Owl","desc":"Night Vision on your plot","cost":1,"rank":2,"branch":"Exploration","prev":null},{"id":"explore_water","name":"Deep Diver","desc":"Water Breathing on your plot","cost":1,"rank":10,"branch":"Exploration","prev":"explore_night"},{"id":"explore_conduit","name":"Tidal Power","desc":"Conduit Power while underwater","cost":2,"rank":18,"branch":"Exploration","prev":"explore_water"},{"id":"explore_dolphin","name":"Ocean Runner","desc":"Speed I while underwater","cost":2,"rank":25,"branch":"Exploration","prev":"explore_conduit"},{"id":"explore_invisible","name":"Shadow Step","desc":"Active invisibility, 4-minute cooldown","cost":2,"rank":30,"branch":"Exploration","prev":"explore_dolphin"},{"id":"explore_reward","name":"Expedition Rewards","desc":"+20% Daily Quest Credits","cost":2,"rank":35,"branch":"Exploration","prev":"explore_invisible"},{"id":"explore_master","name":"Expedition Master","desc":"All exploration passives work across your plot, even on land","cost":4,"rank":45,"branch":"Exploration","prev":"explore_reward"},{"id":"econ_sell_1","name":"Merchant I","desc":"+2% ordinary shop sale price","cost":1,"rank":2,"branch":"Economy","prev":null},{"id":"econ_buy_1","name":"Bargain Hunter I","desc":"2% off ordinary shop purchases","cost":1,"rank":8,"branch":"Economy","prev":"econ_sell_1"},{"id":"econ_sell_2","name":"Merchant II","desc":"+5% ordinary shop sale price","cost":2,"rank":15,"branch":"Economy","prev":"econ_buy_1"},{"id":"econ_buy_2","name":"Bargain Hunter II","desc":"5% off ordinary shop purchases","cost":2,"rank":22,"branch":"Economy","prev":"econ_sell_2"},{"id":"econ_rank","name":"Rank Rewards","desc":"+10% future rank Credits","cost":2,"rank":28,"branch":"Economy","prev":"econ_buy_2"},{"id":"econ_sell_3","name":"Master Merchant","desc":"+10% shop sale prices","cost":3,"rank":36,"branch":"Economy","prev":"econ_rank"},{"id":"econ_buy_3","name":"Master Negotiator","desc":"10% off shop purchases","cost":4,"rank":45,"branch":"Economy","prev":"econ_sell_3"},{"id":"eng_speed_1","name":"Tuned Pistons I","desc":"5% quicker generator recovery","cost":1,"rank":3,"branch":"Engineering","prev":null},{"id":"eng_speed_2","name":"Tuned Pistons II","desc":"10% quicker generator recovery","cost":2,"rank":12,"branch":"Engineering","prev":"eng_speed_1"},{"id":"eng_slots_1","name":"Builder Permit I","desc":"5 additional generator slots","cost":1,"rank":15,"branch":"Engineering","prev":"eng_speed_2"},{"id":"eng_speed_3","name":"Tuned Pistons III","desc":"15% quicker generator recovery","cost":2,"rank":25,"branch":"Engineering","prev":"eng_slots_1"},{"id":"eng_slots_2","name":"Builder Permit II","desc":"10 additional generator slots","cost":2,"rank":30,"branch":"Engineering","prev":"eng_speed_3"},{"id":"eng_price_1","name":"Factory Contracts I","desc":"5% off generator purchases and upgrades","cost":3,"rank":38,"branch":"Engineering","prev":"eng_slots_2"},{"id":"eng_price_2","name":"Factory Contracts II","desc":"10% off generator purchases and upgrades","cost":4,"rank":47,"branch":"Engineering","prev":"eng_price_1"}];

// v0.9.0: skill point entitlement derives from rank: old players automatically
// receive points without a one-time grant that could duplicate on reinstall.
function teleportCooldown(p){
 try{const d=profile(p);return Math.max(40,Math.floor(C.cooldown*(hasSkill(d,'move_tp_2')?0.6:hasSkill(d,'move_tp_1')?0.8:1)))}
 catch{return C.cooldown}
}
function skillEntitlement(rank){return Math.max(0,Math.min(50,rank)-1)+2*Math.floor(Math.min(50,rank)/10)}
function purchasedSkills(d){return Array.isArray(d.skills)?d.skills:[]}
function hasSkill(d,id){return purchasedSkills(d).includes(id)}
function skillSpent(d){return purchasedSkills(d).reduce((sum,id)=>sum+(SKILLS.find(s=>s.id===id)?.cost||0),0)}
function skillAvailable(d){return Math.max(0,skillEntitlement(d.rank)-skillSpent(d))}
function perkValue(d,kind){
 const values={
  sell:[['econ_sell_3',10],['econ_sell_2',5],['econ_sell_1',2]],
  buy:[['econ_buy_3',10],['econ_buy_2',5],['econ_buy_1',2]],
  generatorPrice:[['eng_price_2',10],['eng_price_1',5]],
  generatorSpeed:[['eng_speed_3',15],['eng_speed_2',10],['eng_speed_1',5]],
  miningXp:[['miner_master',50],['miner_xp_2',25],['miner_xp_1',10]],
  luck:[['miner_luck_2',4],['miner_luck_1',2]]
 };
 return values[kind]?.find(([id])=>hasSkill(d,id))?.[1]||0;
}
function discountedPrice(price,percent){return Math.max(1,Math.floor(price*(100-percent)/100))}
function generatorSlots(p){const d=profile(p);return GEN_BASE_SLOTS+(hasSkill(d,'eng_slots_2')?10:hasSkill(d,'eng_slots_1')?5:0)}
function generatorOwnerCount(p){let count=0;for(const g of generators.values())if(g.owner===p.id)count++;return count}
function effectivePeriod(g){
 // A fixed denominator prevents NaN and very short high-tier generation times.
 const d=world.getAllPlayers().find(p=>p.id===g.owner);
 let bonus=0;try{if(d)bonus=perkValue(profile(d),'generatorSpeed')}catch{}
 return Math.max(40,Math.floor((Number(g.period)||200)*(100-bonus)/100));
}
function affordableSkill(d,s){
 return !hasSkill(d,s.id)&&d.rank>=s.rank&&(!s.prev||hasSkill(d,s.prev))&&skillAvailable(d)>=s.cost;
}
function skillTree(p){
 const d=profile(p),spent=skillSpent(d),total=skillEntitlement(d.rank);
 form(p,'§dSKILL TREE',`Rank ${d.rank}/50  §ePoints: ${total-spent}/${total}\n§7Permanent on-plot buffs, toggles and abilities. Combat buffs are restricted to your own plot.`,
 [...SKILL_BRANCHES.map(b=>b+' — '+purchasedSkills(d).filter(id=>SKILLS.some(s=>s.id===id&&s.branch===b)).length+'/7'),'Active Abilities / Toggles','Reset Skills','Back'],i=>{
  if(i<SKILL_BRANCHES.length)return skillBranchMenu(p,SKILL_BRANCHES[i]);
  if(i===SKILL_BRANCHES.length)return skillAbilities(p);
  if(i===SKILL_BRANCHES.length+1)return skillReset(p);
  back(p);
 });
}
function skillBranchMenu(p,branch){
 const d=profile(p),nodes=SKILLS.filter(s=>s.branch===branch);
 const status=s=>hasSkill(d,s.id)?'§aOWNED':affordableSkill(d,s)?'§eBUY':'§8LOCKED';
 form(p,'§d'+branch+' Skills',`Available points: ${skillAvailable(d)}\nUnlock skills in order. Rank and point requirements apply.`,
 [...nodes.map(s=>`${status(s)} §f${s.name} (${s.cost} SP, R${s.rank})`),'Back'],i=>{
  if(i>=nodes.length)return skillTree(p);
  const skill=nodes[i],current=profile(p);
  if(!affordableSkill(current,skill))return p.sendMessage('§cSkill locked: need prerequisite, rank and available Skill Points.');
  showUI(p,new MessageFormData().title('§dLEARN '+skill.name).body(`${skill.desc}\nCost: ${skill.cost} Skill Point(s)\nRemaining: ${skillAvailable(current)-skill.cost}`).button1('Cancel').button2('Learn Skill')).then(r=>{
   if(r.canceled||r.selection!==1)return;
   try{
    const latest=profile(p);if(!affordableSkill(latest,skill))return p.sendMessage('§cSkill requirements have changed.');
    latest.skills=[...purchasedSkills(latest),skill.id];save(p,latest);
    p.sendMessage(`§aUnlocked ${skill.name}. ${skillAvailable(latest)} Skill Points remain.`);
   }catch(e){p.sendMessage('§cSkill could not save: '+String(e).slice(0,100))}
  }).catch(e=>p.sendMessage('§cSkill menu error '+e));
 });
}
function skillReset(p){
 const d=profile(p);if(skillSpent(d)===0)return p.sendMessage('§eNo purchased skills to reset.');
 const cost=10000+d.rank*200;
 showUI(p,new MessageFormData().title('§cRESET ALL SKILLS').body(`Refund all spent Skill Points for ${cost} Credits? Rank and earned points are retained.\nCurrent Skill Points spent: ${skillSpent(d)}`).button1('Keep Skills').button2('Reset')).then(r=>{
  if(r.canceled||r.selection!==1)return;
  try{const fresh=profile(p);if(fresh.credits<cost)return p.sendMessage('§cNot enough Credits.');
   fresh.credits-=cost;fresh.skills=[];save(p,fresh);p.sendMessage('§aSkill points refunded. Your rank stays unchanged.');
  }catch(e){p.sendMessage('§cReset could not save: '+e)}
 });
}
const skillCooldowns=new Map(),skillLastEffects=new Map(),skillActiveEffects=new Map();
function skillToggles(d){return d.skillToggles&&typeof d.skillToggles==='object'&&!Array.isArray(d.skillToggles)?d.skillToggles:{}}
function onOwnPlot(p){try{return p.dimension?.id==='minecraft:overworld'&&belongs(p,p.location.x,p.location.z)}catch{return false}}
function useAbility(p,id,effect,duration,cooldown){
 const d=profile(p);if(!hasSkill(d,id))return p.sendMessage('§cUnlock this ability in the skill tree first.');
 if(!onOwnPlot(p))return p.sendMessage('§cSkill abilities are only available on your own plot (not in PvP).');
 const key=p.id+':'+id,now=system.currentTick,until=skillCooldowns.get(key)||0;
 const timestamp=Date.now(),persistent=Number(d.skillCooldownUntil?.[id])||0;
 if(now<until||timestamp<persistent)return p.sendMessage('§eAbility cooldown: '+Math.ceil(Math.max((until-now)/20,(persistent-timestamp)/1000))+' seconds.');
 try{
  p.addEffect(effect,duration,{amplifier:0,showParticles:false});
  d.skillCooldownUntil={...(d.skillCooldownUntil||{}),[id]:timestamp+cooldown*50};
  save(p,d);
  if(!skillActiveEffects.has(p.id))skillActiveEffects.set(p.id,new Set());
  skillActiveEffects.get(p.id).add(effect);skillCooldowns.set(key,now+cooldown);
  p.sendMessage('§aAbility activated!');
 }catch(e){try{p.removeEffect?.(effect)}catch{}p.sendMessage('§cAbility could not activate or save: '+String(e).slice(0,90))}
}
function skillAbilities(p){
 const d=profile(p),toggles=skillToggles(d);
 const list=[['move_jump_1','Jump Boost',true],['move_fall','Slow Falling',true],['explore_night','Exploration Effects',true],['surv_absorb','Second Wind',false],['surv_saturate','Survival Feast',false],['explore_invisible','Shadow Step',false]];
 form(p,'§bSKILL ABILITIES','On-plot passives refresh automatically. Active skills have cooldowns.',
 [...list.map(([id,label,toggle])=>`${hasSkill(d,id)?'§a':'§8'}${label}${toggle?' ['+(toggles[id]===false?'OFF':'ON')+']':' [ACTIVATE]'}`),'Back'],i=>{
  if(i>=list.length)return skillTree(p);
  const [id,label,toggle]=list[i];if(!hasSkill(profile(p),id))return p.sendMessage('§cSkill not unlocked.');
  if(toggle){try{const fresh=profile(p);fresh.skillToggles={...skillToggles(fresh),[id]:skillToggles(fresh)[id]===false};save(p,fresh);p.sendMessage('§a'+label+' toggled '+(fresh.skillToggles[id]?'ON':'OFF'))}catch(e){p.sendMessage('§cToggle save failed '+e)}return;}
  if(id==='surv_absorb')return useAbility(p,id,'minecraft:absorption',200,2400);
  if(id==='surv_saturate')return useAbility(p,id,'minecraft:saturation',100,6000);
  if(id==='explore_invisible')return useAbility(p,id,'minecraft:invisibility',200,4800);
 });
}
const PASSIVE_SKILLS=[
 ['miner_haste_1','minecraft:haste',0,'miner_haste_2'],
 ['move_speed_1','minecraft:speed',0,'move_speed_2'],
 ['move_jump_1','minecraft:jump_boost',0,'move_jump_2'],
 ['move_fall','minecraft:slow_falling',0],
 ['surv_resist','minecraft:resistance',0],
 ['surv_regen','minecraft:regeneration',0,'surv_regen2'],
 ['surv_health','minecraft:health_boost',0],
 ['surv_fire','minecraft:fire_resistance',0],
 ['explore_night','minecraft:night_vision',0],
 ['explore_water','minecraft:water_breathing',0],
 ['explore_conduit','minecraft:conduit_power',0],
 ['explore_dolphin','minecraft:speed',0]
];
function skillPulse(){
 for(const p of world.getAllPlayers()){
  try{
   const own=onOwnPlot(p),d=profile(p),toggles=skillToggles(d);
   const applied=skillLastEffects.get(p.id)||new Set();
   const desired=new Set();
   if(own){
    for(const [skill,effect,amp,upgraded] of PASSIVE_SKILLS){
     if(!hasSkill(d,skill))continue;
     if(skill==='move_jump_1'&&toggles.move_jump_1===false)continue;
     if(skill==='move_fall'&&toggles.move_fall===false)continue;
     if(skill.startsWith('explore_')&&toggles.explore_night===false&&!hasSkill(d,'explore_master'))continue;
     if((skill==='explore_conduit'||skill==='explore_dolphin')&&!p.isInWater&&!hasSkill(d,'explore_master'))continue;
     const strength=upgraded&&hasSkill(d,upgraded)?1:amp;
     try{const current=p.getEffect?.(effect);
      if(current&&current.amplifier>strength&&current.duration>35)continue;
      if(!current||current.duration<35||current.amplifier<strength){p.addEffect(effect,80,{amplifier:strength,showParticles:false});}
      desired.add(effect);
     }catch(e){if(!skillEffectWarnings.has(effect)){skillEffectWarnings.add(effect);console.warn('[SkyGen SKILLS] Effect '+effect+' unavailable: '+e)}}
    }
   }
   // On leaving one's own plot, prevent persistent potions from spilling into PvP.
   // Only remove known effects we applied and not another stronger effect.
   for(const effect of applied)if(!desired.has(effect)){
    try{const current=p.getEffect?.(effect);if(current&&current.duration<=90)p.removeEffect?.(effect)}catch{}
   }
   if(!own&&skillActiveEffects.has(p.id)){
    for(const effect of skillActiveEffects.get(p.id))try{p.removeEffect?.(effect)}catch{}
    skillActiveEffects.delete(p.id);
   }
   skillLastEffects.set(p.id,desired);
  }catch(e){console.warn('[SkyGen SKILLS] pulse '+e)}
 }
 system.runTimeout(skillPulse,10);
}
const skillEffectWarnings=new Set();
system.runTimeout(skillPulse,100);
function dailyDate(){return new Date().toISOString().slice(0,10)}
function todayQuests(d){
 const day=dailyDate();if(d.daily&&d.daily.day===day)return d.daily;
 return {day,blocks:0,harvests:0,placements:0,claimed:[]};
}
function recordDaily(d,field){const daily=todayQuests(d);daily[field]=Math.min(10000,(daily[field]||0)+1);d.daily=daily}
const DAILY_QUESTS=[{key:'blocks',need:50,credits:1500,xp:100,label:'Mine 50 plot blocks'},
 {key:'harvests',need:10,credits:3500,xp:250,label:'Harvest 10 generator blocks'},
 {key:'placements',need:1,credits:2000,xp:250,label:'Place a new generator'}];
function dailyQuests(p){
 const d=profile(p),daily=todayQuests(d);
 form(p,'§eDAILY QUESTS',`UTC day: ${daily.day}\nProgress resets each UTC day. Claim completed rewards below.`,
 [...DAILY_QUESTS.map(q=>`${(daily.claimed||[]).includes(q.key)?'§aCLAIMED':(daily[q.key]||0)>=q.need?'§eREADY':'§7IN PROGRESS'} ${q.label} (${Math.min(q.need,daily[q.key]||0)}/${q.need})`),'Back'],i=>{
  if(i>=DAILY_QUESTS.length)return menu(p);
  const q=DAILY_QUESTS[i];try{
   const fresh=profile(p),today=todayQuests(fresh);
   if(today.day!==dailyDate()||(today[q.key]||0)<q.need||(today.claimed||[]).includes(q.key))return p.sendMessage('§eQuest not ready or already claimed.');
   today.claimed=[...today.claimed,q.key];fresh.daily=today;
   const reward=hasSkill(fresh,'explore_reward')?Math.floor(q.credits*1.2):q.credits;fresh.credits+=reward;fresh.xp+=q.xp;
   rank(p,fresh);p.sendMessage(`§aDaily quest reward: ${reward} Credits + ${q.xp} XP.`);
  }catch(e){p.sendMessage('§cCould not claim quest: '+e)}
 });
}
function coords(id){return {x:C.base.x+(id%C.columns)*C.spacing,y:C.base.y,z:C.base.z+Math.floor(id/C.columns)*C.spacing}}
function belongs(p,x,z){if(p.dimension?.id!=='minecraft:overworld')return false;const d=profile(p);if(d.plot<0)return false;const c=coords(d.plot);return Math.abs(x-c.x)<=C.radius&&Math.abs(z-c.z)<=C.radius}
function plotAt(x,z){const dx=x-C.base.x,dz=z-C.base.z;if(dx< -C.radius||dz< -C.radius)return -1;const col=Math.round(dx/C.spacing),row=Math.round(dz/C.spacing);if(col<0||col>=C.columns||row<0)return -1;const id=row*C.columns+col,c=coords(id);return Math.abs(x-c.x)<=C.radius&&Math.abs(z-c.z)<=C.radius?id:-1}
// v0.8.1: Load the destination, generate/verify its floor, and KEEP that
// chunk loaded until the teleport completes (or the request is cancelled).
// In v0.8.0 the ticking area was removed before the Plot Horn teleport,
// making previously created islands appear to be missing while unloaded.
const plotBuilds=new Map(),plotRepairNotice=new Map();
const ACTIVE_PLOT_AREAS='sg_active_plot_areas_v1',MAX_PLOT_STAGES=6;
let plotStartupSweepDone=false;
function areaRegistry(){
 try{const a=JSON.parse(String(world.getDynamicProperty(ACTIVE_PLOT_AREAS)||'[]'));return Array.isArray(a)?a.filter(x=>/^sg_p\d+$/.test(x)):[]}catch{return []}
}
function trackArea(name,active){
 const names=new Set(areaRegistry());if(active)names.add(name);else names.delete(name);
 world.setDynamicProperty(ACTIVE_PLOT_AREAS,JSON.stringify([...names].slice(0,100)));
}
function sweepSkyGenAreas(){
 const dim=world.getDimension('overworld');
 const names=new Set(areaRegistry());
 // Also find legacy v0.8.1 leftovers where no registry existed.
 try{const result=dim.runCommand('tickingarea list');const txt=String(result?.statusMessage||'');
  for(const match of txt.matchAll(/sg_p\d+/g))names.add(match[0]);
 }catch(e){console.warn('[SkyGen] tickingarea enumeration unavailable '+e)}
 for(const name of names){
  if([...plotBuilds.values()].some(x=>x.areaName===name))continue;
  try{dim.runCommand('tickingarea remove '+name)}catch(e){console.warn('[SkyGen] stale plot area '+name+' '+e)}
 }
 try{world.setDynamicProperty(ACTIVE_PLOT_AREAS,JSON.stringify([...plotBuilds.values()].map(x=>x.areaName).filter(Boolean)))}catch(e){console.warn('[SkyGen] tickingarea registry '+e)}
 plotStartupSweepDone=true;
}
system.runTimeout(sweepSkyGenAreas,20);
const PLOT_RETRY_TICKS=10,PLOT_MAX_TRIES=40;
function plotNotice(p,msg){
 const last=plotRepairNotice.get(p.id)??-99999;
 if(system.currentTick-last>200){plotRepairNotice.set(p.id,system.currentTick);p.sendMessage(msg)}
}
function loadedPlotBlock(dim,x,y,z){
 try{return dim.getBlock({x,y,z})}catch{return undefined}
}
function solidPlotFloor(b){return !!b&&!b.isAir&&!['minecraft:water','minecraft:lava'].includes(b.typeId)}
function plotFloorReady(id){
 const c=coords(id),dim=world.getDimension('overworld');
 // Verify all 289 floor tiles. No sparse sampling / false positives.
 for(let dx=-8;dx<=8;dx++)for(let dz=-8;dz<=8;dz++){
  if(!solidPlotFloor(loadedPlotBlock(dim,c.x+dx,c.y-1,c.z+dz)))return false;
 }
 return true;
}
function findPlotLanding(id){
 const c=coords(id),dim=world.getDimension('overworld');
 // Do not alter structures built by the owner. Find a clear 3-block-tall
 // arrival space over the permanent starter floor instead.
 for(const [dx,dz] of [[0,0],[3,0],[-3,0],[0,3],[0,-3],[3,3],[-3,3],[3,-3],[-3,-3],[6,0],[-6,0],[0,6],[0,-6]]){
  if(!solidPlotFloor(loadedPlotBlock(dim,c.x+dx,c.y-1,c.z+dz)))continue;
  if([0,1,2].every(dy=>loadedPlotBlock(dim,c.x+dx,c.y+dy,c.z+dz)?.isAir))
   return {x:c.x+dx+0.5,y:c.y+1,z:c.z+dz+0.5};
 }
 return undefined;
}
function buildPlotInLoadedChunk(id){
 const c=coords(id),dim=world.getDimension('overworld');
 // Do not run fill against chunks that have not loaded yet.
 if(!loadedPlotBlock(dim,c.x,c.y-1,c.z))return false;
 if(plotFloorReady(id))return true;
 // 'keep' fills AIR ONLY. Existing buildings / chests / custom plot flooring
 // are not overwritten. A no-blocks-filled command may fail harmlessly.
 for(const [offset,block] of [[-3,'minecraft:dirt'],[-2,'minecraft:dirt'],[-1,'minecraft:grass_block']]){
  const y=c.y+offset;
  try{dim.runCommand(`fill ${c.x-8} ${y} ${c.z-8} ${c.x+8} ${y} ${c.z+8} ${block} keep`)}
  catch(e){if(!plotFloorReady(id))console.warn('[SkyGen] plot '+id+' floor layer '+offset+': '+e)}
 }
 return plotFloorReady(id);
}
function stageAndBuildPlot(p,id,teleportAfter=true){
 if(!p?.isValid)return;
 if(!canVisit(p,id))return p.sendMessage('§cYou do not have permission to use this plot.');
 if(teleportAfter){
  const now=system.currentTick,until=cooldowns.get(p.id)||0;
  if(now<until)return p.sendMessage('§cTeleport cooldown: '+Math.ceil((until-now)/20)+'s');
  if(pending.has(p.id))return p.sendMessage('§eTeleport already counting down.');
 }
 if(!plotStartupSweepDone){system.runTimeout(()=>{if(p.isValid)stageAndBuildPlot(p,id,teleportAfter)},25);return}
 const active=plotBuilds.get(id);
 if(active){
  // Claim-time pre-generation can be upgraded into a Plot Horn teleport.
  if(active.playerId===p.id&&teleportAfter){active.teleportAfter=true;p.sendMessage('§eSkyGen: Your plot is loading. Teleport will start when ready.');}
  else if(teleportAfter)plotNotice(p,'§eSkyGen: That plot is currently loading. Try again shortly.');
  return;
 }
 if(plotBuilds.size>=MAX_PLOT_STAGES){
  plotNotice(p,'§eSkyGen: Too many islands loading. Please retry the Plot Horn shortly.');return;
 }
 const dim=world.getDimension('overworld'),c=coords(id),name='sg_p'+id;
 const session={playerId:p.id,teleportAfter,finished:false,areaName:name};
 plotBuilds.set(id,session);
 let areaActive=false,tries=0,lastError='Plot chunk not loaded';
 function cleanup(){
  if(session.finished)return;
  session.finished=true;
  if(plotBuilds.get(id)===session)plotBuilds.delete(id);
  if(areaActive){try{dim.runCommand(`tickingarea remove ${name}`)}catch(e){console.warn('[SkyGen] plot tickingarea cleanup '+id+': '+e)}}
  try{trackArea(name,false)}catch(e){console.warn('[SkyGen] area registry cleanup '+e)}
 }
 session.cancel=cleanup;
 try{
  // Track the area BEFORE creating it, so startup can reclaim a crash orphan.
  trackArea(name,true);
  // Clear only a stale area from a previous interrupted SkyGen run.
  try{dim.runCommand(`tickingarea remove ${name}`)}catch{}
  // A radius of 1 chunk is enough for the 17x17 starter island.
  // false avoids permanent preload overhead on Realm restarts.
  dim.runCommand(`tickingarea add circle ${c.x} ${c.y} ${c.z} 1 ${name} false`);
  areaActive=true;
  if(teleportAfter)p.sendMessage('§eSkyGen: Preparing plot #'+(id+1)+' safely. Stay where you are.');
 }catch(e){
  lastError=String(e);cleanup();
  console.warn('[SkyGen] cannot load plot '+id+': '+lastError);
  p.sendMessage('§cSkyGen cannot load plot chunks. Check that cheats are enabled and there is a free ticking-area slot. '+lastError.slice(0,120));
  return;
 }
 function check(){
  if(session.finished)return;
  if(!p.isValid){cleanup();return}
  if(!canVisit(p,id)){cleanup();p.sendMessage('§cPlot access was revoked.');return}
  try{
   if(buildPlotInLoadedChunk(id)){
    const target=findPlotLanding(id);
    if(!target){cleanup();p.sendMessage('§cPlot floor is present, but the landing area is blocked. Clear some space at the plot center.');return}
    if(!session.teleportAfter){cleanup();p.sendMessage('§aSkyGen: Plot #'+(id+1)+' is ready. Use the Plot Horn to teleport.');return}
    // IMPORTANT: keep the ticking area alive throughout the 5-second
    // countdown. tpRequest releases it on success, failure or cancellation.
    if(!tpRequest(p,target,id===profile(p).plot?'your plot':'plot #'+(id+1),id,cleanup))cleanup();
    return;
   }
  }catch(e){lastError=String(e);if(tries===0||tries===PLOT_MAX_TRIES-1)console.warn('[SkyGen] plot '+id+' build error: '+lastError)}
  tries++;
  if(tries>=PLOT_MAX_TRIES){
   cleanup();p.sendMessage('§cSkyGen: Plot chunks could not be prepared. No teleport attempted. '+lastError.slice(0,120));return;
  }
  system.runTimeout(check,PLOT_RETRY_TICKS);
 }
 system.runTimeout(check,10);
}
function claim(p){
 const d=profile(p);
 if(d.plot>=0){
  const owner=ownerId(d.plot);
  if(owner&&owner!==p.id)throw Error('Plot owner mismatch; assignment locked for operator review');
  if(!owner)world.setDynamicProperty(keyForPlot(d.plot),p.id);
  return d;
 }
 const journalKey='sg_claim_reserve_'+p.id;
 const reservation=world.getDynamicProperty(journalKey);
 const next=Number(world.getDynamicProperty('sg_next_plot')??0);
 if(!Number.isSafeInteger(next)||next<0||next>64000)throw Error('Plot registry index invalid or limit reached');
 // First check our own durable reservation; repairing a partial claim must not allocate a second plot.
 let id;
 if(reservation!==undefined&&reservation!==null){
  id=Number(reservation);
  if(!Number.isSafeInteger(id)||id<0||id>next)throw Error('Plot reservation corrupt; operator review');
  if(ownerId(id)&&ownerId(id)!==p.id)throw Error('Plot reservation ownership conflict');
  if(id===next){
   // Recover a crash after recording ownership/journal but before incrementing allocator.
   if(ownerId(id)!==p.id)throw Error('Uncommitted plot reservation needs operator review');
   world.setDynamicProperty('sg_next_plot',id+1);
   if(world.getDynamicProperty('sg_next_plot')!==id+1)throw Error('Unable to finish plot index reservation');
  }
 }else{
  id=next;
  if(ownerId(id))throw Error('Plot registry conflict at #'+(id+1)+'; no duplicate assigned');
  // Protect against concurrent claims: record the reserved owner before index moves.
  world.setDynamicProperty(keyForPlot(id),p.id);
  if(ownerId(id)!==p.id)throw Error('Unable to reserve plot owner');
  world.setDynamicProperty(journalKey,id);
  if(world.getDynamicProperty(journalKey)!==id)throw Error('Plot reservation incomplete; operator review required');
  world.setDynamicProperty('sg_next_plot',id+1);
  if(world.getDynamicProperty('sg_next_plot')!==id+1)throw Error('Unable to reserve plot index');
 }
 if(!ownerId(id))world.setDynamicProperty(keyForPlot(id),p.id);
 if(ownerId(id)!==p.id)throw Error('Unable to save plot ownership');
 d.plot=id;save(p,d);
 p.sendMessage('§aSkyGen: Plot #'+(id+1)+' assigned. Building starter island...');
 system.runTimeout(()=>{if(p.isValid&&!plotBuilds.has(id))stageAndBuildPlot(p,id,false)},10);
 return d;
}
function toolmatch(i,t){return i?.typeId===t.type&&i?.nameTag===t.name}
function isTool(i){return !!i&&TOOLS.some(t=>toolmatch(i,t))}
function ensure(p){try{const inv=p.getComponent('minecraft:inventory')?.container;if(!inv)return;for(const t of TOOLS){const old=inv.getItem(t.slot);if(toolmatch(old,t)&&old.lockMode===ItemLockMode.slot&&old.keepOnDeath)continue;if(old&&!isTool(old)){let free=-1;for(let i=9;i<inv.size;i++)if(!inv.getItem(i)){free=i;break}if(free<0)for(let i=0;i<6;i++)if(!inv.getItem(i)){free=i;break}if(free<0)continue;inv.setItem(free,old)}const item=new ItemStack(t.type,1);item.nameTag=t.name;item.lockMode=ItemLockMode.slot;item.keepOnDeath=true;inv.setItem(t.slot,item)}for(let i=0;i<inv.size;i++)if((i<6||i>8)&&isTool(inv.getItem(i)))inv.setItem(i,undefined)}catch(e){console.warn('SkyGen tools: '+e)}}
function finishPendingTeleport(t,success=false){
 if(!t||t.finished)return;
 t.finished=true;
 if(typeof t.onFinish==='function'){
  // After success keep the destination loaded briefly for client chunk handoff.
  if(success)system.runTimeout(()=>{try{t.onFinish()}catch(e){console.warn('[SkyGen] plot release '+e)}},40);
  else try{t.onFinish()}catch(e){console.warn('[SkyGen] plot release '+e)}
 }
}
function teleportWatchdog(p,id,token){
 const t=pending.get(id);
 if(!t||t.token!==token)return;
 try{
  if(!p.isValid){pending.delete(id);finishPendingTeleport(t);return}
  const now=system.currentTick,loc=p.location;
  if(p.dimension.id!==t.dim||Math.abs(loc.x-t.start.x)>0.15||Math.abs(loc.y-t.start.y)>0.15||Math.abs(loc.z-t.start.z)>0.15){
   pending.delete(id);finishPendingTeleport(t);showTeleportText(p,'§cTELEPORT CANCELLED');p.sendMessage('§cTeleport cancelled: you moved.');return;
  }
  if(now-t.created>160){pending.delete(id);finishPendingTeleport(t);showTeleportText(p,'§cTELEPORT TIMED OUT');return;}
  if(now<t.end){
   const n=Math.max(1,Math.ceil((t.end-now)/20));
   try{p.onScreenDisplay.setTitle('§e'+n,{fadeInDuration:0,stayDuration:5,fadeOutDuration:0})}catch{}
   try{p.onScreenDisplay.setActionBar('§eTeleport in '+n+' seconds — stand still')}catch{}
   if(t.lastShown!==n){t.lastShown=n;p.sendMessage('§e'+n+'...')}
   system.runTimeout(()=>teleportWatchdog(p,id,token),1);return;
  }
  pending.delete(id);
  if(t.visitPlot!==undefined&&!canVisit(p,t.visitPlot)){
   finishPendingTeleport(t);showTeleportText(p,'§cACCESS REVOKED');p.sendMessage('§cPlot access was revoked.');return;
  }
  if(t.safeSpawn){
   const safe=ensureSpawn();
   if(!safe){finishPendingTeleport(t);showTeleportText(p,'§cSPAWN NOT READY');p.sendMessage('§cSpawn is not verified. Teleport canceled.');return}
   t.target=safe;
  }
  if(t.visitPlot!==undefined){
   // Re-select a landing just before teleport. Someone could have built in
   // the original arrival spot while the countdown was running.
   const safe=plotFloorReady(t.visitPlot)?findPlotLanding(t.visitPlot):undefined;
   if(!safe){finishPendingTeleport(t);showTeleportText(p,'§cPLOT NOT READY');p.sendMessage('§cPlot landing is not safe; teleport cancelled. Try the Plot Horn again.');return;}
   t.target=safe;
  }
  try{
   const destination=world.getDimension('overworld');
   // tryTeleport reports false if Bedrock still cannot load the destination.
   // NEVER fall back to a blind /tp into a void chunk.
   if(typeof p.tryTeleport==='function'){
    if(!p.tryTeleport(t.target,{dimension:destination,checkForBlocks:false}))throw new Error('Destination chunk is not ready');
   }else p.teleport(t.target,{dimension:destination,checkForBlocks:false});
   cooldowns.set(id,system.currentTick+teleportCooldown(p));
   finishPendingTeleport(t,true);
   showTeleportText(p,'§aTELEPORTED!');p.sendMessage('§aTeleport successful.');
  }catch(err){finishPendingTeleport(t);showTeleportText(p,'§cTELEPORT FAILED');p.sendMessage('§cTeleport failed safely: '+String(err));}
 }catch(err){pending.delete(id);finishPendingTeleport(t);try{p.sendMessage('§cTeleport timer error: '+String(err))}catch{};console.warn('SkyGen watchdog '+err)}
}
function tpRequest(p,target,label,visitPlot,onFinish,safeSpawn=false){
 const now=system.currentTick,id=p.id,until=cooldowns.get(id)||0;
 if(now<until){p.sendMessage('§cTeleport cooldown: '+Math.ceil((until-now)/20)+'s');return false}
 if(pending.has(id)){p.sendMessage('§eTeleport already counting down.');return false}
 const start={x:p.location.x,y:p.location.y,z:p.location.z};
 const token=now+'-'+id;
 pending.set(id,{start,dim:p.dimension.id,target,label,visitPlot,onFinish,safeSpawn,created:now,end:now+C.warmup,token,lastShown:5});
 p.sendMessage('§eTeleport to '+label+' in 5 seconds. Stand still!');
 showTeleportText(p,'§e5');
 system.runTimeout(()=>teleportWatchdog(p,id,token),1);
 return true;
}
function tpPlot(p){
 let d=profile(p);
 // The Horn can recover a first-join plot assignment without forcing a rejoin.
 if(d.plot<0){try{d=claim(p)}catch(e){return p.sendMessage('§cPlot assignment needs operator review: '+String(e).slice(0,120))}}
 stageAndBuildPlot(p,d.plot,true);
}
function rank(p,d){
 const old=d.rank||1;d.rank=Math.min(50,1+Math.floor(d.xp/1000));
 if(d.rank>old){for(let n=old+1;n<=d.rank;n++){d.credits+=Math.floor(n*100*(100+(hasSkill(d,'econ_rank')?10:0))/100);if(n%10===0)d.orbits+=1}p.sendMessage(`§dRank up! ${old} → ${d.rank}. §e+${skillEntitlement(d.rank)-skillEntitlement(old)} Skill Points! Credits rewarded${Math.floor(d.rank/10)>Math.floor(old/10)?' + milestone Orbits':''}.`)}
 save(p,d);p.nameTag=`§b[Rank ${d.rank}] §r${p.name}`}

function showUI(p,ui,attempt=0){
 return new Promise((resolve,reject)=>{
  system.runTimeout(()=>{
   if(p?.isValid===false)return resolve({canceled:true});
   try{ui.show(p).then(r=>{
    if(r.canceled&&/UserBusy/i.test(String(r.cancelationReason||''))&&attempt<5){showUI(p,ui,attempt+1).then(resolve,reject);return}
    resolve(r);
   }).catch(e=>{
    if(attempt<5&&/busy/i.test(String(e)))showUI(p,ui,attempt+1).then(resolve,reject);
    else reject(e);
   })}catch(e){reject(e)}
  },attempt?20*(attempt+1):8);
 });
}
function form(p,title,body,buttons,cb){
 let f=new ActionFormData().title(title).body(body);
 for(const b of buttons)f=f.button(b);
 showUI(p,f).then(r=>{if(!r.canceled&&Number.isInteger(r.selection))cb(r.selection)}).catch(e=>console.warn('SkyGen UI '+e));
}
// Admin privileges require both a server-issued axe and a persistent grant.
// Operator bootstrap: /scriptevent skygen:adminaxe
const ADMIN_AXE='§4§lSkyGen Admin Manager';
function isOperator(p){try{if(typeof p.isOp==="function"&&p.isOp()===true)return true}catch{}try{return p.playerPermissionLevel===2}catch{return false}}
function isAdmin(p){return isOperator(p)||world.getDynamicProperty('sg_admin_'+p.id)===true}
function adminAxe(i){return i?.typeId==='minecraft:wooden_axe'&&i.nameTag===ADMIN_AXE&&i.getLore()?.includes('§8SkyGen issued admin tool')}
function issueAdminAxe(p,attempt=0){
 try{
  if(!p)return;
  if(!isAdmin(p))return p.sendMessage('§cSkyGen Admin permission not active. Ask an operator to grant access.');
  const inv=inventory(p);
  if(!inv){if(attempt<3)return system.runTimeout(()=>issueAdminAxe(p,attempt+1),20);return p.sendMessage('§cAdmin axe: inventory unavailable.');}
  let existing=-1;
  for(let i=0;i<inv.size;i++){if(adminAxe(inv.getItem(i))){existing=i;break;}}
  if(existing>=0&&existing<6)return p.sendMessage('§aAdmin axe is in hotbar slot '+(existing+1)+'.');
  let slot=-1;
  for(let i=0;i<Math.min(6,inv.size);i++){if(!inv.getItem(i)){slot=i;break;}}
  if(existing>=0){
   if(slot>=0){const axe=inv.getItem(existing);inv.setItem(slot,axe);inv.setItem(existing,undefined);return p.sendMessage('§aAdmin axe moved to hotbar slot '+(slot+1)+'.');}
   return p.sendMessage('§eAdmin axe is in inventory slot '+(existing+1)+'. Free a hotbar slot 1–6 to move it.');
  }
  if(slot<0)return p.sendMessage('§cFree one of hotbar slots 1–6, then run /scriptevent skygen:adminaxe again.');
  const axe=new ItemStack('minecraft:wooden_axe',1);
  axe.nameTag=ADMIN_AXE;axe.setLore(['§8SkyGen issued admin tool','§cAdmin access required']);
  axe.lockMode=ItemLockMode.inventory;
  inv.setItem(slot,axe);
  const actual=inv.getItem(slot);
  if(!adminAxe(actual))throw Error('Item verification failed after insertion');
  p.sendMessage('§aSkyGen Admin axe delivered to hotbar slot '+(slot+1)+'.');
 }catch(err){
  console.warn('[SkyGen ADMIN] axe delivery: '+err);
  if(attempt<3)system.runTimeout(()=>issueAdminAxe(p,attempt+1),20);
  else try{p.sendMessage('§cAdmin axe delivery failed: '+err)}catch{}
 }
}
function adminAudit(actor,action,target,detail){console.warn('[SkyGen ADMIN] '+actor.name+' '+action+' '+target.name+' '+detail)}
// All admin UI transitions are deferred: Bedrock rejects forms opened in the same tick
// as the previous form's completion (often returning UserBusy).
function adminLater(fn){system.runTimeout(()=>{try{fn()}catch(e){console.warn('[SkyGen ADMIN UI] '+e);}},12)}
function adminShow(p,ui,step,attempt=0){
 return new Promise((resolve,reject)=>{
  system.runTimeout(()=>{
   ui.show(p).then(r=>{
    if(r.canceled&&String(r.cancelationReason||'').includes('UserBusy')&&attempt<5){
     adminNotice(p,'§eAdmin menu busy; retrying '+step+'...');
     adminShow(p,ui,step,attempt+1).then(resolve,reject);return;
    }
    if(r.canceled)adminNotice(p,'§7Admin '+step+' closed ('+String(r.cancelationReason||'cancelled')+').');
    else adminNotice(p,'§7Admin '+step+' selection received.');
    resolve(r);
   }).catch(e=>{
    if(attempt<3&&/busy/i.test(String(e)))return adminShow(p,ui,step,attempt+1).then(resolve,reject);
    adminNotice(p,'§cAdmin '+step+' failed: '+e);reject(e);
   });
  },attempt?20*(attempt+1):8);
 });
}
function adminNotice(p,msg){try{p.sendMessage(msg)}catch(e){console.warn('[SkyGen ADMIN NOTICE] '+e)}}
function adminOnline(target){return world.getAllPlayers().some(x=>x.id===target.id)}
function adminFormError(p,where,e){console.warn('[SkyGen ADMIN '+where+'] '+e);adminNotice(p,'§cAdmin '+where+' error: '+e)}
function adminAction(p,title,body,buttons,cb){
 let ui=new ActionFormData().title(title).body(body);
 for(const label of buttons)ui=ui.button(label);
 adminShow(p,ui,title).then(r=>{if(!r.canceled)adminLater(()=>cb(r.selection))}).catch(e=>adminFormError(p,title,e));
}
function adminMenu(p){
 if(!isAdmin(p))return adminNotice(p,'§cAdmin access denied.');
 adminAction(p,'§4SKYGEN ADMIN MANAGER','Select an action. Changes are logged.',
 ['Manage Player Wallet','Give Player Items',isOperator(p)?'Grant/Revoke Admin Access':'Admin Access (operator only)','Get My Admin Axe','Close'],
 i=>adminLater(()=>{
  if(!isAdmin(p))return adminNotice(p,'§cAdmin access expired.');
  if(i===0)return adminChoosePlayer(p,'wallet');
  if(i===1)return adminChoosePlayer(p,'items');
  if(i===2)return isOperator(p)?adminChoosePlayer(p,'access'):adminNotice(p,'§cOnly Realm operators can manage admin access.');
  if(i===3)return issueAdminAxe(p);
 }));
}
function adminChoosePlayer(p,mode){
 if(!isAdmin(p))return adminNotice(p,'§cAdmin access denied.');
 const online=world.getAllPlayers();
 adminAction(p,'§4SELECT PLAYER','Choose an online player.',[...online.map(x=>x.name),'Back'],i=>adminLater(()=>{
  if(i===online.length)return adminMenu(p);
  const target=online[i];if(!target||!adminOnline(target))return adminNotice(p,'§cPlayer is no longer online.');
  if(mode==='wallet')return adminWallet(p,target);
  if(mode==='items')return adminGive(p,target);
  return adminAccess(p,target);
 }));
}
function adminWallet(p,target){
 if(!isAdmin(p)||!adminOnline(target))return adminNotice(p,'§cAdmin access denied or player offline.');
 const d=profile(target);
 adminAction(p,'§6PLAYER WALLET',target.name+'\\nCredits: '+d.credits+'\\nOrbits: '+d.orbits,
 ['Add Credits','Remove Credits','Add Orbits','Remove Orbits','Back'],i=>{
  if(i===4)return adminChoosePlayer(p,'wallet');
  if(i<0||i>3)return;
  const key=i<2?'credits':'orbits',sign=i%2===0?1:-1;
  const operation=(sign>0?'Add ':'Remove ')+(key==='credits'?'Credits':'Orbits');
  const ui=new ModalFormData().title(operation).textField('Amount (whole number)','Enter amount',{defaultValue:'1000'});
  adminShow(p,ui,'wallet amount').then(r=>{
   if(r.canceled)return;
   const raw=String(r.formValues?.[0]??'').trim();
   const amount=/^[1-9][0-9]*$/.test(raw)?Number(raw):NaN;
   if(!Number.isSafeInteger(amount)||amount>2000000000)return adminNotice(p,'§cEnter 1 to 2,000,000,000.');
   if(!isAdmin(p)||!adminOnline(target))return adminNotice(p,'§cAdmin access lost or player offline.');
   const current=profile(target),balance=Number(current[key])||0,next=balance+sign*amount;
   if(!Number.isSafeInteger(next)||next<0||next>2000000000)return adminNotice(p,'§cInsufficient balance or limit exceeded.');
   const confirm=new MessageFormData().title('Confirm '+operation)
    .body(target.name+'\\nAmount: '+amount+'\\nBefore: '+balance+'\\nAfter: '+next)
    .button1('Cancel').button2('Confirm');
   adminShow(p,confirm,'wallet confirmation').then(c=>{
    if(c.canceled||c.selection!==1)return adminNotice(p,'§7Wallet change canceled.');
    try{
     if(!isAdmin(p)||!adminOnline(target))return adminNotice(p,'§cAccess lost or player disconnected.');
     const fresh=profile(target),now=Number(fresh[key])||0,updated=now+sign*amount;
     if(!Number.isSafeInteger(updated)||updated<0||updated>2000000000)return adminNotice(p,'§cBalance limit exceeded.');
     fresh[key]=updated;save(target,fresh);
     const verified=profile(target);
     if(Number(verified[key])!==updated)throw Error('Balance verification failed');
     adminAudit(p,sign>0?'ADD':'REMOVE',target,amount+' '+key);
     adminNotice(p,'§aSUCCESS: '+target.name+' '+key+' '+now+' → '+updated);
     adminNotice(target,'§aAdmin '+(sign>0?'added ':'removed ')+amount+' '+key+'. New balance: '+updated);
    }catch(e){adminFormError(p,'wallet save',e)}
   }).catch(e=>adminFormError(p,'wallet confirmation',e));
  }).catch(e=>adminFormError(p,'wallet amount',e));
 });
}
function adminGive(p,target){
 if(!isAdmin(p)||!adminOnline(target))return adminNotice(p,'§cAdmin access denied or player offline.');
 const ui=new ModalFormData().title('Give Item to '+target.name)
  .textField('Minecraft item ID','minecraft:diamond',{defaultValue:'minecraft:diamond'})
  .textField('Quantity (1–64)','1',{defaultValue:'1'});
 adminShow(p,ui,'give item').then(r=>{
  if(r.canceled)return;
  const id=String(r.formValues?.[0]??'').trim().toLowerCase();
  const raw=String(r.formValues?.[1]??'').trim();
  const qty=/^[1-9][0-9]*$/.test(raw)?Number(raw):NaN;
  if(!/^[a-z0-9_]+:[a-z0-9_]+$/.test(id)||!Number.isSafeInteger(qty)||qty>64)
   return adminNotice(p,'§cInvalid item ID or quantity.');
  let stack;
  try{stack=new ItemStack(id,qty)}catch(e){return adminFormError(p,'item creation',e)}
  const confirm=new MessageFormData().title('Confirm Item Delivery')
   .body('Player: '+target.name+'\\nItem: '+id+'\\nQuantity: '+qty)
   .button1('Cancel').button2('Give Items');
  adminShow(p,confirm,'give item confirmation').then(c=>{
   if(c.canceled||c.selection!==1)return adminNotice(p,'§7Item delivery canceled.');
   if(!isAdmin(p)||!adminOnline(target))return adminNotice(p,'§cAdmin access lost or player offline.');
   try{
    const inv=inventory(target);
    if(!inv)return adminNotice(p,'§cTarget inventory unavailable.');
    if(!inventoryCapacity(target,stack))return adminNotice(p,'§cNot enough room in target inventory. No items delivered.');
    const leftover=inv.addItem(stack);
    if(leftover)return adminNotice(p,'§cInventory changed; some items could not be delivered.');
    adminAudit(p,'GIVE',target,qty+' '+id);
    adminNotice(p,'§aSUCCESS: Gave '+qty+' '+id+' to '+target.name);
    adminNotice(target,'§aSkyGen Admin gave you '+qty+' '+id);
   }catch(e){adminFormError(p,'item delivery',e)}
  }).catch(e=>adminFormError(p,'item confirmation',e));
 }).catch(e=>adminFormError(p,'give item form',e));
}
function adminAccess(p,target){
 if(!isOperator(p))return adminNotice(p,'§cOnly Realm operators may manage admin access.');
 const granted=world.getDynamicProperty('sg_admin_'+target.id)===true;
 adminAction(p,'§4ADMIN ACCESS',target.name+'\\nAccess: '+(granted?'Granted':'Not granted'),
 [granted?'Revoke Admin':'Grant Admin','Back'],i=>{
  if(i===1)return adminMenu(p);
  if(i!==0)return;
  if(!isOperator(p)||!adminOnline(target))return adminNotice(p,'§cOperator access required; player must be online.');
  if(target.id===p.id)return adminNotice(p,'§cCannot change your own access.');
  const next=!granted;
  const confirm=new MessageFormData().title('Confirm Admin Access')
   .body((next?'Grant':'Revoke')+' SkyGen Admin for '+target.name+'?')
   .button1('Cancel').button2('Confirm');
  adminShow(p,confirm,'admin permission confirmation').then(c=>{
   if(c.canceled||c.selection!==1)return adminNotice(p,'§7Admin change canceled.');
   if(!isOperator(p)||!adminOnline(target))return adminNotice(p,'§cOperator access required; player offline.');
   try{
    world.setDynamicProperty('sg_admin_'+target.id,next);
    if(world.getDynamicProperty('sg_admin_'+target.id)!==next)throw Error('Permission verification failed');
    adminAudit(p,next?'GRANT ADMIN':'REVOKE ADMIN',target,'');
    adminNotice(target,next?'§aSkyGen Admin access granted.':'§cSkyGen Admin access revoked.');
    if(next)system.runTimeout(()=>issueAdminAxe(target),30);
    adminNotice(p,'§aSUCCESS: Admin access '+(next?'granted to ':'revoked from ')+target.name+'.');
   }catch(e){adminFormError(p,'access update',e)}
  }).catch(e=>adminFormError(p,'admin permission confirmation',e));
 });
}
function back(p){menu(p)}
function menu(p){const d=profile(p);form(p,'§l§bSKYGEN CORE',`§eCredits: ${d.credits}  §bOrbits: ${d.orbits}\n§dRank: ${d.rank}/50  XP: ${d.xp}  §eSP: ${skillAvailable(d)}\n§aPlot: ${d.plot+1}`,['My Plot','Visit Other Plots','Generators','Server Shop','Player Marketplace','Player Trading','Ranks','Wallet / Exchange','Teleport','Skill Tree','Daily Quests','Help'],i=>[()=>plotMenu(p),()=>visitMenu(p),()=>genMenu(p),()=>shop(p),()=>market(p),()=>trade(p),()=>ranks(p),()=>wallet(p),()=>teleports(p),()=>skillTree(p),()=>dailyQuests(p),()=>form(p,'Help','SkyGen v0.9.4. 42 generators, six-branch Skill Tree, Daily Quests, marketplace, trades, and 50 ranks. Test on a world copy first.',['Back'],()=>back(p))][i]())}
function plotMenu(p){
 const d=profile(p);
 if(d.plot<0)return p.sendMessage('§cYour plot is not assigned. Rejoin to retry.');
 const c=coords(d.plot),r=C.radius;
 const details=`§aPlot #${d.plot+1} (permanently assigned)\n§fCenter: ${c.x}, ${c.y}, ${c.z}\n§fProtected X: ${c.x-r} to ${c.x+r}\n§fProtected Z: ${c.z-r} to ${c.z+r}\n§eOnly you and trusted players can build here.\n§7One plot per player; claiming another is disabled.`;
 form(p,'§aMY PLOT',details,['Go to Plot','Show Boundaries in Chat','Manage Trusted Players','Manage Visitors','Visit Other Plots','Back'],i=>{
  if(i===0)tpPlot(p);
  if(i===1){p.sendMessage('§a'+details.replaceAll('\n',' §7| '));plotMenu(p)}
  if(i===2)trustMenu(p);
  if(i===3)visitorOwnerMenu(p);
  if(i===4)visitMenu(p);
  if(i===5)back(p);
 });
}

function trustMenu(p){const d=profile(p),id=d.plot;if(id<0)return;const list=trusted(id);const online=world.getAllPlayers().filter(q=>q.id!==p.id);const buttons=[...online.map(q=>(list.includes(q.id)?'§aTrusted: ':'§7Visitor: ')+q.name),'Remove All Trust','Back'];form(p,'§aPLOT PERMISSIONS',`Plot #${id+1}\nTrusted IDs: ${list.length}\nSelect an online player to toggle build permission.`,buttons,i=>{if(i===online.length){world.setDynamicProperty('sg_trust_'+id,'[]');p.sendMessage('§eAll plot trust revoked.');return trustMenu(p)}if(i===online.length+1)return plotMenu(p);const q=online[i];if(!q)return;const n=list.includes(q.id)?list.filter(v=>v!==q.id):[...list,q.id];world.setDynamicProperty('sg_trust_'+id,JSON.stringify(n));p.sendMessage(`§a${q.name}: ${n.includes(q.id)?'trusted':'untrusted'}`);trustMenu(p)})}


// Visiting permissions are separate from building permissions. Owner grants are
// stored in world dynamic properties so they persist after restart and logout.
function visitTeleport(p,id){
 if(!canVisit(p,id))return p.sendMessage('§cYou do not have permission to visit this plot.');
 stageAndBuildPlot(p,id,true);
}
function visitorOwnerMenu(p){
 const id=profile(p).plot;if(id<0||ownerId(id)!==p.id)return p.sendMessage('§cOnly the plot owner can manage visitors.');
 const list=visitors(id),online=world.getAllPlayers().filter(q=>q.id!==p.id);
 const choices=[...online.map(q=>`${list.includes(q.id)?'§aAllowed':'§7Not allowed'}: ${q.name}`),'Revoke All Visitors','Back'];
 form(p,'§aPLOT VISIT PERMISSIONS',`Plot #${id+1} | ${list.length} invited player(s)
Granting visit access does NOT grant building access.
Select a player to allow or revoke access.`,choices,i=>{
  if(i===online.length){setVisit(id,[]);p.sendMessage('§eAll visitor access revoked.');return visitorOwnerMenu(p)}
  if(i===online.length+1)return plotMenu(p);
  const q=online[i];if(!q)return;
  const allowed=!list.includes(q.id);setVisit(id,allowed?[...list,q.id]:list.filter(v=>v!==q.id));
  p.sendMessage(`${allowed?'§aGranted':'§eRevoked'} visit access: ${q.name}`);
  q.sendMessage(allowed?`§a${p.name} allowed you to visit plot #${id+1}. Open SkyGen Menu → Visit Other Plots.`:`§e${p.name} revoked your access to plot #${id+1}.`);
  visitorOwnerMenu(p);
 });
}
function visitMenu(p){
 const accessible=world.getAllPlayers().filter(q=>q.id!==p.id&&profile(q).plot>=0&&canVisit(p,profile(q).plot));
 const online=world.getAllPlayers().filter(q=>q.id!==p.id&&profile(q).plot>=0&&!canVisit(p,profile(q).plot));
 const choices=[...accessible.map(q=>`§aVisit ${q.name} — #${profile(q).plot+1}`),'Request Access from Player','Incoming Requests','Back'];
 form(p,'§bVISIT PLAYER PLOTS',`You may teleport only to plots whose owners have allowed you.
Visits use the normal 5-second countdown and cooldown.
Visitors cannot build unless separately trusted.`,choices,i=>{
  if(i<accessible.length){const q=accessible[i];return visitTeleport(p,profile(q).plot)}
  if(i===accessible.length)return requestVisitMenu(p,online);
  if(i===accessible.length+1)return incomingVisits(p);
  back(p);
 });
}
function requestVisitMenu(p,online){
 form(p,'§bREQUEST PLOT ACCESS','Choose an online player. They must accept before you can visit.',[...online.map(q=>`${q.name} — Plot #${profile(q).plot+1}`),'Back'],i=>{
  if(i>=online.length)return visitMenu(p);
  const owner=online[i],id=profile(owner).plot;
  if(id<0||ownerId(id)!==owner.id)return p.sendMessage('§cPlot owner unavailable.');
  const key=`${owner.id}:${p.id}`;
  visitRequests.set(key,{ownerId:owner.id,requesterId:p.id,plot:id,expires:system.currentTick+1200});
  p.sendMessage(`§aVisit request sent to ${owner.name}.`);
  owner.sendMessage(`§e${p.name} requests permission to visit your plot. Open SkyGen Menu → Visit Other Plots → Incoming Requests to respond.`);
 });
}
function incomingVisits(p){
 const id=profile(p).plot;
 if(id<0||ownerId(id)!==p.id)return p.sendMessage('§cOnly plot owners can approve requests.');
 const requests=[...visitRequests.entries()].filter(([key,r])=>r.ownerId===p.id&&r.plot===id&&r.expires>=system.currentTick&&world.getAllPlayers().some(q=>q.id===r.requesterId));
 form(p,'§aINCOMING VISIT REQUESTS',`Requests expire after 60 seconds.
Pending: ${requests.length}`,[...requests.map(([key,r])=>world.getAllPlayers().find(q=>q.id===r.requesterId)?.name||'Offline'),'Back'],i=>{
  if(i>=requests.length)return visitMenu(p);
  const [key,r]=requests[i],requester=world.getAllPlayers().find(q=>q.id===r.requesterId);
  if(!requester||r.expires<system.currentTick||profile(p).plot!==r.plot||ownerId(r.plot)!==p.id){visitRequests.delete(key);return p.sendMessage('§cRequest expired.');}
  showUI(p,new MessageFormData().title('Allow Plot Visit?').body(`Allow ${requester.name} to visit plot #${id+1}?
They will not receive building permission.
You can revoke access any time.`).button1('Deny').button2('Allow')).then(res=>{
   if(res.canceled)return;
   visitRequests.delete(key);
   if(res.selection===1&&ownerId(id)===p.id){setVisit(id,[...visitors(id),requester.id]);p.sendMessage(`§a${requester.name} may now visit your plot.`);requester.sendMessage(`§a${p.name} approved your visit! SkyGen Menu → Visit Other Plots.`)}
   else requester.sendMessage(`§c${p.name} denied your visit request.`);
  }).catch(e=>console.warn('SkyGen visit approval '+e));
 });
}

function genMenu(p){
 const count=generatorOwnerCount(p),cap=generatorSlots(p);
 form(p,'§bGENERATORS',`42 generator types across four categories.\nOwned: ${count}/${cap} slots. Upgrade production to Level 5.\n§7Use the custom generator token while looking at an open plot floor block.`,
 ['Buy Generator','My Generators / Upgrade','Back'],i=>{if(i===0)return genCategories(p);if(i===1)return myGenerators(p);back(p)});
}
function genCategories(p){
 const categories=['Starter','Mining','Nature','Endgame'];
 form(p,'§bGENERATOR TYPES',`42 types. Original generator purchases and tokens remain valid. Unlock new tiers as you rank up.`,
 [...categories.map(c=>`${c} (${GENS.filter(g=>g.category===c).length})`),'Back'],i=>{
  if(i>=categories.length)return genMenu(p);
  buyGen(p,categories[i],0);
 });
}
function myGenerators(p,page=0){
 const all=[...generators.entries()].filter(([key,g])=>g.owner===p.id);
 const pageSize=8,pages=Math.max(1,Math.ceil(all.length/pageSize)),current=Math.max(0,Math.min(page,pages-1));
 const a=all.slice(current*pageSize,current*pageSize+pageSize);
 form(p,'§bMY GENERATORS',`Owned: ${all.length}/${generatorSlots(p)} • Page ${current+1}/${pages}`,
 [...a.map(([key,g])=>`${g.type} Lv${g.level||1} @ ${g.x},${g.y},${g.z}`),
 ...(current>0?['Previous Page']:[]),...(current<pages-1?['Next Page']:[]),'Back'],i=>{
  if(i<a.length){const [key,g]=a[i];return manageGenerator(p,key,g)}
  let j=a.length;if(current>0){if(i===j)return myGenerators(p,current-1);j++}
  if(current<pages-1){if(i===j)return myGenerators(p,current+1)}
  genMenu(p);
 });
}
function manageGenerator(p,key,g){
 if(g.owner!==p.id||generators.get(key)!==g)return myGenerators(p);
 const lv=g.level||1;
 const spec=GENS.find(x=>x.name===g.type);
 const rawCost=spec?spec.cost*lv*2:0;
 const cost=discountedPrice(rawCost,perkValue(profile(p),'generatorPrice'));
 form(p,'§bMANAGE GENERATOR',`${g.type} • Level ${lv}/5\nLocation: ${g.x}, ${g.y}, ${g.z}\nUpgrade cost: ${lv>=5?'MAX LEVEL':cost+' Credits'}\nDeletion permanently removes the generator; no refund.`,['Upgrade','Delete Generator','Diagnose Generator','Admin: Force Output Test','Back'],i=>{
  if(i===2){
   const dim=world.getDimension('overworld');
   let base='unloaded',output='unloaded';
   try{base=dim.getBlock({x:g.x,y:g.y,z:g.z})?.typeId||'unloaded';output=dim.getBlock({x:g.x,y:g.y+1,z:g.z})?.typeId||'unloaded'}catch(e){genError('inspect '+e)}
   const interval=Math.max(1,Math.ceil((Number(g.period)||spec?.period||200)/20));
   const age=genLastTick<0?'never':String(system.currentTick-genLastTick)+' ticks ago';
   const lines=[`§bSkyGen Generator Deep Diagnostics v0.9.4`,`Generator: ${g.type} level ${lv} at ${g.x},${g.y},${g.z}`,`Registered: ${generators.get(key)===g} | Registry size: ${generators.size}`,`Base: ${base} | Output: ${output} | Expected: ${spec?.block||g.block}`,`Interval: ${interval}s | Empty: ${genEmptySeconds.get(key)||0}s`,`Watchdog runs: ${genWatchdogRuns} | Last heartbeat: ${age}`,`Script uptime: ${system.currentTick-genStartupTick} ticks | Current tick: ${system.currentTick}`,`Last error: ${genLastError}`,`Recent errors: ${genErrors.slice(-3).join(' ; ')||'none'}`];
   for(const line of lines)p.sendMessage(line);
   return;
  }
  if(i===3){
   if(!isOperator(p))return p.sendMessage('§cOperator only.');
   try{
    const dim=world.getDimension('overworld');const base=dim.getBlock({x:g.x,y:g.y,z:g.z}),out=dim.getBlock({x:g.x,y:g.y+1,z:g.z});
    if(!base||!out||!isGeneratorBase(g,base)||out.typeId!=='minecraft:air')return p.sendMessage('§cForce test requires registered generator base and empty output.');
    out.setType(spec?.block||g.block);genEmptySeconds.delete(key);p.sendMessage('§aForce output succeeded. Block write works; if automatic regeneration fails, heartbeat scheduling is the issue.');
   }catch(e){genError('force test '+e);p.sendMessage('§cForce test failed: '+e)}return;
  }
  if(i===0){
   if(lv>=5)return p.sendMessage('§eAlready max level.');
   showUI(p,new MessageFormData().title('Upgrade Generator').body(`Level ${lv} → ${lv+1}\nCost: ${cost} Credits\nProduction interval reduced by 20%.`).button1('Cancel').button2('Upgrade')).then(r=>{
    if(r.canceled||r.selection!==1)return;
    if(g.owner!==p.id||generators.get(key)!==g||g.level!==undefined&&g.level!==lv)return p.sendMessage('§cGenerator changed. Open the menu again.');
    const d=profile(p);if(d.credits<cost)return p.sendMessage('§cNot enough Credits.');
    const oldPeriod=g.period,oldLevel=g.level;
    g.level=lv+1;g.period=Math.max(40,Math.round(g.period*0.8));
    if(!genSave()){g.level=oldLevel;g.period=oldPeriod;return p.sendMessage('§cGenerator upgrade canceled: registry storage unavailable. No charge.')}
    try{d.credits-=cost;save(p,d)}catch(err){g.level=oldLevel;g.period=oldPeriod;genSave();return p.sendMessage('§cUpgrade payment failed; upgrade restored.')}
    p.sendMessage(`§a${g.type} upgraded to level ${g.level}.`);
   }).catch(e=>console.warn('SkyGen upgrade UI '+e));
  }else if(i===1){
   showUI(p,new MessageFormData().title('§cDELETE GENERATOR?').body(`Permanently delete ${g.type} Lv${lv} at ${g.x}, ${g.y}, ${g.z}?\nThis cannot be undone. No Credits or egg will be refunded.`).button1('Keep Generator').button2('DELETE')).then(r=>{
    if(r.canceled||r.selection!==1)return;
    if(g.owner!==p.id||generators.get(key)!==g)return p.sendMessage('§cGenerator changed. Open the menu again.');
    try{
     const dim=world.getDimension('overworld');
     const base=dim.getBlock({x:g.x,y:g.y,z:g.z});
     const output=dim.getBlock({x:g.x,y:g.y+1,z:g.z});
     if(!base||!output)return p.sendMessage('§cGenerator chunk is not loaded. Stand near it and try again.');
     if(!isGeneratorBase(g,base))return p.sendMessage('§cGenerator base missing/mismatched. Deletion cancelled to protect nearby blocks.');
     // Remove the registry first and verify. If block removal fails, restore registry.
     generators.delete(key);genEmptySeconds.delete(key);generatorOutputReady.delete(key);
     if(!genSave()){generators.set(key,g);return p.sendMessage('§cCannot save registry; nothing deleted.')}
     try{
      eraseGeneratorWorldBlocks(dim,g);
     }catch(err){generators.set(key,g);if(!genSave())genError('CRITICAL: generator rollback save failed '+key,'rollback');throw err}
     p.sendMessage(`§a${g.type} generator deleted. No refund issued.`);
    }catch(e){p.sendMessage('§cCould not delete generator. Stand near it and retry.');console.warn('SkyGen delete generator '+e)}
   }).catch(e=>console.warn('SkyGen delete UI '+e));
  }else myGenerators(p);
 });
}
function buyGen(p,category='Starter',page=0){
 const d=profile(p),list=GENS.filter(g=>g.category===category);
 const pages=Math.ceil(list.length/8),current=Math.max(0,Math.min(page,pages-1));
 const slice=list.slice(current*8,current*8+8);
 const heading=`${category} • Page ${current+1}/${pages}\nRank ${d.rank} / 50\nCredits ${d.credits}`;
 form(p,'§bBUY '+category.toUpperCase(),heading,
 [...slice.map(g=>`${d.rank<g.unlock?'§8LOCKED ':'§a'}${g.name} — ${discountedPrice(g.cost,perkValue(d,'generatorPrice'))} Credits (Rank ${g.unlock})`),
 ...(current>0?['Previous Page']:[]),...(current<pages-1?['Next Page']:[]),'Back'],i=>{
  if(i>=slice.length){let idx=slice.length;
   if(current>0){if(i===idx)return buyGen(p,category,current-1);idx++}
   if(current<pages-1){if(i===idx)return buyGen(p,category,current+1)}
   return genCategories(p);
  }
  if(!generatorRegistryLoaded)return p.sendMessage('§cGenerators still loading or registry corrupt. Purchases disabled.');
  const g=slice[i],latest=profile(p),cost=discountedPrice(g.cost,perkValue(latest,'generatorPrice'));
  if(latest.rank<g.unlock)return p.sendMessage(`§c${g.name} requires Rank ${g.unlock}.`);
  if(latest.credits<cost)return p.sendMessage('§cNot enough Credits.');
  if(!generatorTokenCustomReady)return p.sendMessage('§cGenerator custom-item use handler unavailable. Purchases disabled.');
  issueGeneratorToken(p,g,cost);
 });
}
function eligibleShopItem(it,id){return !!it&&it.typeId===id&&!it.nameTag&&it.lockMode===ItemLockMode.none&&!isTool(it)&&(!it.getLore||it.getLore().length===0)}
function inventoryCapacity(p,stack){const inv=inventory(p);if(!inv)return false;let free=0;for(let i=0;i<inv.size;i++){const it=inv.getItem(i);if(!it){free+=stack.maxAmount;continue}if(it.typeId===stack.typeId&&!it.nameTag&&it.lockMode===ItemLockMode.none&&(!it.getLore||it.getLore().length===0))free+=Math.max(0,it.maxAmount-it.amount)}return free>=stack.amount}
function shopUnitPrice(item,buying){
 const bundlePrice=buying?item.buy:item.sell;
 const unit=bundlePrice/item.count;
 if(!Number.isSafeInteger(unit)||unit<=0)throw Error('Shop pricing is not a whole Credit per item');
 return unit;
}
function safeShopSell(p,s){const inv=inventory(p);if(!inv)return false;const slots=[];let remaining=s.count;for(let i=0;i<inv.size&&remaining>0;i++){const it=inv.getItem(i);if(!eligibleShopItem(it,s.id))continue;const n=Math.min(remaining,it.amount);slots.push([i,n,it]);remaining-=n}if(remaining)return p.sendMessage('§cNot enough ordinary unlocked items.'),false;
 const d=profile(p);if(!Number.isSafeInteger(d.credits+s.sell))return false;
 const changes=[];try{for(const [slot,n,it] of slots){changes.push([slot,it.clone()]);if(n===it.amount)inv.setItem(slot,undefined);else{const reduced=it.clone();reduced.amount-=n;inv.setItem(slot,reduced)}}d.credits+=s.sell;save(p,d);return true}catch(e){for(const [slot,original] of changes){try{inv.setItem(slot,original)}catch{}}p.sendMessage('§cSale failed; inventory restoration attempted.');return false}}
function shop(p){
 const showShop=(ui,step,cb)=>{
  const attempt=(n)=>system.runTimeout(()=>{
   ui.show(p).then(r=>{
    if(r.canceled){if(String(r.cancelationReason||'').includes('UserBusy')&&n<4)return attempt(n+1);return;}
    system.runTimeout(()=>{try{cb(r)}catch(e){p.sendMessage('§cShop '+step+' error: '+e);console.warn('[SkyGen SHOP] '+step+' '+e)}},8);
   }).catch(e=>{if(n<3&&/busy/i.test(String(e)))return attempt(n+1);p.sendMessage('§cShop '+step+' error: '+e);console.warn('[SkyGen SHOP] '+step+' '+e)});
  },n?20*(n+1):8);
  attempt(0);
 };
 const first=new ActionFormData().title('§6SERVER SHOP').body('Credits only. Choose Buy or Sell.').button('Buy').button('Sell').button('Back');
 showShop(first,'main',r=>{
  if(r.selection===2)return back(p);
  const buying=r.selection===0;
  const categories=['Starter','Ores','Nether','Endgame'];
  const groupMap={Starter:[...SHOP.slice(0,2),...SHOP.filter(s=>s.category==='Starter')],Ores:[...SHOP.slice(2,4),...SHOP.filter(s=>s.category==='Ores')],Nether:SHOP.filter(s=>s.category==='Nether'),Endgame:SHOP.filter(s=>s.category==='Endgame')};
  const chooseCategory=new ActionFormData().title(buying?'BUY — CATEGORY':'SELL — CATEGORY').body('Choose a category.');
  for(const c of categories)chooseCategory.button(`${c} (${groupMap[c].length})`);
  chooseCategory.button('Back');
  showShop(chooseCategory,'shop category',c=>{
   if(c.selection>=categories.length)return shop(p);
   const items=groupMap[categories[c.selection]];
   const choosePage=(page)=>{
    const pageSize=8,slice=items.slice(page*pageSize,page*pageSize+pageSize);
    const select=new ActionFormData().title(buying?'BUY ITEMS':'SELL ITEMS').body(`${categories[c.selection]} — Page ${page+1}/${Math.ceil(items.length/pageSize)}`);
    for(const item of slice)select.button(`${item.id} (${buying?item.buy:item.sell} / ${item.count})`);
    if(page>0)select.button('Previous Page');
    if((page+1)*pageSize<items.length)select.button('Next Page');
    select.button('Back');
    showShop(select,'item selection',chosen=>{
     if(chosen.selection>=slice.length){let offset=slice.length;
      if(page>0){if(chosen.selection===offset)return choosePage(page-1);offset++}
      if((page+1)*pageSize<items.length){if(chosen.selection===offset)return choosePage(page+1)}
      return shop(p);
     }
     const item=slice[chosen.selection];
   const amountForm=new ModalFormData().title(buying?'Buy Quantity':'Sell Quantity').textField('How many items? (1–2304)','16',{defaultValue:'16'});
   showShop(amountForm,'quantity',r=>{
    const raw=String(r.formValues?.[0]??'').trim();
    const count=/^[1-9][0-9]*$/.test(raw)?Number(raw):NaN;
    if(!Number.isSafeInteger(count)||count>2304)return p.sendMessage('§cEnter a whole number from 1 to 2304.');
    // All shop bundles have integral per-item prices. Do not force buyers
    // to purchase in bundle multiples (1, 16, 64, max must all work).
    const baseUnit=shopUnitPrice(item,buying);
    const dForPrice=profile(p);
    const unitPrice=buying?discountedPrice(baseUnit,perkValue(dForPrice,'buy')):Math.min(baseUnit*2-1,baseUnit+Math.floor(baseUnit*perkValue(dForPrice,'sell')/100));
    const total=count*unitPrice;
    if(!Number.isSafeInteger(total)||total<=0)return p.sendMessage('§cInvalid price calculation.');
    const confirmation=new MessageFormData().title('Confirm Shop Transaction').body((buying?'Buy ':'Sell ')+count+' × '+item.id+'\n'+(buying?'Cost: ':'Payment: ')+total+' Credits').button1('Cancel').button2('Confirm');
    showShop(confirmation,'confirmation',c=>{
     if(c.selection!==1)return;
     if(buying){
      const d=profile(p);if(d.credits<total)return p.sendMessage('§cNot enough Credits.');
      const inv=inventory(p);if(!inv)return p.sendMessage('§cInventory unavailable.');
      const test=new ItemStack(item.id,1);const max=test.maxAmount;
      let capacity=0;
      for(let slot=0;slot<inv.size;slot++){
       const it=inv.getItem(slot);
       if(!it)capacity+=max;
       else if(eligibleShopItem(it,item.id))capacity+=Math.max(0,it.maxAmount-it.amount);
      }
      if(capacity<count)return p.sendMessage('§cNot enough inventory space.');
      let delivered=0;
      try{d.credits-=total;save(p,d)}catch(e){return p.sendMessage('§cPayment storage unavailable; no items delivered.')}
      try{
       let left=count;
       while(left>0){
        const qty=Math.min(max,left),remainder=inv.addItem(new ItemStack(item.id,qty));
        const received=qty-(remainder?.amount||0);delivered+=received;left-=qty;
        if(remainder)break;
       }
       if(delivered!==count){
        const actualCost=delivered*unitPrice,refund=total-actualCost;
        try{const latest=profile(p);latest.credits+=refund;save(p,latest)}catch(err){console.warn('[SkyGen SHOP] CRITICAL partial refund failed '+p.name+' '+err);return p.sendMessage('§cPartial shop delivery; contact admin for refund. Items delivered: '+delivered)}
        return p.sendMessage('§eOnly '+delivered+' items delivered. Charged '+actualCost+' Credits; '+refund+' refunded.');
       }
      }catch(e){console.warn('[SkyGen SHOP] delivery uncertain '+p.name+' '+e);return p.sendMessage('§cShop delivery error. Contact operator to reconcile '+total+' Credits and '+delivered+' confirmed items.')}
     }else if(!safeShopSell(p,{...item,count,sell:total}))return;
     p.sendMessage('§a'+(buying?'Purchased ':'Sold ')+count+' '+item.id+' for '+total+' Credits.');
    });
   });
  });
   };
   choosePage(0);
  });
 });
}
function wallet(p){
 const d=profile(p);
 form(p,'§eWALLET',`Credits: ${d.credits}\nOrbits: ${d.orbits}\nExchange: ${C.exchange} Credits = 1 Orbit`,['Convert Credits to Orbits','Back'],i=>{
  if(i===1)return back(p);
  if(i!==0)return;
  const latest=profile(p),max=Math.floor(Number(latest.credits||0)/C.exchange);
  const ui=new ModalFormData().title('§eEXCHANGE CREDITS')
   .textField('How many Orbits do you want? (Max affordable: '+max+')','Enter whole number',{defaultValue:'1'});
  adminShow(p,ui,'exchange quantity').then(r=>{
   if(r.canceled)return;
   const raw=String(r.formValues?.[0]??'').trim();
   const count=/^[1-9][0-9]*$/.test(raw)?Number(raw):NaN;
   const cost=count*C.exchange;
   if(!Number.isSafeInteger(count)||!Number.isSafeInteger(cost)||count<1||cost>2000000000)
    return p.sendMessage('§cEnter a valid whole number of Orbits.');
   const now=profile(p);
   if(!Number.isSafeInteger(Number(now.credits))||now.credits<cost)
    return p.sendMessage('§cInsufficient Credits. Need '+cost+', have '+now.credits+'.');
   if(!Number.isSafeInteger(Number(now.orbits))||now.orbits+count>2000000000)
    return p.sendMessage('§cOrbit wallet limit exceeded.');
   const confirm=new MessageFormData().title('§eCONFIRM EXCHANGE')
    .body('Receive: '+count+' Orbits\nCost: '+cost+' Credits\nRemaining Credits: '+(now.credits-cost))
    .button1('Cancel').button2('Confirm Exchange');
   adminShow(p,confirm,'exchange confirmation').then(c=>{
    if(c.canceled||c.selection!==1)return;
    try{
     const fresh=profile(p);
     if(!Number.isSafeInteger(Number(fresh.credits))||fresh.credits<cost)
      return p.sendMessage('§cInsufficient Credits; exchange canceled.');
     if(!Number.isSafeInteger(Number(fresh.orbits))||fresh.orbits+count>2000000000)
      return p.sendMessage('§cOrbit wallet limit exceeded; exchange canceled.');
     fresh.credits-=cost;fresh.orbits+=count;save(p,fresh);
     p.sendMessage('§aExchanged '+cost+' Credits for '+count+' Orbits.');
    }catch(e){p.sendMessage('§cExchange failed: '+e)}
   }).catch(e=>p.sendMessage('§cExchange confirmation error: '+e));
  }).catch(e=>p.sendMessage('§cExchange quantity form error: '+e));
 });
}
const RANK_NAMES=['Rookie','Miner','Builder','Explorer','Crafter','Prospector','Stoneworker','Harvester','Merchant','Apprentice','Scout','Forger','Excavator','Smith','Artisan','Engineer','Trader','Guardian','Specialist','Veteran','Challenger','Pathfinder','Master Miner','Architect','Gem Hunter','Industrialist','Champion','Commander','Warden','Elite','Baron','Overseer','Titan','Virtuoso','Conqueror','Vanguard','Oracle','Paragon','Sovereign','Legend','Ascendant','Celestial','Mythic','Immortal','Eternal','Overlord','Starborn','Cosmic','Infinity','SkyGen Master'];
function ranks(p){const d=profile(p);form(p,'§d50 RANKS',`Current: ${d.rank}/50 — ${RANK_NAMES[d.rank-1]}\nXP: ${d.xp} / 49000\nNext rank: ${d.rank>=50?'MAX':1000-(d.xp%1000)+' XP'}\nEvery rank gives skill points and Rank × 100 Credits. Every 10 ranks gives 1 Orbit and 2 bonus Skill Points.`,['Browse ranks 1–25','Browse ranks 26–50','Back'],i=>{if(i===2)return back(p);const lo=i===0?0:25;form(p,'§dRANK PROGRESSION',RANK_NAMES.slice(lo,lo+25).map((name,j)=>`${lo+j+1}. ${name} — ${1000*(lo+j)} XP`).join('\n'),['Back'],()=>ranks(p))})}
function teleports(p){form(p,'§bTELEPORTS','All teleports have a 5-second stand-still warmup and 5-second cooldown.',['Go to Spawn','Go to Plot','Back'],i=>{if(i===0)safeSpawnTravel(p);if(i===1)tpPlot(p);if(i===2)back(p)})}
// Only these ordinary materials can be reconstructed by type without losing
// enchantments, damage, or other complex item data. Legacy unknown items are
// quarantined, not sold as replacements.
const MARKET_COMMODITIES=new Set([
 'minecraft:cobblestone','minecraft:stone','minecraft:dirt','minecraft:grass_block',
 'minecraft:oak_log','minecraft:oak_planks','minecraft:spruce_log','minecraft:birch_log',
 'minecraft:iron_ingot','minecraft:gold_ingot','minecraft:copper_ingot',
 'minecraft:coal','minecraft:charcoal','minecraft:diamond','minecraft:emerald',
 'minecraft:redstone','minecraft:lapis_lazuli','minecraft:quartz',
 'minecraft:coal_ore','minecraft:iron_ore','minecraft:gold_ore',
 'minecraft:diamond_ore','minecraft:emerald_ore',
 'minecraft:obsidian','minecraft:deepslate','minecraft:gravel','minecraft:sand'
]);
for(const item of SHOP)MARKET_COMMODITIES.add(item.id);
for(const g of GENS)MARKET_COMMODITIES.add(g.block);
const MARKET_LOCK=new Set();
function marketLock(id,fn){
 if(MARKET_LOCK.has(id))return false;
 MARKET_LOCK.add(id);
 try{return fn()}catch(e){console.warn('[SkyGen MARKET] operation failed '+e);return false}
 finally{MARKET_LOCK.delete(id)}
}
function validListing(l){return l&&typeof l.id==='string'&&typeof l.seller==='string'&&typeof l.type==='string'&&Number.isSafeInteger(l.count)&&l.count>=1&&l.count<=64&&Number.isSafeInteger(l.price)&&l.price>0}
function marketPlain(it){
 try{
  // Marketplace reconstructs by type+quantity only. Reject all optional item
  // metadata that would otherwise disappear on purchase or cancellation.
  return !!it&&MARKET_COMMODITIES.has(it.typeId)&&it.amount>=1&&it.amount<=64&&
   !it.nameTag&&!it.keepOnDeath&&it.lockMode===ItemLockMode.none&&
   (!it.getLore||it.getLore().length===0)&&
   (!it.getCanPlaceOn||it.getCanPlaceOn().length===0)&&
   (!it.getCanDestroy||it.getCanDestroy().length===0)&&
   (!it.getDynamicPropertyIds||it.getDynamicPropertyIds().length===0);
 }catch(e){return false}
}
// Seller payout queue: each entry has a unique, increasing sequence number.
// The paid watermark is saved in the SAME player profile write as the Credits.
// Clearing the world queue afterward can fail without issuing duplicate Credits.
function sellerQueueKey(id){return 'sg_proceeds_v2_'+id}
function sellerSeqKey(id){return 'sg_proceeds_seq_'+id}
function queueSellerPayout(seller,listingId,price){
 if(!Number.isSafeInteger(price)||price<=0||price>2000000000)throw Error('Invalid proceeds amount');
 const key=sellerQueueKey(seller),raw=world.getDynamicProperty(key);
 let queue=raw===undefined||raw===null?[]:JSON.parse(String(raw));
 if(!Array.isArray(queue))throw Error('Invalid seller proceeds queue');
 if(queue.some(x=>x.id===listingId))return true; // retry cannot enqueue twice
 const seq=Number(world.getDynamicProperty(sellerSeqKey(seller))||0);
 if(!Number.isSafeInteger(seq)||seq<0||seq>=2000000000)throw Error('Seller settlement sequence exhausted');
 const entry={id:listingId,seq:seq+1,price};
 const value=JSON.stringify([...queue,entry]);
 if(value.length>24000)throw Error('Seller payout queue capacity reached; operator review');
 world.setDynamicProperty(sellerSeqKey(seller),seq+1);
 if(world.getDynamicProperty(sellerSeqKey(seller))!==seq+1)throw Error('Payout sequence write failed');
 world.setDynamicProperty(key,value);
 if(world.getDynamicProperty(key)!==value)throw Error('Seller payout queue verification failed');
 return true;
}
function settleSellerProceeds(p,d){
 // v0.9 legacy pending Credits use a separate flag in the same atomic profile write.
 const legacyKey='sg_proceeds_'+p.id,legacy=Number(world.getDynamicProperty(legacyKey)||0);
 if(legacy>0){
  if(!Number.isSafeInteger(legacy)||legacy>2000000000)throw Error('Invalid legacy seller proceeds');
  if(!d.marketLegacyProceedsApplied){
   if(!Number.isSafeInteger(d.credits+legacy)||d.credits+legacy>2000000000)throw Error('Legacy seller payout wallet cap');
   d.credits+=legacy;d.marketLegacyProceedsApplied=true;save(p,d);
  }
  world.setDynamicProperty(legacyKey,0);
  if(world.getDynamicProperty(legacyKey)!==0)throw Error('Legacy proceeds clear not verified');
 }
 const key=sellerQueueKey(p.id),raw=world.getDynamicProperty(key);
 if(raw===undefined||raw===null)return;
 const entries=JSON.parse(String(raw));
 if(!Array.isArray(entries))throw Error('Invalid seller payout list');
 entries.sort((a,b)=>a.seq-b.seq);
 let watermark=Number(d.marketPayoutSeq||0),paid=0;
 for(const entry of entries){
  if(!entry||!Number.isSafeInteger(entry.seq)||entry.seq<1||!Number.isSafeInteger(entry.price)||entry.price<1)throw Error('Invalid seller settlement entry');
  if(entry.seq<=watermark)continue;
  if(!Number.isSafeInteger(d.credits+entry.price)||d.credits+entry.price>2000000000)throw Error('Seller payout exceeds wallet cap');
  d.credits+=entry.price;
  d.marketPayoutSeq=entry.seq;
  save(p,d); // balance and replay marker persisted together
  watermark=entry.seq;paid+=entry.price;
 }
 if(paid)p.sendMessage('§aMarketplace sales collected: '+paid+' Credits.');
 const remaining=entries.filter(x=>x.seq>watermark),value=JSON.stringify(remaining);
 world.setDynamicProperty(key,value);
 if(world.getDynamicProperty(key)!==value)throw Error('Seller payout cleanup needs review (safe to retry)');
}
function securityReviewCommand(actor){
 if(!isOperator(actor))return actor.sendMessage('§cOperator permission required.');
 try{
  const ids=world.getDynamicPropertyIds();let flagged=0;
  for(const key of ids){
   if(key.startsWith('sg_token_')&&key!==TOKEN_SEQ_KEY){
    let r;try{r=JSON.parse(String(world.getDynamicProperty(key)))}catch{}
    if(!r||['pending','redeeming','review'].includes(r.status)){
     flagged++;if(flagged<=20)actor.sendMessage('§eTOKEN '+key+' '+String(r?.status||'corrupt')+' owner='+String(r?.owner||'?')+' '+String(r?.reason||''));
    }
   }else if(key.startsWith('sg_trade_review_')){
    flagged++;if(flagged<=20)actor.sendMessage('§cTRADE '+key+' '+String(world.getDynamicProperty(key)).slice(0,130));
   }
  }
  actor.sendMessage('§eSkyGen security review: '+flagged+' flagged records (showing first 20). Review logs and player inventories before changing them.');
 }catch(err){actor.sendMessage('§cSecurity records unavailable: '+String(err).slice(0,100))}
}
function marketReviewCommand(actor){
 if(!isOperator(actor))return actor.sendMessage('§cOperator permission required.');
 const flagged=marketRead().filter(l=>l.status==='review'||l.status==='reserved'||l.status==='returning'||l.status==='creating'||l.status==='sold');
 actor.sendMessage('§eSkyGen market transactions needing review: '+flagged.length);
 for(const l of flagged.slice(0,25))actor.sendMessage('§6'+l.id+' §7'+l.status+' seller='+l.sellerName+' buyer='+(l.buyer||'none')+' '+l.type+' ×'+l.count+' Credits='+l.price+' '+String(l.reviewReason||''));
}
function marketRecover(){
 const records=marketRead();let dirty=false;
 for(const l of records){
  if(!validListing(l)||!MARKET_COMMODITIES.has(l.type)){
   if(l.status!=='review'){l.status='review';l.reviewReason='Legacy/unsupported item; do not reconstruct metadata';dirty=true}
  }else if(['reserved','sold','returning','creating'].includes(l.status)){
   l.reviewReason='Interrupted '+l.status+' transaction; operator must reconcile inventory and wallet';l.status='review';dirty=true;
  }
 }
 if(dirty){try{marketSave(records)}catch(e){console.warn('[SkyGen MARKET] recovery markers could not save '+e)}}
}
system.runTimeout(()=>{try{marketRecover()}catch(e){console.warn('[SkyGen MARKET] Recovery blocked; data preserved '+e)}},60);
function market(p){
 const d=profile(p),all=marketRead(),reviews=all.filter(l=>l.status==='review').length;
 form(p,'§6PLAYER MARKET',`Active listings: ${all.filter(l=>!l.status||l.status==='active').length}/${MAX_LISTINGS}\nCredits: ${d.credits}\nRestricted to plain commodity items.${reviews?'\n§c'+reviews+' listing(s) need operator review.':''}`,
 ['Browse Listings','List an Item','My Listings / Cancel','Back'],i=>{if(i===0)marketBrowse(p);if(i===1)marketCreate(p);if(i===2)marketMine(p);if(i===3)back(p)});
}
function marketCreate(p){
 const choices=itemChoices(p).filter(x=>marketPlain(x.it));
 if(!choices.length)return p.sendMessage('§cNo ordinary supported commodity items to list.');
 form(p,'LIST COMMODITY','Only plain, unlocked commodity stacks are eligible.',
  [...choices.map(x=>`${x.it.typeId} ×${x.it.amount}`),'Back'],i=>{
  if(i>=choices.length)return market(p);
  const x=choices[i];const ui=new ModalFormData().title('Set Listing Price').textField('Credits (1–2,000,000,000)','Example: 1000');
  showUI(p,ui).then(r=>{
   if(r.canceled)return;
   const raw=String(r.formValues?.[0]??'').trim();const price=/^[1-9][0-9]*$/.test(raw)?Number(raw):NaN;
   if(!Number.isSafeInteger(price)||price>2000000000)return p.sendMessage('§cInvalid whole-number listing price.');
   marketLock('market',()=>{
    let all=marketRead();if(all.filter(l=>!l.status||l.status==='active').length>=MAX_LISTINGS)return p.sendMessage('§cMarket active listing capacity reached.');
    if(all.filter(l=>l.seller===p.id&&(!l.status||l.status==='active')).length>=5)return p.sendMessage('§cYou may have at most five active listings.');
    const it=inventory(p)?.getItem(x.slot);
    if(!marketPlain(it)||it.typeId!==x.it.typeId||it.amount!==x.it.amount)return p.sendMessage('§cItem changed. Try again.');
    const stack=it.clone(),id=p.id+':'+system.currentTick+':'+Math.floor(Math.random()*100000);
    const listing={id,seller:p.id,sellerName:p.name,type:it.typeId,count:it.amount,price,status:'creating'};
    try{marketSave([...all,listing])}catch(e){return p.sendMessage('§cMarketplace storage unavailable; item retained.')} 
    try{
     if(!removeExact(p,x.slot,it.typeId,it.amount))throw Error('Item changed during escrow');
    }catch(e){
     // Removal definitely failed: attempt to remove phantom creating listing.
     try{marketSave(marketRead().filter(l=>l.id!==id))}catch(err){console.warn('[SkyGen MARKET] listing cleanup '+err)}
     return p.sendMessage('§cListing canceled. Verify your inventory.');
    }
    all=marketRead();const record=all.find(l=>l.id===id);
    if(!record){console.warn('[SkyGen MARKET] CRITICAL: escrow record disappeared '+id);return p.sendMessage('§cEscrow needs operator review: '+id)}
    record.status='active';
    try{marketSave(all);p.sendMessage('§aCommodity listed and securely escrowed.')}
    catch(e){
     // Do not place item back into inventory if storage state is uncertain,
     // because another process could still see the active listing.
     console.warn('[SkyGen MARKET] CRITICAL: listing activation failed '+id+' '+e);
     p.sendMessage('§cEscrow pending review; contact an operator with listing '+id);
    }
   });
  }).catch(e=>p.sendMessage('§cListing UI error: '+e));
 });
}
function marketBrowse(p){
 const a=marketRead().filter(validListing).filter(l=>(!l.status||l.status==='active')&&MARKET_COMMODITIES.has(l.type));
 if(!a.length)return form(p,'MARKET','No available commodity listings.',['Back'],()=>market(p));
 form(p,'§6BUY COMMODITIES','Select a listing to purchase.',[...a.map(x=>`${x.type} ×${x.count} — ${x.price} Credits (${x.sellerName})`),'Back'],i=>{
  if(i>=a.length)return market(p);
  const listing=a[i];if(listing.seller===p.id)return p.sendMessage('§eCannot buy your own listing.');
  showUI(p,new MessageFormData().title('Confirm Purchase').body(`${listing.type} ×${listing.count}\nCost: ${listing.price} Credits`).button1('Cancel').button2('Buy')).then(r=>{
   if(r.canceled||r.selection!==1)return;
   marketLock('market',()=>{
    const all=marketRead(),idx=all.findIndex(l=>l.id===listing.id&&(!l.status||l.status==='active'));
    if(idx<0)return p.sendMessage('§cListing unavailable.');
    const l=all[idx];if(!validListing(l)||!MARKET_COMMODITIES.has(l.type))return p.sendMessage('§cListing needs operator review.');
    const d=profile(p);if(d.credits<l.price)return p.sendMessage('§cNot enough Credits.');
    const stack=new ItemStack(l.type,l.count);if(!inventoryCapacity(p,stack))return p.sendMessage('§cFree inventory space first.');
    l.status='reserved';l.buyer=p.id;l.buyerName=p.name;
    try{marketSave(all)}catch(e){return p.sendMessage('§cCannot reserve listing; no payment taken.')} 
    try{d.credits-=l.price;save(p,d)}catch(e){
     l.status='review';l.reviewReason='Buyer debit status uncertain; operator review required';
     try{marketSave(all)}catch{}return p.sendMessage('§cPayment error; operator review required. No automatic retry.');
    }
    try{if(inventory(p).addItem(stack))throw Error('Inventory capacity changed during delivery')}
    catch(e){
     l.status='review';l.reviewReason='Buyer charged; item delivery uncertain. Check inventory before any refund';
     try{marketSave(all)}catch{}return p.sendMessage('§cDelivery requires operator review. Do not repurchase listing.');
    }
    l.status='sold';
    try{marketSave(all)}catch(e){return p.sendMessage('§cItem delivered; seller settlement requires operator review.')} 
    try{
     queueSellerPayout(l.seller,l.id,l.price);
     // Delete the sold listing only after the settlement is in the verified queue.
     marketSave(marketRead().filter(x=>x.id!==l.id));
     p.sendMessage('§aPurchase complete!');
     const seller=world.getAllPlayers().find(q=>q.id===l.seller);
     seller?.sendMessage('§aMarket sale: '+l.price+' Credits pending collection.');
    }catch(err){
     console.warn('[SkyGen MARKET] SALE REVIEW: '+l.id+' '+err);
     p.sendMessage('§eDelivered. Seller payment needs operator review; do not rebuy this listing.');
    }
   });
  }).catch(e=>p.sendMessage('§cPurchase form error: '+e));
 });
}
function marketMine(p){
 const mine=marketRead().filter(l=>l.seller===p.id);
 const active=mine.filter(l=>(!l.status||l.status==='active')&&validListing(l)&&MARKET_COMMODITIES.has(l.type));
 const needsReview=mine.filter(l=>l.status==='review');
 form(p,'MY MARKET LISTINGS',needsReview.length?'§c'+needsReview.length+' item(s) require operator review. Use /scriptevent skygen:marketreview as operator.':'Cancel active listings to recover commodity items.',
 [...active.map(x=>`${x.type} ×${x.count} — ${x.price} Credits`),'Back'],i=>{
  if(i>=active.length)return market(p);
  const selected=active[i];
  marketLock('market',()=>{
   const all=marketRead(),idx=all.findIndex(l=>l.id===selected.id&&l.seller===p.id&&(!l.status||l.status==='active'));
   if(idx<0)return p.sendMessage('§cListing unavailable.');
   const l=all[idx];const stack=new ItemStack(l.type,l.count);
   if(!inventoryCapacity(p,stack))return p.sendMessage('§cFree inventory space first.');
   l.status='returning';try{marketSave(all)}catch(e){return p.sendMessage('§cCould not reserve cancellation.')} 
   try{if(inventory(p).addItem(stack))throw Error('Inventory changed during return')}
   catch(e){
    l.status='review';l.reviewReason='Return delivery uncertain; inspect inventory before reactivation';
    try{marketSave(all)}catch{}return p.sendMessage('§cCancellation needs operator review.');
   }
   try{marketSave(marketRead().filter(x=>x.id!==l.id));p.sendMessage('§aListing cancelled; commodity returned.')}
   catch(e){p.sendMessage('§cReturn delivered; listing cleanup needs operator review.');console.warn('[SkyGen MARKET] return listing cleanup '+l.id+' '+e)}
  });
 });
}
function tradeBusy(p){const t=trades.get(p.id);if(!t)return false;const online=world.getAllPlayers();if(t.closed||system.currentTick-t.created>600||!online.some(x=>x.id===t.a)||!online.some(x=>x.id===t.b)){tradeClose(t,'Expired or abandoned trade cleared.');return false;}return true}
function trade(p){const online=world.getAllPlayers().filter(q=>q.id!==p.id);form(p,'§dDIRECT TRADING','Select an online player to propose an item-for-item trade. Both must confirm the exact offers.',[...online.map(q=>q.name),'Back'],i=>{if(i>=online.length)return back(p);const q=online[i];if(tradeBusy(p)||tradeBusy(q))return p.sendMessage('§cOne player is already trading. Ask them to cancel or wait up to 30 seconds.');tradeOffer(p,q)})}
function tradeOffer(p,q){const a=itemChoices(p).filter(x=>!x.it.nameTag&&(!x.it.getLore||x.it.getLore().length===0));if(!a.length)return p.sendMessage('§cNo eligible item stacks.');form(p,'OFFER ITEM',`Trading with ${q.name}. Select the stack to offer.`,[...a.map(x=>`${x.it.typeId} ×${x.it.amount}`),'Cancel'],i=>{if(i>=a.length)return;const x=a[i];tradeInvite(p,q,x.slot,x.it.typeId,x.it.amount)})}
function tradeInvite(p,q,slot,type,count){if(tradeBusy(p)||tradeBusy(q))return p.sendMessage('§cA trade is already active.');const id=`${p.id}-${system.currentTick}`,t={id,a:p.id,b:q.id,aSlot:slot,aType:type,aCount:count,created:system.currentTick,closed:false};trades.set(p.id,t);trades.set(q.id,t);system.runTimeout(()=>{if(trades.get(p.id)===t||trades.get(q.id)===t)tradeClose(t,'Trade timed out after 30 seconds.');},600);form(q,'§dTRADE REQUEST',`${p.name} offers ${type} ×${count}. Choose a stack to exchange.`,['Choose My Item','Decline'],i=>{if(trades.get(p.id)!==t)return;if(i===1)return tradeClose(t,'Trade declined.');const a=itemChoices(q).filter(x=>!x.it.nameTag&&(!x.it.getLore||x.it.getLore().length===0));if(!a.length)return tradeClose(t,'No eligible trade items.');form(q,'YOUR OFFER',`Exchange with ${p.name}`,[...a.map(x=>`${x.it.typeId} ×${x.it.amount}`),'Cancel'],j=>{if(j>=a.length)return tradeClose(t,'Trade cancelled.');const x=a[j];t.bSlot=x.slot;t.bType=x.it.typeId;t.bCount=x.it.amount;t.aOK=false;t.bOK=false;tradeConfirm(p,q,t)})})}
function tradeClose(t,message){if(t.closed)return;t.closed=true;if(trades.get(t.a)===t)trades.delete(t.a);if(trades.get(t.b)===t)trades.delete(t.b);for(const p of world.getAllPlayers())if(p.id===t.a||p.id===t.b)p.sendMessage('§e'+message)}
function tradeConfirm(p,q,t){const body=`${p.name}: ${t.aType} ×${t.aCount}\n${q.name}: ${t.bType} ×${t.bCount}\nBoth players must accept. No currency is transferred.`;for(const [player,field] of [[p,'aOK'],[q,'bOK']])showUI(player,new MessageFormData().title('§dCONFIRM TRADE').body(body).button1('Decline').button2('Accept')).then(r=>{if(trades.get(player.id)!==t)return;if(r.canceled||r.selection!==1)return tradeClose(t,'Trade cancelled.');t[field]=true;if(t.aOK&&t.bOK)system.run(()=>tradeExecute(p,q,t))}).catch(()=>tradeClose(t,'Trade UI closed.'))}
function tradeExecute(p,q,t){
 if(trades.get(p.id)!==t||trades.get(q.id)!==t||t.executing||t.closed)return;
 t.executing=true;
 try{
  if(p.isValid===false||q.isValid===false)return tradeClose(t,'Trade canceled: player disconnected.');
  const aInv=inventory(p),bInv=inventory(q);
  const ai=aInv?.getItem(t.aSlot),bi=bInv?.getItem(t.bSlot);
  if(!ai||!bi||!aInv||!bInv||ai.typeId!==t.aType||bi.typeId!==t.bType||ai.amount!==t.aCount||bi.amount!==t.bCount||
     ai.nameTag||bi.nameTag||ai.keepOnDeath||bi.keepOnDeath||ai.lockMode!==ItemLockMode.none||bi.lockMode!==ItemLockMode.none||
     (ai.getLore&&ai.getLore().length)||(bi.getLore&&bi.getLore().length))return tradeClose(t,'Items changed; trade canceled.');
  if(typeof aInv.swapItems!=='function')return tradeClose(t,'Trade unavailable: atomic slot swapping not supported by this server.');
  try{
   aInv.swapItems(t.aSlot,t.bSlot,bInv);
   // Verify post-swap shape, including quantity and type, before reporting success.
   const aNow=aInv.getItem(t.aSlot),bNow=bInv.getItem(t.bSlot);
   if(!aNow||!bNow||aNow.typeId!==t.bType||aNow.amount!==t.bCount||bNow.typeId!==t.aType||bNow.amount!==t.aCount)throw Error('Swap verification uncertain');
   return tradeClose(t,'Trade completed successfully!');
  }catch(err){
   console.warn('[SkyGen TRADE] operator review '+t.id+' '+err);
   try{world.setDynamicProperty('sg_trade_review_'+t.id,JSON.stringify({a:t.a,b:t.b,at:Date.now(),aSlot:t.aSlot,bSlot:t.bSlot,aType:t.aType,bType:t.bType,reason:String(err).slice(0,100)}))}catch(e){console.warn('[SkyGen TRADE] failed to record review '+e)}
   return tradeClose(t,'Trade result needs operator review. Do not repeat this trade until inventories are checked.');
  }
 }catch(e){return tradeClose(t,'Trade canceled safely: '+e)}
}
function removeItemType(p,type,count){const inv=inventory(p);for(let i=0;i<inv.size&&count>0;i++){const it=inv.getItem(i);if(it?.typeId!==type||it.nameTag)continue;const n=Math.min(count,it.amount);removeExact(p,i,type,n);count-=n}}
world.afterEvents.playerSpawn.subscribe(e=>{
 const p=e.player,initial=!!e.initialSpawn;
 // Schedule rescue as soon as possible, before plot claims or menus.
 // The later handler is a fallback if the player was not yet valid at tick 1.
 if(initial)system.runTimeout(()=>{try{if(p.isValid)safeSpawnTravel(p,true)}catch(err){console.warn('SkyGen early spawn rescue '+err)}},1);
 system.runTimeout(()=>{try{
 // Rescue scheduling MUST happen even if a damaged plot/profile prevents claiming.
 if((initial&&!spawnStages.has(p.id)&&!cooldowns.has(p.id))||(p.location.y < -50&&!spawnStages.has(p.id)))safeSpawnTravel(p,true);
 const d=claim(p);
 try{settleSellerProceeds(p,d)}catch(err){console.warn('[SkyGen MARKET] Seller proceeds need operator review '+p.id+' '+err);p.sendMessage('§cMarketplace proceeds settlement needs operator review.');}
 rank(p,d);ensure(p);
 // Fresh flat-void worlds start near Y=-63. Put players on the protected platform.
 // Initial join rescue is immediate; subsequent horn/menu teleports use warm-up.
 // Spawn rescue was already requested before assignment; never blindly teleport.
 p.sendMessage('§bSkyGen: menu compass slot 7, spawn horn slot 8, plot horn slot 9.');
 }catch(err){console.warn('SkyGen join '+err)}},30);
});
world.afterEvents.itemUse.subscribe(e=>{
 const p=e.source,i=e.itemStack;
 if(adminAxe(i)){system.run(()=>adminMenu(p));return}
 if(toolmatch(i,TOOLS[0]))system.run(()=>menu(p));
 if(toolmatch(i,TOOLS[1]))system.run(()=>{if(p.location.y<-50){const t=pending.get(p.id);pending.delete(p.id);finishPendingTeleport(t);safeSpawnTravel(p,true)}else safeSpawnTravel(p)});
 if(toolmatch(i,TOOLS[2]))system.run(()=>tpPlot(p));
});
// Generator tokens must be issued, uniquely identified, and redeemed by the server.
// The token record is authoritative, not the egg's display name or its lore.
// ItemStack dynamic properties require non-stackable items in Bedrock stable.
// Goat horns are non-stackable and reliably fire the existing itemUse event on Xbox.
// Legacy v0.9.2 goat horns remain redeemable; v0.9.3 purchases use custom items.
const GENERATOR_TOKEN_ITEM='minecraft:goat_horn';
let generatorTokenCustomReady=false;
const TOKEN_SEQ_KEY='sg_token_seq';
const generatorOutputReady=new Set();
function tokenKey(id){return 'sg_token_'+id}
function tokenId(it){try{return String(it?.getDynamicProperty?.('sg_token_id')||'')}catch{return ''}}
function tokenRead(id){
 if(!/^[1-9][0-9]*$/.test(String(id)))return null;
 const raw=world.getDynamicProperty(tokenKey(id));
 if(typeof raw!=='string')return null;
 const r=JSON.parse(raw);
 if(!r||r.v!==1||!['pending','issued','redeeming','spent','review'].includes(r.status)||typeof r.owner!=='string'||typeof r.type!=='string')return null;
 return r;
}
function tokenWrite(id,r){
 const value=JSON.stringify(r);world.setDynamicProperty(tokenKey(id),value);
 if(world.getDynamicProperty(tokenKey(id))!==value)throw Error('Generator token ledger write not verified');
}
function issueGeneratorToken(p,g,price){
 if(!generatorTokenCustomReady)return p.sendMessage('§cGenerator custom-item use handler is not active; cannot issue tokens.');
 const latest=profile(p),inv=inventory(p);
 if(!inv||latest.rank<g.unlock||latest.credits<price)return p.sendMessage('§cNot eligible or Credits changed.');
 const egg=new ItemStack(generatorItemId(g),1);
 if(egg.maxAmount!==1)return p.sendMessage('§cSecure generator token item is not non-stackable; purchase blocked without charge.');
 egg.nameTag=`§bSkyGen ${g.name} Generator`;
 egg.setLore([`Generator type: ${g.name}`,'Server-verified token. Use on your plot.']);
 const seq=Number(world.getDynamicProperty(TOKEN_SEQ_KEY)||0);
 if(!Number.isSafeInteger(seq)||seq<0||seq>=2000000000)return p.sendMessage('§cGenerator issuance registry limit.');
 const id=String(seq+1);
 try{egg.setDynamicProperty('sg_token_id',id);if(tokenId(egg)!==id)throw Error('Token identity did not survive an item read')}catch(err){return p.sendMessage('§cItem token identity unavailable; purchase disabled. '+String(err).slice(0,90))}
 if(!inventoryCapacity(p,egg))return p.sendMessage('§cInventory full. No charge.');
 try{
  world.setDynamicProperty(TOKEN_SEQ_KEY,seq+1);
  if(world.getDynamicProperty(TOKEN_SEQ_KEY)!==seq+1)throw Error('Token sequence not saved');
  tokenWrite(id,{v:1,status:'pending',owner:p.id,type:g.name,price});
 }catch(err){return p.sendMessage('§cToken registry unavailable. No Credits spent. '+String(err).slice(0,90))}
 try{latest.credits-=price;save(p,latest)}catch(err){return p.sendMessage('§cWallet unavailable. Token issuance reserved but disabled; no item delivered.')}
 try{tokenWrite(id,{v:1,status:'issued',owner:p.id,type:g.name,price})}catch(err){
  genError('CRITICAL: paid generator token '+id+' cannot activate '+err,'token');
  return p.sendMessage('§cToken activation needs operator review: #'+id);
 }
 try{
  if(inv.addItem(egg))throw Error('Inventory full or item delivery uncertain');
  p.sendMessage(`§aPurchased ${g.name} generator token (#${id}) for ${price} Credits.`);
 }catch(err){
  // NO AUTOMATIC REFUND: the item may already be delivered on an ambiguous write.
  try{tokenWrite(id,{v:1,status:'review',owner:p.id,type:g.name,price,reason:'Delivery uncertain'})}catch{}
  genError('CRITICAL: generator token delivery review '+id+' '+err,'token');
  p.sendMessage('§cToken delivery needs operator review #'+id+'. Do not purchase another.');
 }
}
// Operator-reviewed migration path for genuine legacy generator eggs without issued IDs.
// The operator must verify the customer's older purchase; no name-only automatic redemption.
function adminTokenRestore(actor,message){
 if(!isOperator(actor))return actor.sendMessage('§cOnly operators can reissue verified generator tokens.');
 const match=/^\s*(.+?)\s*\|\s*(.+?)\s*$/.exec(String(message||''));
 if(!match)return actor.sendMessage('§eUsage: /scriptevent skygen:tokenrestore PlayerName | Generator Name');
 const target=playerByName(match[1]),g=GENS.find(x=>x.name.toLowerCase()===match[2].toLowerCase());
 if(!target||!g)return actor.sendMessage('§cOnline player or generator type not found.');
 try{
  if(profile(target).rank<g.unlock)return actor.sendMessage('§cTarget player has not unlocked this generator rank.');
  const before=Number(world.getDynamicProperty(TOKEN_SEQ_KEY)||0);
  issueGeneratorToken(target,g,0);
  const after=Number(world.getDynamicProperty(TOKEN_SEQ_KEY)||0);
  const delivered=after>before&&!![...Array(inventory(target)?.size||0).keys()].some(slot=>tokenId(inventory(target).getItem(slot))===String(after));
  if(delivered){console.warn('[SkyGen SECURITY] operator '+actor.name+' reissued '+g.name+' token to '+target.name+' #'+after);actor.sendMessage('§aIssued verified replacement token #'+after+'; inspect player inventory and records.');}
  else actor.sendMessage('§cToken restoration not verified; check player inventory and security records before retrying.');
 }catch(e){actor.sendMessage('§cToken restoration failed: '+String(e).slice(0,100))}
}
function rollbackGeneratorBlocks(dim,loc,spec,baseWasAir){
 try{const out=dim.getBlock({x:loc.x,y:loc.y+1,z:loc.z});if(out?.typeId===spec.block)out.setType('minecraft:air')}catch(e){genError('Generator output rollback '+e,'rollback')}
 if(baseWasAir)try{const base=dim.getBlock(loc),core=GENERATOR_CORE_BY_NAME.get(spec.name);if(base?.typeId===core)base.setType('minecraft:air')}catch(e){genError('Generator base rollback '+e,'rollback')}
}
function placeGeneratorToken(p,selected,id){
 let record;
 try{
  if(!p?.isValid)return;
  const inv=inventory(p),stack=inv?.getItem(selected);record=tokenRead(id);
  if(!record||record.status!=='issued'||record.owner!==p.id||!stack||!validTokenItemType(stack.typeId,record.type)||stack.amount!==1||tokenId(stack)!==id){
   return p.sendMessage('§cInvalid, already used, or unissued generator token. Ask an operator for help.');
  }
  const g=GENS.find(x=>x.name===record.type);
  if(!g||stack.nameTag!==`§bSkyGen ${g.name} Generator`)return p.sendMessage('§cGenerator token identity mismatch.');
  const d=profile(p);
  if(d.rank<g.unlock||!belongs(p,p.location.x,p.location.z)||ownerId(d.plot)!==p.id||p.dimension?.id!=='minecraft:overworld')return p.sendMessage('§cGenerator requires its unlock rank and your own Overworld plot.');
  if(!generatorRegistryLoaded||generators.size>=GEN_REGISTRY_LIMIT)return p.sendMessage('§cGenerator registry unavailable or full. Token retained.');
  if(generatorOwnerCount(p)>=generatorSlots(p))return p.sendMessage('§cGenerator slot limit reached.');
  if(g.name==='Ancient Debris'&&[...generators.values()].some(x=>x.owner===p.id&&x.type===g.name))return p.sendMessage('§cOnly one Ancient Debris generator per player.');
  const hit=p.getBlockFromViewDirection({maxDistance:6,includeLiquidBlocks:false,includePassableBlocks:false});
  if(!hit?.block)return p.sendMessage('§cLook directly at a block inside your plot.');
  const target=hit.block.location,loc={x:target.x,y:target.y+1,z:target.z};
  if(plotAt(loc.x,loc.z)!==d.plot||loc.y<1||loc.y>300)return p.sendMessage('§cInvalid generator placement location.');
  const key=`${loc.x},${loc.y},${loc.z}`;
  if(generators.has(key))return p.sendMessage('§cGenerator already registered at that location.');
  const dim=world.getDimension('overworld'),base=dim.getBlock(loc),out=dim.getBlock({x:loc.x,y:loc.y+1,z:loc.z});
  if(!base||!out||!base.isAir||!out.isAir)return p.sendMessage('§cTwo free spaces required; existing blocks are never replaced. Token retained.');
  const baseWasAir=base.isAir;
  // Reserve first, then debit the exact event slot before granting anything.
  tokenWrite(id,{...record,status:'redeeming'});
  try{
   const current=inv.getItem(selected);
   if(!current||current.amount!==1||tokenId(current)!==id)throw Error('Token changed before debit');
   inv.setItem(selected,undefined);
   if(inv.getItem(selected))throw Error('Token debit could not be verified');
  }catch(e){
   // The slot may be uncertain. Quarantine the token instead of allowing reuse.
   try{tokenWrite(id,{...record,status:'review',reason:'Debit uncertain'})}catch{}
   return p.sendMessage('§cToken debit uncertain. Operator review required #'+id);
  }
  const gen={...loc,owner:p.id,type:g.name,period:g.period,block:g.block,last:system.currentTick,elapsed:0};
  let committed=false;
  try{
   if(!buildGenerator(gen))throw Error('Generator placement blocked');
   generators.set(key,gen);
   if(!genSave())throw Error('Generator storage commit failed');
   committed=true;
  }catch(err){
   generators.delete(key);generatorOutputReady.delete(key);
   rollbackGeneratorBlocks(dim,loc,g,baseWasAir);
   // Do not refund if the registry commit might have reached disk despite a failed verification.
   // Hold the original token in a review ledger for manual reconciliation.
   try{tokenWrite(id,{...record,status:'review',reason:'Generator commit/rollback uncertain: '+String(err).slice(0,70)})}catch{}
   genError('Generator redemption requires review #'+id+' '+err,'redemption');
   return p.sendMessage('§cGenerator placement failed. Token #'+id+' held for operator recovery; no automatic duplicate item.');
  }
  if(committed){
   generatorOutputReady.add(key);
   try{tokenWrite(id,{...record,status:'spent'})}catch(err){genError('Token spent marker unavailable #'+id+' '+err,'token')}
   try{const pd=profile(p);recordDaily(pd,'placements');save(p,pd)}catch(err){console.warn('[SkyGen DAILY] generator placement '+err)}
   p.sendMessage(`§aPlaced ${g.name} custom-core generator at ${loc.x},${loc.y},${loc.z}.`);
  }
 }catch(err){
  genError('CRITICAL generator token redemption #'+id+' '+err,'redemption');
  p?.sendMessage?.('§cGenerator redemption failed safely; operator review #'+id);
 }
}
// Namespaced component shared by 42 distinct non-stackable custom items.
// Handler registration occurs in Bedrock's early startup event, not on a join.
// Both controller 'use in air' and 'use on block' enter the same secured path.
const customTokenUsePending=new Set();
function queueCustomGeneratorUse(event){
 const p=event.source,item=event.itemStack;
 if(!p||!item||!GENERATOR_ITEM_TYPE_IDS.has(item.typeId))return;
 const id=tokenId(item),slot=p.selectedSlotIndex;
 const dedupe=p.id+':'+slot+':'+id;
 if(customTokenUsePending.has(dedupe))return;
 customTokenUsePending.add(dedupe);
 system.run(()=>{
  try{placeGeneratorToken(p,slot,id)}
  finally{customTokenUsePending.delete(dedupe)}
 });
}
try {
 if(!system.beforeEvents?.startup?.subscribe)throw Error('Script API startup registry unavailable');
 system.beforeEvents.startup.subscribe(ev=>{
  try{
   ev.itemComponentRegistry.registerCustomComponent('skygen:generator_token_use',{
    onUse:queueCustomGeneratorUse,
    onUseOn:queueCustomGeneratorUse
   });
   generatorTokenCustomReady=true;
  }catch(err){generatorTokenCustomReady=false;console.warn('[SkyGen] CRITICAL custom generator item registration failed '+err)}
 });
}catch(err){console.warn('[SkyGen] CRITICAL custom item startup unavailable '+err)}
// Keep the v0.9.2 horn event subscribed so outstanding valid horns still redeem.
let generatorTokenUseGuardReady=false;
try{
 if(!world.beforeEvents.itemUse?.subscribe)throw Error('beforeEvents.itemUse is unavailable');
 world.beforeEvents.itemUse.subscribe(e=>{
  const i=e.itemStack;
  // Block legacy name-only eggs but never accept them as authenticated tokens.
  if(i?.typeId==='minecraft:egg'&&i.nameTag?.startsWith('§bSkyGen ')){
   e.cancel=true;
   system.run(()=>e.source?.sendMessage?.('§cOld generator egg cannot be verified. Ask an operator to inspect and replace it.'));
   return;
  }
  // Controller compatibility fallback: if Bedrock emits a normal use event
  // for a custom item, cancel vanilla behavior and use the same deduplicated path.
  if(i&&GENERATOR_ITEM_TYPE_IDS.has(i.typeId)){
   e.cancel=true;
   queueCustomGeneratorUse({source:e.source,itemStack:i});
   return;
  }
  if(i?.typeId!==GENERATOR_TOKEN_ITEM||(!i.nameTag?.startsWith('§bSkyGen ')&&!tokenId(i)))return;
  e.cancel=true; // Stop vanilla horn use; the token is consumed only after validation.
  const player=e.source,selected=player?.selectedSlotIndex,id=tokenId(i);
  system.run(()=>placeGeneratorToken(player,selected,id));
 });
 generatorTokenUseGuardReady=true;
}catch(err){console.warn('[SkyGen] CRITICAL generator token use guard unavailable; redemption disabled '+err)}
try{
 if(!world.beforeEvents.explosion?.subscribe)throw Error('explosion guard unavailable');
 world.beforeEvents.explosion.subscribe(e=>{
  try{
   if(e.dimension?.id!=='minecraft:overworld')return;
   const blocks=e.getImpactedBlocks();
   if(blocks.some(b=>{const loc=b.location;return inSpawn(loc.x,loc.z)||plotAt(loc.x,loc.z)>=0}))e.cancel=true;
  }catch(err){e.cancel=true;console.warn('[SkyGen] explosion filter failed closed '+err)}
 });
}catch(err){console.warn('[SkyGen] CRITICAL: explosion guard not installed '+err)}
world.beforeEvents.playerBreakBlock.subscribe(e=>{
 const {x,y,z}=e.block.location;
 if(e.player.dimension?.id!=='minecraft:overworld')return;
 const registered=generators.get(`${x},${y},${z}`);
 if(registered&&isGeneratorBase(registered,e.block)){
  e.cancel=true;
  return;
 }
 const id=plotAt(x,z);
 // Starter island floor is permanent. The owner may build ABOVE it but cannot mine its layers.
 if(id>=0){const c=coords(id);if(Math.abs(x-c.x)<=8&&Math.abs(z-c.z)<=8&&y>=c.y-3&&y<=c.y-1){e.cancel=true;return;}}
 if(protectedAt(e.player,x,z))e.cancel=true;
});
try{
 // Available only in some (beta/newer) runtimes; do not rely on it in stable 2.0.0.
 world.beforeEvents.playerPlaceBlock?.subscribe(e=>{
  if(e.player&&e.block&&protectedAt(e.player,e.block.location.x,e.block.location.z))e.cancel=true;
 });
}catch(err){console.warn('[SkyGen] Optional pre-place guard not supported: '+err)}
try{
 // Stable 2.0 pre-interaction protects chests and most block placements.
 if(world.beforeEvents.playerInteractWithBlock?.subscribe){
  world.beforeEvents.playerInteractWithBlock.subscribe(e=>{
   if(!e.player||!e.block)return;
   const {x,z}=e.block.location;
   if(protectedAt(e.player,x,z)||[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>protectedAt(e.player,x+dx,z+dz)))e.cancel=true;
  });
  interactionGuardAvailable=true;
 }else console.warn('[SkyGen] CRITICAL: block interaction protection unavailable; plot visiting disabled.');
}catch(e){interactionGuardAvailable=false;console.warn('[SkyGen] CRITICAL: interaction guard failed: '+e)}
try{
 // Defense in depth for placement actions not routed through interaction.
 // Only removes the newly placed unauthorized block; use a world copy to test boundary cases.
 world.afterEvents.playerPlaceBlock?.subscribe(e=>{
  if(e.block){const loc=e.block.location;generatorOutputReady.delete(`${loc.x},${loc.y-1},${loc.z}`)}
  if(e.player&&e.block&&protectedAt(e.player,e.block.location.x,e.block.location.z)){
   try{e.block.setType('minecraft:air');e.player.sendMessage('§cCannot build in this protected area.')}catch(err){console.warn('[SkyGen] unauthorized placed block could not be reverted: '+err)}
  }
 });
}catch(e){console.warn('[SkyGen] post-placement repair unavailable: '+e)}
const normalXpGate=new Map(),normalXpWindow=new Map();
world.afterEvents.playerBreakBlock.subscribe(e=>{
 try{
  const p=e.player,loc=e.block.location;
  if(!belongs(p,loc.x,loc.z))return;
  const d=profile(p);recordDaily(d,'blocks');
  const key=`${loc.x},${loc.y-1},${loc.z}`,g=generators.get(key);
  const type=e.brokenBlockPermutation?.type?.id||e.brokenBlockPermutation?.typeId||'';
  const validHarvest=!!g&&g.owner===p.id&&(loc.y===g.y+1)&&(type===(GENS.find(x=>x.name===g.type)?.block||g.block));
  if(validHarvest&&generatorOutputReady.delete(key)){
   const bonus=perkValue(d,'miningXp');d.xp+=Math.ceil(5*(100+bonus)/100);
   recordDaily(d,'harvests');
   const lucky=perkValue(d,'luck');
   if(lucky>0&&Math.random()*100<lucky){
    const prize=new ItemStack(g.block,1);
    if(inventoryCapacity(p,prize)){try{inventory(p)?.addItem(prize);p.sendMessage('§aLucky Strikes! +1 bonus block.')}catch{}}
   }
  }else{
   const last=normalXpGate.get(p.id)??-99999;
   const window=normalXpWindow.get(p.id);
   const current=(!window||system.currentTick-window.start>=1200)?{start:system.currentTick,count:0}:window;
   if(system.currentTick-last>=5&&current.count<10){d.xp+=1;current.count++;normalXpGate.set(p.id,system.currentTick)}
   normalXpWindow.set(p.id,current);
  }
  rank(p,d);
 }catch(err){console.warn('[SkyGen XP] could not record block break: '+err)}
});
// Self-rescheduling generator watchdog. A generator's empty state is tracked in
// memory and is reset when an output block is present. No stale saved ticks.
let genRotation=0;
function genWatchdog(){
 genWatchdogRuns++;genLastTick=system.currentTick;
 try{
  const dim=world.getDimension('overworld'),records=[...generators.entries()];
  if(!records.length)return;
  // Never perform 1200 block reads every second. Process at most 100 generators
  // per heartbeat with absolute tick-based regeneration timing.
  const count=Math.min(100,records.length);
  for(let n=0;n<count;n++){
   const [key,g]=records[(genRotation+n)%records.length];
   try{
    const base=dim.getBlock({x:g.x,y:g.y,z:g.z}),output=dim.getBlock({x:g.x,y:g.y+1,z:g.z});
    if(!base||!output||!migrateGeneratorCore(g,base)){genEmptySeconds.delete(key);continue}
    const spec=GENS.find(x=>x.name===g.type),expected=spec?.block||g.block;
    if(!expected){genEmptySeconds.delete(key);continue}
    if(output.typeId!=='minecraft:air'){genEmptySeconds.delete(key);continue}
    const detected=genEmptySeconds.get(key);
    if(!Number.isFinite(detected)){genEmptySeconds.set(key,system.currentTick);continue}
    if(system.currentTick-detected>=effectivePeriod(g)){
     output.setType(expected);generatorOutputReady.add(key);genEmptySeconds.delete(key);
    }
   }catch(err){genError(key+' '+err,key)}
  }
  genRotation=(genRotation+count)%records.length;
 }catch(err){genError('watchdog '+err)}
}

try{
 world.afterEvents.playerLeave?.subscribe(e=>{
  const id=e.playerId||e.player?.id;
  const t=pending.get(id);pending.delete(id);finishPendingTeleport(t);
  const s=spawnStages.get(id);s?.release?.();
  for(const [plot,session] of plotBuilds){if(session.playerId===id){try{session.cancel?.()}catch(err){console.warn('[SkyGen] plot cleanup on leave '+err)}}}
  const trade=trades.get(id);if(trade)tradeClose(trade,'Trade cancelled: player disconnected.');
  normalXpGate.delete(id);normalXpWindow.delete(id);skillLastEffects.delete(id);skillActiveEffects.delete(id);for(const key of skillCooldowns.keys())if(key.startsWith(id+':'))skillCooldowns.delete(key);
 });
}catch(e){console.warn('[SkyGen] leave cleanup unavailable '+e)}
system.runInterval(()=>{for(const p of world.getAllPlayers())ensure(p)},200);
function adminCommand(actor,message){
 if(!isOperator(actor))return actor.sendMessage('§cOnly Realm operators may grant or revoke SkyGen admin access.');
 const match=/^\s*(grant|revoke)\s+(.+?)\s*$/i.exec(String(message||''));
 if(!match)return actor.sendMessage('§eUsage: /scriptevent skygen:admin grant PlayerName  OR  /scriptevent skygen:admin revoke PlayerName');
 const action=match[1].toLowerCase(),name=match[2];
 const matches=world.getAllPlayers().filter(p=>p.name.toLowerCase()===name.toLowerCase());
 if(matches.length!==1)return actor.sendMessage('§cPlayer must be online. Check the exact name: '+name);
 const target=matches[0];if(target.id===actor.id)return actor.sendMessage('§cCannot change your own access.');
 const grant=action==='grant';
 try{world.setDynamicProperty('sg_admin_'+target.id,grant)}catch(err){return actor.sendMessage('§cUnable to save admin permission: '+err)}
 adminAudit(actor,grant?'GRANT ADMIN':'REVOKE ADMIN',target,'via command');
 actor.sendMessage('§aSkyGen admin '+(grant?'granted to ':'revoked from ')+target.name+'.');
 target.sendMessage(grant?'§aYou now have SkyGen Admin access.':'§cYour SkyGen Admin access was revoked.');
 if(grant)system.runTimeout(()=>issueAdminAxe(target),30);
}

system.runTimeout(()=>{try{ensureSpawn()}catch(e){console.warn('SkyGen spawn init: '+e)}},40);
console.warn('[SkyGen] v0.9.4 custom generator core blocks loaded');
