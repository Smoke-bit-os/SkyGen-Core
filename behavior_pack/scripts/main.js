import {world,system,ItemStack,ItemLockMode} from '@minecraft/server';
import {ActionFormData,ModalFormData,MessageFormData} from '@minecraft/server-ui';
const C={spawn:{x:0.5,y:2,z:0.5},base:{x:512,y:106,z:512},spacing:128,columns:8,radius:24,warmup:100,cooldown:100,exchange:18000000};
const TOOLS=[{slot:6,type:'minecraft:compass',name:'§bSkyGen Menu'},{slot:7,type:'minecraft:goat_horn',name:'§6Go to Spawn'},{slot:8,type:'minecraft:goat_horn',name:'§aGo to Plot'}];
const GENS=[{name:'Cobblestone',block:'minecraft:cobblestone',cost:500,period:200},{name:'Coal',block:'minecraft:coal_ore',cost:2500,period:300},{name:'Iron',block:'minecraft:iron_ore',cost:10000,period:400},{name:'Gold',block:'minecraft:gold_ore',cost:40000,period:500},{name:'Diamond',block:'minecraft:diamond_ore',cost:200000,period:600},{name:'Emerald',block:'minecraft:emerald_ore',cost:500000,period:800}];
const SHOP=[{name:'Cobblestone × 16',id:'minecraft:cobblestone',count:16,buy:80,sell:16},{name:'Oak Logs × 16',id:'minecraft:oak_log',count:16,buy:160,sell:32},{name:'Iron Ingots × 8',id:'minecraft:iron_ingot',count:8,buy:400,sell:80},{name:'Diamond × 1',id:'minecraft:diamond',count:1,buy:500,sell:100}];
const pending=new Map(),cooldowns=new Map(),generators=new Map(),trades=new Map(),visitRequests=new Map();
const genEmptySeconds=new Map();
let genWatchdogRuns=0, genLastTick=-1, genLastError="none", genStartupTick=system.currentTick;
const genErrors=[];
// Register commands early so a later optional event subscription cannot disable them.
try{
 system.afterEvents.scriptEventReceive.subscribe(e=>{
  if(!['skygen:menu','skygen:adminaxe','skygen:admin','skygen:debug','skygen:marketreview'].includes(e.id))return;
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
    else actor.sendMessage('§aSkyGen command handler active. OP='+isOperator(actor)+' Admin='+isAdmin(actor)+' PermissionLevel='+String(actor.playerPermissionLevel)+' isOpAPI='+String(typeof actor.isOp));
   }catch(err){console.warn('[SkyGen CMD] '+err);try{actor.sendMessage('§cSkyGen command error: '+err)}catch{}}
  });
 });
 console.warn('[SkyGen CMD] command listener registered');
}catch(err){console.warn('[SkyGen CMD] LISTENER REGISTRATION FAILED '+err)}

const GEN_REGISTRY_LIMIT=500, GEN_REGISTRY_BYTES=30000;
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
 if(!base.isAir&&base.typeId!=='minecraft:bedrock')return false;
 if(!output.isAir)return false;
 try{
  base.setType('minecraft:bedrock');
  output.setType(g.block);
  return true;
 }catch(err){
  // Do not strand an unregistered bedrock base when output creation fails.
  try{if(output.typeId===g.block)output.setType('minecraft:air')}catch{}
  try{if(base.typeId==='minecraft:bedrock')base.setType('minecraft:air')}catch{}
  throw err;
 }
}
function genSave(){
 try{
  if(!generatorRegistryLoaded)throw Error('Generator registry has not loaded safely');
  if(generators.size>GEN_REGISTRY_LIMIT)throw Error('Generator registry limit reached');
  const data=JSON.stringify([...generators]);
  if(data.length>GEN_REGISTRY_BYTES)throw Error('Generator registry storage capacity reached');
  world.setDynamicProperty('sg_generators',data);
  if(world.getDynamicProperty('sg_generators')!==data)throw Error('Generator registry verification failed');
  return true;
 }catch(e){genError('save '+e,'save');return false}
}
let generatorRegistryLoaded=false;
function genLoad(){
 try{
  const raw=world.getDynamicProperty('sg_generators');
  const arr=raw===undefined||raw===null?[]:JSON.parse(String(raw));
  if(!Array.isArray(arr))throw Error('Invalid generator registry');
  for(const entry of arr){
   if(!Array.isArray(entry)||entry.length!==2)throw Error('Invalid generator entry');
   const [k,v]=entry;
   if(typeof k!=='string'||!v||!GENS.some(g=>g.name===v.type))throw Error('Invalid generator '+k);
   generators.set(k,v);
  }
  generatorRegistryLoaded=true;
 }catch(e){
  generatorRegistryLoaded=false;
  genError('CRITICAL registry load failed; persistence disabled: '+e,'load');
 }
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
     cooldowns.set(id,system.currentTick+C.cooldown);
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
 system.runTimeout(check,10);
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
 const id=Number(world.getDynamicProperty('sg_next_plot')??0);
 if(!Number.isSafeInteger(id)||id<0||id>64000)throw Error('Plot registry index invalid or limit reached');
 if(ownerId(id))throw Error('Plot registry conflict at #'+(id+1)+'; no duplicate assigned');
 // Reserve index first, so a crash cannot assign the same plot to another player.
 world.setDynamicProperty('sg_next_plot',id+1);
 if(world.getDynamicProperty('sg_next_plot')!==id+1)throw Error('Unable to reserve plot index');
 world.setDynamicProperty(keyForPlot(id),p.id);
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
   cooldowns.set(id,system.currentTick+C.cooldown);
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
 const d=profile(p);if(d.plot<0)return p.sendMessage('§cYou have no plot. Rejoin to retry assignment.');
 stageAndBuildPlot(p,d.plot,true);
}
function rank(p,d){
 const old=d.rank||1;d.rank=Math.min(50,1+Math.floor(d.xp/1000));
 if(d.rank>old){for(let n=old+1;n<=d.rank;n++){d.credits+=n*100;if(n%10===0)d.orbits+=1}p.sendMessage(`§dRank up! ${old} → ${d.rank}. Credits rewarded${Math.floor(d.rank/10)>Math.floor(old/10)?' + milestone Orbits':''}.`)}
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
function menu(p){const d=profile(p);form(p,'§l§bSKYGEN CORE',`§eCredits: ${d.credits}  §bOrbits: ${d.orbits}\n§dRank: ${d.rank}/50  XP: ${d.xp}\n§aPlot: ${d.plot+1}`,['My Plot','Visit Other Plots','Generators','Server Shop','Player Marketplace','Player Trading','Ranks','Wallet / Exchange','Teleport','Help'],i=>[()=>plotMenu(p),()=>visitMenu(p),()=>genMenu(p),()=>shop(p),()=>market(p),()=>trade(p),()=>ranks(p),()=>wallet(p),()=>teleports(p),()=>form(p,'Help','SkyGen v0.8.2. Marketplace, direct trades, 50 ranks and generator upgrades. Test on a world copy first.',['Back'],()=>back(p))][i]())}
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

function genMenu(p){form(p,'§bGENERATORS','Buy tokens, place on your own plot, and upgrade production speed. Look at a floor block on your plot and use the egg. The bedrock base appears directly above the block you target, with ore on top. Mine the ore to collect it.',['Buy Generator','My Generators / Upgrade','Back'],i=>{if(i===0)buyGen(p);if(i===1)myGenerators(p);if(i===2)back(p)})}
function myGenerators(p){
 const a=[...generators.entries()].filter(([key,g])=>g.owner===p.id);
 form(p,'§bMY GENERATORS',a.map(([key,g])=>`${g.type} Lv${g.level||1} @ ${g.x},${g.y},${g.z}`).join('\n')||'No generators.',[...a.map(([key,g])=>`${g.type} Lv${g.level||1} — Manage`),'Back'],i=>{
  if(i>=a.length)return genMenu(p);
  const [key,g]=a[i];manageGenerator(p,key,g);
 });
}
function manageGenerator(p,key,g){
 if(g.owner!==p.id||generators.get(key)!==g)return myGenerators(p);
 const lv=g.level||1;
 const spec=GENS.find(x=>x.name===g.type);
 const cost=spec?spec.cost*lv*2:0;
 form(p,'§bMANAGE GENERATOR',`${g.type} • Level ${lv}/5\nLocation: ${g.x}, ${g.y}, ${g.z}\nUpgrade cost: ${lv>=5?'MAX LEVEL':cost+' Credits'}\nDeletion permanently removes the generator; no refund.`,['Upgrade','Delete Generator','Diagnose Generator','Admin: Force Output Test','Back'],i=>{
  if(i===2){
   const dim=world.getDimension('overworld');
   let base='unloaded',output='unloaded';
   try{base=dim.getBlock({x:g.x,y:g.y,z:g.z})?.typeId||'unloaded';output=dim.getBlock({x:g.x,y:g.y+1,z:g.z})?.typeId||'unloaded'}catch(e){genError('inspect '+e)}
   const interval=Math.max(1,Math.ceil((Number(g.period)||spec?.period||200)/20));
   const age=genLastTick<0?'never':String(system.currentTick-genLastTick)+' ticks ago';
   const lines=[`§bSkyGen Generator Deep Diagnostics v0.8.2`,`Generator: ${g.type} level ${lv} at ${g.x},${g.y},${g.z}`,`Registered: ${generators.get(key)===g} | Registry size: ${generators.size}`,`Base: ${base} | Output: ${output} | Expected: ${spec?.block||g.block}`,`Interval: ${interval}s | Empty: ${genEmptySeconds.get(key)||0}s`,`Watchdog runs: ${genWatchdogRuns} | Last heartbeat: ${age}`,`Script uptime: ${system.currentTick-genStartupTick} ticks | Current tick: ${system.currentTick}`,`Last error: ${genLastError}`,`Recent errors: ${genErrors.slice(-3).join(' ; ')||'none'}`];
   for(const line of lines)p.sendMessage(line);
   return;
  }
  if(i===3){
   if(!isOperator(p))return p.sendMessage('§cOperator only.');
   try{
    const dim=world.getDimension('overworld');const base=dim.getBlock({x:g.x,y:g.y,z:g.z}),out=dim.getBlock({x:g.x,y:g.y+1,z:g.z});
    if(!base||!out||base.typeId!=='minecraft:bedrock'||out.typeId!=='minecraft:air')return p.sendMessage('§cForce test requires bedrock base and empty output.');
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
     if(base.typeId!=='minecraft:bedrock')return p.sendMessage('§cGenerator base missing. Deletion cancelled to protect nearby blocks.');
     // Remove the registry first and verify. If block removal fails, restore registry.
     generators.delete(key);
     if(!genSave()){generators.set(key,g);return p.sendMessage('§cCannot save registry; nothing deleted.')}
     try{
      if(output.typeId===g.block)output.setType('minecraft:air');
      base.setType('minecraft:air');
     }catch(err){generators.set(key,g);if(!genSave())genError('CRITICAL: generator rollback save failed '+key,'rollback');throw err}
     p.sendMessage(`§a${g.type} generator deleted. No refund issued.`);
    }catch(e){p.sendMessage('§cCould not delete generator. Stand near it and retry.');console.warn('SkyGen delete generator '+e)}
   }).catch(e=>console.warn('SkyGen delete UI '+e));
  }else myGenerators(p);
 });
}
function buyGen(p){
 form(p,'BUY GENERATOR',GENS.map((g,i)=>`${i+1}. ${g.name}: ${g.cost} Credits`).join('\n'),[...GENS.map(g=>g.name),'Back'],i=>{
  if(i>=GENS.length)return genMenu(p);
  if(!generatorRegistryLoaded)return p.sendMessage('§cGenerators still loading or registry corrupt. Purchases disabled.');
  const d=profile(p),g=GENS[i];if(d.credits<g.cost)return p.sendMessage('§cNot enough Credits.');
  const inv=inventory(p);if(!inv)return;
  const egg=new ItemStack('minecraft:egg',1);egg.nameTag=`§bSkyGen ${g.name} Generator`;
  egg.setLore([`Generator type: ${g.name}`,'Use on your plot to place']);
  if(!inventoryCapacity(p,egg))return p.sendMessage('§cInventory full. No charge.');
  try{d.credits-=g.cost;save(p,d)}catch(err){return p.sendMessage('§cWallet storage unavailable. No token delivered.')} 
  try{if(inv.addItem(egg))throw Error('Inventory changed');p.sendMessage(`§aPurchased ${g.name} generator token.`)}
  catch(err){
   try{const fresh=profile(p);fresh.credits+=g.cost;save(p,fresh);p.sendMessage('§cToken delivery failed. Credits refunded.')} 
   catch(fatal){genError('CRITICAL: generator token refund failed '+p.name+' '+fatal,'transaction');p.sendMessage('§cToken delivery error: contact admin for wallet recovery.')}
  }
 });
}
function eligibleShopItem(it,id){return !!it&&it.typeId===id&&!it.nameTag&&it.lockMode===ItemLockMode.none&&!isTool(it)&&(!it.getLore||it.getLore().length===0)}
function inventoryCapacity(p,stack){const inv=inventory(p);if(!inv)return false;let free=0;for(let i=0;i<inv.size;i++){const it=inv.getItem(i);if(!it){free+=stack.maxAmount;continue}if(it.typeId===stack.typeId&&!it.nameTag&&it.lockMode===ItemLockMode.none&&(!it.getLore||it.getLore().length===0))free+=Math.max(0,it.maxAmount-it.amount)}return free>=stack.amount}
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
  const select=new ActionFormData().title(buying?'BUY ITEMS':'SELL ITEMS').body('Choose an item.');
  for(const item of SHOP)select.button(item.id+' ('+(buying?item.buy:item.sell)+' / '+item.count+')');
  select.button('Back');
  showShop(select,'item selection',chosen=>{
   if(chosen.selection>=SHOP.length)return shop(p);
   const item=SHOP[chosen.selection];
   const amountForm=new ModalFormData().title(buying?'Buy Quantity':'Sell Quantity').textField('How many items? (1–2304)','16',{defaultValue:'16'});
   showShop(amountForm,'quantity',r=>{
    const raw=String(r.formValues?.[0]??'').trim();
    const count=/^[1-9][0-9]*$/.test(raw)?Number(raw):NaN;
    if(!Number.isSafeInteger(count)||count>2304)return p.sendMessage('§cEnter a whole number from 1 to 2304.');
    const totalNumerator=count*(buying?item.buy:item.sell);
    if(!Number.isSafeInteger(totalNumerator)||totalNumerator%item.count!==0)return p.sendMessage('§cThis item requires a quantity in multiples of '+item.count+' for exact Credit pricing.');
    const total=totalNumerator/item.count;
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
        const actualCost=Math.ceil(delivered*item.buy/item.count),refund=total-actualCost;
        try{const latest=profile(p);latest.credits+=refund;save(p,latest)}catch(err){console.warn('[SkyGen SHOP] CRITICAL partial refund failed '+p.name+' '+err);return p.sendMessage('§cPartial shop delivery; contact admin for refund. Items delivered: '+delivered)}
        return p.sendMessage('§eOnly '+delivered+' items delivered. Charged '+actualCost+' Credits; '+refund+' refunded.');
       }
      }catch(e){console.warn('[SkyGen SHOP] delivery uncertain '+p.name+' '+e);return p.sendMessage('§cShop delivery error. Contact operator to reconcile '+total+' Credits and '+delivered+' confirmed items.')}
     }else if(!safeShopSell(p,{...item,count,sell:total}))return;
     p.sendMessage('§a'+(buying?'Purchased ':'Sold ')+count+' '+item.id+' for '+total+' Credits.');
    });
   });
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
function ranks(p){const d=profile(p);form(p,'§d50 RANKS',`Current: ${d.rank}/50 — ${RANK_NAMES[d.rank-1]}\nXP: ${d.xp} / 49000\nNext rank: ${d.rank>=50?'MAX':1000-(d.xp%1000)+' XP'}\nEvery rank gives Rank × 100 Credits. Every 10 ranks also gives 1 Orbit.`,['Browse ranks 1–25','Browse ranks 26–50','Back'],i=>{if(i===2)return back(p);const lo=i===0?0:25;form(p,'§dRANK PROGRESSION',RANK_NAMES.slice(lo,lo+25).map((name,j)=>`${lo+j+1}. ${name} — ${1000*(lo+j)} XP`).join('\n'),['Back'],()=>ranks(p))})}
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
const MARKET_LOCK=new Set();
function marketLock(id,fn){
 if(MARKET_LOCK.has(id))return false;
 MARKET_LOCK.add(id);
 try{return fn()}catch(e){console.warn('[SkyGen MARKET] operation failed '+e);return false}
 finally{MARKET_LOCK.delete(id)}
}
function validListing(l){return l&&typeof l.id==='string'&&typeof l.seller==='string'&&typeof l.type==='string'&&Number.isSafeInteger(l.count)&&l.count>=1&&l.count<=64&&Number.isSafeInteger(l.price)&&l.price>0}
function marketPlain(it){
 return !!it&&MARKET_COMMODITIES.has(it.typeId)&&it.amount>=1&&it.amount<=64&&
  !it.nameTag&&it.lockMode===ItemLockMode.none&&(!it.getLore||it.getLore().length===0);
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
    let all=marketRead();if(all.length>=MAX_LISTINGS)return p.sendMessage('§cMarket at capacity; ask operator to review stuck listings.');
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
    const key='sg_proceeds_'+l.seller;
    try{
     const proceeds=Number(world.getDynamicProperty(key)||0);
     if(!Number.isSafeInteger(proceeds+l.price)||proceeds+l.price>2000000000)throw Error('Seller credit limit');
     world.setDynamicProperty(key,proceeds+l.price);
     if(Number(world.getDynamicProperty(key))!==proceeds+l.price)throw Error('Seller proceeds verification');
     // Delete the sold listing only after seller's proceeds were persistently stored.
     marketSave(marketRead().filter(x=>x.id!==l.id));
     p.sendMessage('§aPurchase complete!');
     const seller=world.getAllPlayers().find(q=>q.id===l.seller);
     seller?.sendMessage('§aMarket sale: '+l.price+' Credits pending collection.');
    }catch(e){
     console.warn('[SkyGen MARKET] SALE REVIEW: '+l.id+' '+e);
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
     ai.nameTag||bi.nameTag||ai.lockMode!==ItemLockMode.none||bi.lockMode!==ItemLockMode.none||
     (ai.getLore&&ai.getLore().length)||(bi.getLore&&bi.getLore().length))return tradeClose(t,'Items changed; trade canceled.');
  const aStack=ai.clone(),bStack=bi.clone();
  // Slot-to-slot swap, NOT remove+addItem. Always enough room because both
  // offered slots already exist, and clone() retains complete ItemStack data.
  try{
   aInv.setItem(t.aSlot,bStack);
   bInv.setItem(t.bSlot,aStack);
   return tradeClose(t,'Trade completed successfully!');
  }catch(err){
   let restored=true;
   try{aInv.setItem(t.aSlot,aStack)}catch(e){restored=false;console.warn('[SkyGen TRADE] CRITICAL restore A '+t.id+' '+e)}
   try{bInv.setItem(t.bSlot,bStack)}catch(e){restored=false;console.warn('[SkyGen TRADE] CRITICAL restore B '+t.id+' '+e)}
   if(!restored){
    p.sendMessage('§cTrade restoration error. Contact an operator with trade ID '+t.id);
    q.sendMessage('§cTrade restoration error. Contact an operator with trade ID '+t.id);
   }
   return tradeClose(t,restored?'Trade canceled; original items restored.':'Trade failed; operator review needed.');
  }
 }catch(e){return tradeClose(t,'Trade canceled safely: '+e)}
}
function removeItemType(p,type,count){const inv=inventory(p);for(let i=0;i<inv.size&&count>0;i++){const it=inv.getItem(i);if(it?.typeId!==type||it.nameTag)continue;const n=Math.min(count,it.amount);removeExact(p,i,type,n);count-=n}}
world.afterEvents.playerSpawn.subscribe(e=>system.runTimeout(()=>{try{
 const p=e.player;
 // Rescue scheduling MUST happen even if a damaged plot/profile prevents claiming.
 if(e.initialSpawn||p.location.y < -50)safeSpawnTravel(p,true);
 const d=claim(p);const due=Number(world.getDynamicProperty('sg_proceeds_'+p.id)||0);
 if(due>0){
  try{
   if(!Number.isSafeInteger(due)||!Number.isSafeInteger(d.credits+due)||d.credits+due>2000000000)throw Error('Wallet cap / invalid proceeds');
   d.credits+=due;save(p,d);
   world.setDynamicProperty('sg_proceeds_'+p.id,0);
   p.sendMessage(`§aMarketplace sales collected: ${due} Credits.`);
  }catch(err){console.warn('[SkyGen MARKET] Seller proceeds collection requires review '+p.id+' '+err);p.sendMessage('§cMarketplace sale credit settlement needs operator review.')}
 }
 rank(p,d);ensure(p);
 // Fresh flat-void worlds start near Y=-63. Put players on the protected platform.
 // Initial join rescue is immediate; subsequent horn/menu teleports use warm-up.
 // Spawn rescue was already requested before assignment; never blindly teleport.
 p.sendMessage('§bSkyGen: menu compass slot 7, spawn horn slot 8, plot horn slot 9.');
 }catch(err){console.warn('SkyGen join '+err)}},30));
world.afterEvents.itemUse.subscribe(e=>{const p=e.source,i=e.itemStack;if(adminAxe(i)){system.run(()=>adminMenu(p));return;}if(toolmatch(i,TOOLS[0]))system.run(()=>menu(p));if(toolmatch(i,TOOLS[1]))system.run(()=>{if(p.location.y<-50){const t=pending.get(p.id);pending.delete(p.id);finishPendingTeleport(t);safeSpawnTravel(p,true)}else safeSpawnTravel(p)});if(toolmatch(i,TOOLS[2]))system.run(()=>tpPlot(p));if(i?.typeId==='minecraft:egg'&&i.nameTag?.startsWith('§bSkyGen ')&&i.nameTag.endsWith(' Generator')){const name=i.nameTag.replace('§bSkyGen ','').replace(' Generator',''),g=GENS.find(g=>g.name===name);if(!g)return;const pos=p.location;if(!belongs(p,pos.x,pos.z)||ownerId(profile(p).plot)!==p.id)return p.sendMessage('§cUse generator eggs only on your own plot.');// Target the block the player is looking at, never a fixed world-direction offset.
 const hit=p.getBlockFromViewDirection({maxDistance:6,includeLiquidBlocks:false,includePassableBlocks:false});
 if(!hit?.block)return p.sendMessage('§cLook directly at a block on your plot to place the generator.');
 const target=hit.block.location;
 const loc={x:target.x,y:target.y+1,z:target.z};
 if(plotAt(loc.x,loc.z)!==profile(p).plot)return p.sendMessage('§cTarget a block inside your own plot.');
 // Bedrock is placed above the clicked floor; the permanent platform is untouched.
 if(loc.y<1||loc.y>300)return p.sendMessage('§cInvalid generator height.');
  const key=`${loc.x},${loc.y},${loc.z}`;
  if(generators.has(key))return p.sendMessage('§cGenerator already here.');
  if(!generatorRegistryLoaded)return p.sendMessage('§cGenerator registry not loaded. Placement disabled to protect existing data.');
  if(generators.size>=GEN_REGISTRY_LIMIT)return p.sendMessage('§cGenerator registry is full; no egg consumed.');
  const record={...loc,owner:p.id,type:g.name,period:g.period,block:g.block,last:system.currentTick,elapsed:0};
  try{if(!buildGenerator(record))return p.sendMessage('§cGenerator needs two empty blocks above the targeted block. Aim at an open floor area.')}
  catch(err){return p.sendMessage('§cGenerator could not be built: '+err)}
  generators.set(key,record);
  if(!genSave()){
   generators.delete(key);
   try{
    const dim=world.getDimension('overworld'),base=dim.getBlock(loc),out=dim.getBlock({x:loc.x,y:loc.y+1,z:loc.z});
    if(out?.typeId===g.block)out.setType('minecraft:air');
    if(base?.typeId==='minecraft:bedrock')base.setType('minecraft:air');
   }catch(err){genError('CRITICAL: failed to rollback unsaved generator '+key+' '+err,'rollback')}
   return p.sendMessage('§cGenerator storage is full/unavailable. Placement rolled back; egg retained.');
  }
  const inv=p.getComponent('minecraft:inventory')?.container;const selected=p.selectedSlotIndex,stack=inv?.getItem(selected);if(stack&&stack.nameTag===i.nameTag){if(stack.amount===1)inv.setItem(selected,undefined);else{stack.amount--;inv.setItem(selected,stack)}}p.sendMessage(`§aPlaced ${g.name} generator at ${loc.x},${loc.y},${loc.z}. The bedrock base is visible; the first ore appears immediately ON TOP, and regenerates after mining. Mine the ore to produce more.`)}});
world.beforeEvents.playerBreakBlock.subscribe(e=>{
 const {x,y,z}=e.block.location;
 if(e.player.dimension?.id!=='minecraft:overworld')return;
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
  if(e.player&&e.block&&protectedAt(e.player,e.block.location.x,e.block.location.z)){
   try{e.block.setType('minecraft:air');e.player.sendMessage('§cCannot build in this protected area.')}catch(err){console.warn('[SkyGen] unauthorized placed block could not be reverted: '+err)}
  }
 });
}catch(e){console.warn('[SkyGen] post-placement repair unavailable: '+e)}
world.afterEvents.playerBreakBlock.subscribe(e=>{if(!belongs(e.player,e.block.location.x,e.block.location.z))return;const d=profile(e.player);d.xp+=1;rank(e.player,d)});
// Self-rescheduling generator watchdog. A generator's empty state is tracked in
// memory and is reset when an output block is present. No stale saved ticks.
function genWatchdog(){
 genWatchdogRuns++;genLastTick=system.currentTick;
 try{
  const dim=world.getDimension('overworld');
  for(const [key,g] of generators){
   try{
    const base=dim.getBlock({x:g.x,y:g.y,z:g.z});
    const output=dim.getBlock({x:g.x,y:g.y+1,z:g.z});
    if(!base||!output||base.typeId!=='minecraft:bedrock'){genEmptySeconds.delete(key);continue;}
    const spec=GENS.find(x=>x.name===g.type);
    const expected=spec?.block||g.block;
    if(!expected){genEmptySeconds.delete(key);continue;}
    if(output.typeId!=='minecraft:air'){genEmptySeconds.delete(key);continue;}
    const elapsed=(genEmptySeconds.get(key)||0)+1;
    const wait=Math.max(1,Math.ceil((Number(g.period)||spec?.period||200)/20));
    if(elapsed>=wait){output.setType(expected);genEmptySeconds.delete(key);}
    else genEmptySeconds.set(key,elapsed);
   }catch(err){genError(key+' '+err,key)}
  }
 }catch(err){genError('watchdog '+err)}

}

try{
 world.afterEvents.playerLeave?.subscribe(e=>{
  const id=e.playerId||e.player?.id;
  const t=pending.get(id);pending.delete(id);finishPendingTeleport(t);
  const s=spawnStages.get(id);s?.release?.();
  for(const [plot,session] of plotBuilds){if(session.playerId===id){try{session.cancel?.()}catch(err){console.warn('[SkyGen] plot cleanup on leave '+err)}}}
  const trade=trades.get(id);if(trade)tradeClose(trade,'Trade cancelled: player disconnected.');
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
console.warn('[SkyGen] 0.8.2 stability and security repairs loaded');