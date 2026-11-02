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
  if(!['skygen:menu','skygen:adminaxe','skygen:admin','skygen:debug'].includes(e.id))return;
  const actor=e.sourceEntity;
  console.warn('[SkyGen CMD] received '+e.id+' source='+e.sourceType+' player='+(actor?.name||'none'));
  if(!actor||actor.typeId!=='minecraft:player'){console.warn('[SkyGen CMD] no player source; use command from player chat');return;}
  try{actor.sendMessage('§7SkyGen received '+e.id+(e.message?' '+e.message:''));}catch{}
  system.run(()=>{
   try{
    if(e.id==='skygen:menu')menu(actor);
    else if(e.id==='skygen:adminaxe')issueAdminAxe(actor);
    else if(e.id==='skygen:admin')adminCommand(actor,e.message);
    else actor.sendMessage('§aSkyGen command handler active. OP='+isOperator(actor)+' Admin='+isAdmin(actor)+' PermissionLevel='+String(actor.playerPermissionLevel)+' isOpAPI='+String(typeof actor.isOp));
   }catch(err){console.warn('[SkyGen CMD] '+err);try{actor.sendMessage('§cSkyGen command error: '+err)}catch{}}
  });
 });
 console.warn('[SkyGen CMD] command listener registered');
}catch(err){console.warn('[SkyGen CMD] LISTENER REGISTRATION FAILED '+err)}

function genError(message){genLastError=String(message);genErrors.push(`${system.currentTick}: ${genLastError}`);if(genErrors.length>20)genErrors.shift();console.warn("SkyGen generator: "+genLastError)}
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
function canVisit(p,id){return id>=0&&(ownerId(id)===p.id||visitors(id).includes(p.id)||trusted(id).includes(p.id))}
function setVisit(id,ids){world.setDynamicProperty('sg_visitors_'+id,JSON.stringify([...new Set(ids)]))}

function protectedAt(p,x,z){if(inSpawn(x,z))return true;const id=plotAt(x,z);return id>=0&&!canBuild(p,id)}
function marketRead(){try{const v=JSON.parse(String(world.getDynamicProperty(MARKET_KEY)||'[]'));return Array.isArray(v)?v:[]}catch{return []}}
function marketSave(v){world.setDynamicProperty(MARKET_KEY,JSON.stringify(v))}
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
 base.setType('minecraft:bedrock');
 output.setType(g.block);
 return true;
}
function genSave(){try{world.setDynamicProperty('sg_generators',JSON.stringify([...generators].slice(0,500)))}catch(e){console.warn('SkyGen generator save '+e)}}
function genLoad(){try{const arr=JSON.parse(String(world.getDynamicProperty('sg_generators')||'[]'));for(const [k,v] of arr){if(v&&GENS.some(g=>g.name===v.type))generators.set(k,v)}}catch(e){console.warn('SkyGen generator load '+e)}}
function playerByName(name){return world.getAllPlayers().find(q=>q.name.toLowerCase()===String(name).toLowerCase())}

const SPAWN_RADIUS=12;
const showTeleportText=(p,text)=>{try{p.onScreenDisplay.setTitle(text,{fadeInDuration:0,stayDuration:20,fadeOutDuration:0})}catch{}try{p.onScreenDisplay.setActionBar(text)}catch{}};
function inSpawn(x,z){return Math.abs(x)<=SPAWN_RADIUS&&Math.abs(z)<=SPAWN_RADIUS}
function createSpawn(){
 const dim=world.getDimension('overworld');
 try{
  // Construct a protected 25x25 platform at Y=0, and clear headroom above it.
  // Commands are split into small volumes to stay within block-change limits.
  dim.runCommand('fill -12 0 -12 12 0 12 stone_bricks');
  dim.runCommand('fill -12 1 -12 12 6 12 air');
  dim.runCommand('setworldspawn 0 2 0');
  world.setDynamicProperty('sg_spawn_ready',true);
  console.warn('[SkyGen] Spawn platform prepared at 0,0,0');
  return true;
 }catch(err){console.warn('[SkyGen] Spawn setup failed: '+err);return false}
}
function ensureSpawn(){
 createSpawn();
}

function profile(p){try{const d=p.getDynamicProperty('sg_profile');if(typeof d==='string')return {...{credits:1000,orbits:0,rank:1,xp:0,plot:-1},...JSON.parse(d)}}catch{}return {credits:1000,orbits:0,rank:1,xp:0,plot:-1}}
function save(p,d){p.setDynamicProperty('sg_profile',JSON.stringify(d))}
function coords(id){return {x:C.base.x+(id%C.columns)*C.spacing,y:C.base.y,z:C.base.z+Math.floor(id/C.columns)*C.spacing}}
function belongs(p,x,z){const d=profile(p);if(d.plot<0)return false;const c=coords(d.plot);return Math.abs(x-c.x)<=C.radius&&Math.abs(z-c.z)<=C.radius}
function plotAt(x,z){const dx=x-C.base.x,dz=z-C.base.z;if(dx< -C.radius||dz< -C.radius)return -1;const col=Math.round(dx/C.spacing),row=Math.round(dz/C.spacing);if(col<0||col>=C.columns||row<0)return -1;const id=row*C.columns+col,c=coords(id);return Math.abs(x-c.x)<=C.radius&&Math.abs(z-c.z)<=C.radius?id:-1}
function island(p,id){const c=coords(id),dim=world.getDimension('overworld');try{for(let x=-8;x<=8;x++)for(let z=-8;z<=8;z++){for(let y=-3;y<=-1;y++)dim.getBlock({x:c.x+x,y:c.y+y,z:c.z+z})?.setType(y===-1?'minecraft:grass_block':'minecraft:dirt')}dim.getBlock({x:c.x,y:c.y-1,z:c.z})?.setType('minecraft:gold_block');return true}catch(e){console.warn('SkyGen island: '+e);return false}}
function claim(p){const d=profile(p);if(d.plot>=0){if(!ownerId(d.plot))world.setDynamicProperty(keyForPlot(d.plot),p.id);return d;}const id=Number(world.getDynamicProperty('sg_next_plot')??0);d.plot=id;save(p,d);world.setDynamicProperty(keyForPlot(id),p.id);world.setDynamicProperty('sg_next_plot',id+1);p.sendMessage(`§aSkyGen: Plot #${id+1} assigned. Building starter island...`);system.runTimeout(()=>{if(island(p,id))p.sendMessage('§aYour starter island is ready! Use the Plot Horn.');else p.sendMessage('§eIsland generation failed (possibly unloaded chunks). Retry from the plot menu.')},10);return d}
function toolmatch(i,t){return i?.typeId===t.type&&i?.nameTag===t.name}
function isTool(i){return !!i&&TOOLS.some(t=>toolmatch(i,t))}
function ensure(p){try{const inv=p.getComponent('minecraft:inventory')?.container;if(!inv)return;for(const t of TOOLS){const old=inv.getItem(t.slot);if(toolmatch(old,t)&&old.lockMode===ItemLockMode.slot&&old.keepOnDeath)continue;if(old&&!isTool(old)){let free=-1;for(let i=9;i<inv.size;i++)if(!inv.getItem(i)){free=i;break}if(free<0)for(let i=0;i<6;i++)if(!inv.getItem(i)){free=i;break}if(free<0)continue;inv.setItem(free,old)}const item=new ItemStack(t.type,1);item.nameTag=t.name;item.lockMode=ItemLockMode.slot;item.keepOnDeath=true;inv.setItem(t.slot,item)}for(let i=0;i<inv.size;i++)if((i<6||i>8)&&isTool(inv.getItem(i)))inv.setItem(i,undefined)}catch(e){console.warn('SkyGen tools: '+e)}}
function teleportWatchdog(p,id,token){
 const t=pending.get(id);
 if(!t||t.token!==token)return;
 try{
  const now=system.currentTick,loc=p.location;
  if(p.dimension.id!==t.dim||Math.abs(loc.x-t.start.x)>0.15||Math.abs(loc.y-t.start.y)>0.15||Math.abs(loc.z-t.start.z)>0.15){
   pending.delete(id);showTeleportText(p,'§cTELEPORT CANCELLED');p.sendMessage('§cTeleport cancelled: you moved.');return;
  }
  if(now-t.created>160){pending.delete(id);showTeleportText(p,'§cTELEPORT TIMED OUT');return;}
  if(now<t.end){
   const n=Math.max(1,Math.ceil((t.end-now)/20));
   try{p.onScreenDisplay.setTitle('§e'+n,{fadeInDuration:0,stayDuration:5,fadeOutDuration:0})}catch{}
   try{p.onScreenDisplay.setActionBar('§eTeleport in '+n+' seconds — stand still')}catch{}
   if(t.lastShown!==n){t.lastShown=n;p.sendMessage('§e'+n+'...')}
   system.runTimeout(()=>teleportWatchdog(p,id,token),1);return;
  }
  pending.delete(id);
  if(t.visitPlot!==undefined&&!canVisit(p,t.visitPlot)){showTeleportText(p,'§cACCESS REVOKED');p.sendMessage('§cPlot access was revoked.');return}
  try{
   // The spawn landing is already solid. Do not modify the destination chunk during teleport.
   p.teleport(t.target,{dimension:world.getDimension('overworld'),checkForBlocks:false});
   cooldowns.set(id,system.currentTick+C.cooldown);
   showTeleportText(p,'§aTELEPORTED!');p.sendMessage('§aTeleport successful.');
   // Never rebuild a claimed plot during teleport: doing so would erase player builds.
  }catch(err){showTeleportText(p,'§cTELEPORT FAILED');p.sendMessage('§cTeleport failed: '+String(err));}
 }catch(err){pending.delete(id);try{p.sendMessage('§cTeleport timer error: '+String(err))}catch{};console.warn('SkyGen watchdog '+err)}
}
function tpRequest(p,target,label,visitPlot){
 const now=system.currentTick,id=p.id,until=cooldowns.get(id)||0;
 if(now<until){p.sendMessage('§cTeleport cooldown: '+Math.ceil((until-now)/20)+'s');return}
 if(pending.has(id)){p.sendMessage('§eTeleport already counting down.');return}
 const start={x:p.location.x,y:p.location.y,z:p.location.z};
 const token=now+'-'+id;
 pending.set(id,{start,dim:p.dimension.id,target,label,visitPlot,created:now,end:now+C.warmup,token,lastShown:5});
 p.sendMessage('§eTeleport to '+label+' in 5 seconds. Stand still!');
 showTeleportText(p,'§e5');
 system.runTimeout(()=>teleportWatchdog(p,id,token),1);
}
function tpPlot(p){
 const d=profile(p);if(d.plot<0)return p.sendMessage('§cYou have no plot.');
 const c=coords(d.plot);
 tpRequest(p,{x:c.x+0.5,y:c.y+1,z:c.z+0.5},'your plot');
}
function rank(p,d){
 const old=d.rank||1;d.rank=Math.min(50,1+Math.floor(d.xp/1000));
 if(d.rank>old){for(let n=old+1;n<=d.rank;n++){d.credits+=n*100;if(n%10===0)d.orbits+=1}p.sendMessage(`§dRank up! ${old} → ${d.rank}. Credits rewarded${Math.floor(d.rank/10)>Math.floor(old/10)?' + milestone Orbits':''}.`)}
 save(p,d);p.nameTag=`§b[Rank ${d.rank}] §r${p.name}`}

function form(p,title,body,buttons,cb){let f=new ActionFormData().title(title).body(body);for(const b of buttons)f=f.button(b);f.show(p).then(r=>{if(!r.canceled)cb(r.selection)}).catch(e=>console.warn('SkyGen UI '+e))}
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
function menu(p){const d=profile(p);form(p,'§l§bSKYGEN CORE',`§eCredits: ${d.credits}  §bOrbits: ${d.orbits}\n§dRank: ${d.rank}/50  XP: ${d.xp}\n§aPlot: ${d.plot+1}`,['My Plot','Visit Other Plots','Generators','Server Shop','Player Marketplace','Player Trading','Ranks','Wallet / Exchange','Teleport','Help'],i=>[()=>plotMenu(p),()=>visitMenu(p),()=>genMenu(p),()=>shop(p),()=>market(p),()=>trade(p),()=>ranks(p),()=>wallet(p),()=>teleports(p),()=>form(p,'Help','SkyGen v0.7.5. Marketplace, direct trades, 50 ranks and generator upgrades. Test on a world copy first.',['Back'],()=>back(p))][i]())}
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
 const c=coords(id);tpRequest(p,{x:c.x+0.5,y:c.y+1,z:c.z+0.5},`plot #${id+1}`,id);
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
  new MessageFormData().title('Allow Plot Visit?').body(`Allow ${requester.name} to visit plot #${id+1}?
They will not receive building permission.
You can revoke access any time.`).button1('Deny').button2('Allow').show(p).then(res=>{
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
   const lines=[`§bSkyGen Generator Deep Diagnostics v0.6.1`,`Generator: ${g.type} level ${lv} at ${g.x},${g.y},${g.z}`,`Registered: ${generators.get(key)===g} | Registry size: ${generators.size}`,`Base: ${base} | Output: ${output} | Expected: ${spec?.block||g.block}`,`Interval: ${interval}s | Empty: ${genEmptySeconds.get(key)||0}s`,`Watchdog runs: ${genWatchdogRuns} | Last heartbeat: ${age}`,`Script uptime: ${system.currentTick-genStartupTick} ticks | Current tick: ${system.currentTick}`,`Last error: ${genLastError}`,`Recent errors: ${genErrors.slice(-3).join(' ; ')||'none'}`];
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
   new MessageFormData().title('Upgrade Generator').body(`Level ${lv} → ${lv+1}\nCost: ${cost} Credits\nProduction interval reduced by 20%.`).button1('Cancel').button2('Upgrade').show(p).then(r=>{
    if(r.canceled||r.selection!==1)return;
    if(g.owner!==p.id||generators.get(key)!==g||g.level!==undefined&&g.level!==lv)return p.sendMessage('§cGenerator changed. Open the menu again.');
    const d=profile(p);if(d.credits<cost)return p.sendMessage('§cNot enough Credits.');
    d.credits-=cost;save(p,d);g.level=lv+1;g.period=Math.max(40,Math.round(g.period*0.8));genSave();p.sendMessage(`§a${g.type} upgraded to level ${g.level}.`);
   }).catch(e=>console.warn('SkyGen upgrade UI '+e));
  }else if(i===1){
   new MessageFormData().title('§cDELETE GENERATOR?').body(`Permanently delete ${g.type} Lv${lv} at ${g.x}, ${g.y}, ${g.z}?\nThis cannot be undone. No Credits or egg will be refunded.`).button1('Keep Generator').button2('DELETE').show(p).then(r=>{
    if(r.canceled||r.selection!==1)return;
    if(g.owner!==p.id||generators.get(key)!==g)return p.sendMessage('§cGenerator changed. Open the menu again.');
    try{
     const dim=world.getDimension('overworld');
     const base=dim.getBlock({x:g.x,y:g.y,z:g.z});
     const output=dim.getBlock({x:g.x,y:g.y+1,z:g.z});
     if(!base||!output)return p.sendMessage('§cGenerator chunk is not loaded. Stand near it and try again.');
     if(base.typeId!=='minecraft:bedrock')return p.sendMessage('§cGenerator base missing. Deletion cancelled to protect nearby blocks.');
     // Only remove the generated output, never player-built blocks.
     if(output.typeId===g.block)output.setType('minecraft:air');
     base.setType('minecraft:air');
     generators.delete(key);genSave();
     p.sendMessage(`§a${g.type} generator deleted. No refund issued.`);
    }catch(e){p.sendMessage('§cCould not delete generator. Stand near it and retry.');console.warn('SkyGen delete generator '+e)}
   }).catch(e=>console.warn('SkyGen delete UI '+e));
  }else myGenerators(p);
 });
}
function buyGen(p){form(p,'BUY GENERATOR',GENS.map((g,i)=>`${i+1}. ${g.name}: ${g.cost} Credits`).join('\n'),[...GENS.map(g=>g.name),'Back'],i=>{if(i>=GENS.length)return genMenu(p);const d=profile(p),g=GENS[i];if(d.credits<g.cost)return p.sendMessage('§cNot enough Credits.');const inv=inventory(p);if(!inv)return;const egg=new ItemStack('minecraft:egg',1);egg.nameTag=`§bSkyGen ${g.name} Generator`;egg.setLore([`Generator type: ${g.name}`,'Use on your plot to place']);if(inv.addItem(egg)){return p.sendMessage('§cInventory full. No charge.')}d.credits-=g.cost;save(p,d);p.sendMessage(`§aPurchased ${g.name} generator token.`)})}
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
      try{
       let left=count;
       while(left>0){const qty=Math.min(max,left);const remainder=inv.addItem(new ItemStack(item.id,qty));const received=qty-(remainder?.amount||0);delivered+=received;left-=qty;if(remainder)break;}
       if(delivered!==count){p.sendMessage('§cOnly '+delivered+' items delivered. No Credits charged; contact an admin.');return;}
       d.credits-=total;save(p,d);
      }catch(e){p.sendMessage('§cShop delivery/payment error: '+e+'. Items delivered: '+delivered);return;}
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
function teleports(p){form(p,'§bTELEPORTS','All teleports have a 5-second stand-still warmup and 5-second cooldown.',['Go to Spawn','Go to Plot','Back'],i=>{if(i===0){ensureSpawn();tpRequest(p,C.spawn,'spawn');}if(i===1)tpPlot(p);if(i===2)back(p)})}
function market(p){const d=profile(p),all=marketRead();form(p,'§6PLAYER MARKET',`Listings: ${all.length}/${MAX_LISTINGS}\nCredits wallet: ${d.credits}\nListed items are held in escrow.`,['Browse Listings','List an Item','My Listings / Cancel','Back'],i=>{if(i===0)marketBrowse(p);if(i===1)marketCreate(p);if(i===2)marketMine(p);if(i===3)back(p)})}
// Marketplace v2: remove listings from sale before delivery; keep item escrow in durable world data.
// Recovery uses explicit pending states. Transactions are serialized by the script event loop.
const MARKET_LOCK=new Set();
function marketLock(id,fn){if(MARKET_LOCK.has(id))return false;MARKET_LOCK.add(id);try{return fn()}finally{MARKET_LOCK.delete(id)}}
function validListing(l){return l&&typeof l.id==='string'&&typeof l.seller==='string'&&typeof l.type==='string'&&Number.isSafeInteger(l.count)&&l.count>=1&&l.count<=64&&Number.isSafeInteger(l.price)&&l.price>0}
function marketCreate(p){const a=itemChoices(p).filter(x=>!x.it.nameTag&&(!x.it.getLore||x.it.getLore().length===0)&&x.it.amount<=64);if(!a.length)return p.sendMessage('§cNo eligible plain item stacks.');form(p,'LIST ITEM','Only plain, unlocked item stacks are supported.',[...a.map(x=>`${x.it.typeId} ×${x.it.amount}`),'Back'],i=>{if(i>=a.length)return market(p);const x=a[i];new ModalFormData().title('Set Listing Price').textField('Enter price in Credits (1–2,000,000,000)','Example: 1000').show(p).then(r=>{if(r.canceled)return;const rawPrice=String(r.formValues?.[0]??'').trim();const price=/^[0-9]+$/.test(rawPrice)?Number(rawPrice):NaN;if(!Number.isSafeInteger(price)||price<1||price>2000000000)return p.sendMessage('§cInvalid price. Enter a whole number from 1 to 2,000,000,000.');marketLock('market',()=>{const all=marketRead();if(all.length>=MAX_LISTINGS)return p.sendMessage('§cMarket is full.');const it=inventory(p)?.getItem(x.slot);if(!it||it.typeId!==x.it.typeId||it.amount!==x.it.amount||it.nameTag||it.lockMode!==ItemLockMode.none||(it.getLore&&it.getLore().length))return p.sendMessage('§cItem changed. Try again.');const id=`${p.id}:${system.currentTick}:${Math.floor(Math.random()*100000)}`;const listing={id,seller:p.id,sellerName:p.name,type:it.typeId,count:it.amount,price,status:'active'};
 // Record the listing first, then take inventory. If removal fails, remove listing.
 try{marketSave([...all,listing])}catch(e){return p.sendMessage('§cUnable to save listing. No items removed.')}if(!removeExact(p,x.slot,it.typeId,it.amount)){try{marketSave(marketRead().filter(l=>l.id!==id))}catch{}return p.sendMessage('§cCould not escrow item. Listing rolled back.')}p.sendMessage('§aListing created; items escrowed.')})}).catch(e=>p.sendMessage('§cMarket UI failed: '+e))})}
function marketBrowse(p){const a=marketRead().filter(validListing).filter(l=>!l.status||l.status==='active');if(!a.length)return form(p,'MARKET','No listings yet.',['Back'],()=>market(p));form(p,'§6BUY FROM PLAYERS','Select a listing to buy.',[...a.map(x=>`${x.type} ×${x.count} — ${x.price} Credits (${x.sellerName})`),'Back'],i=>{if(i>=a.length)return market(p);const listing=a[i];if(listing.seller===p.id)return p.sendMessage('§eYou cannot buy your own listing.');new MessageFormData().title('Confirm Purchase').body(`${listing.type} ×${listing.count}\nCost: ${listing.price} Credits`).button1('Cancel').button2('Buy').show(p).then(r=>{if(r.canceled||r.selection!==1)return;marketLock('market',()=>{const all=marketRead(),idx=all.findIndex(x=>x.id===listing.id&&(!x.status||x.status==='active'));if(idx<0)return p.sendMessage('§cListing no longer available.');const l=all[idx];if(!validListing(l))return p.sendMessage('§cInvalid listing.');const d=profile(p);if(d.credits<l.price)return p.sendMessage('§cInsufficient Credits.');const stack=new ItemStack(l.type,l.count);if(!inventoryCapacity(p,stack))return p.sendMessage('§cFree inventory space first.');
 // Persist reservation before charging or delivery, preventing a second purchase.
 l.status='reserved';l.buyer=p.id;try{marketSave(all)}catch{return p.sendMessage('§cMarket storage unavailable.')}try{d.credits-=l.price;save(p,d)}catch{l.status='active';delete l.buyer;try{marketSave(all)}catch{}return p.sendMessage('§cPayment failed.')}try{const remainder=inventory(p).addItem(stack);if(remainder){d.credits+=l.price;save(p,d);l.status='active';delete l.buyer;marketSave(all);return p.sendMessage('§cDelivery failed; refunded.')}}catch(e){d.credits+=l.price;try{save(p,d)}catch{}l.status='active';delete l.buyer;try{marketSave(all)}catch{}return p.sendMessage('§cDelivery failed; refund attempted.')}
 // Mark sold before seller payment, so duplicate purchases cannot occur.
 l.status='sold';try{marketSave(all)}catch{p.sendMessage('§cItem delivered, but settlement needs administrator review.');return}
 const creditsKey='sg_proceeds_'+l.seller;try{world.setDynamicProperty(creditsKey,Number(world.getDynamicProperty(creditsKey)||0)+l.price);marketSave(marketRead().filter(x=>x.id!==l.id));p.sendMessage('§aPurchase complete!');const seller=world.getAllPlayers().find(q=>q.id===l.seller);seller?.sendMessage(`§aMarket sale: ${l.price} Credits pending collection.`)}catch(e){p.sendMessage('§eItem delivered; seller settlement pending administrator review.')}})}).catch(()=>{})})}
function marketMine(p){const a=marketRead().filter(x=>x.seller===p.id&&(!x.status||x.status==='active'));form(p,'MY LISTINGS','Select to cancel and reclaim items.',[...a.map(x=>`${x.type} ×${x.count} — ${x.price} Credits`),'Back'],i=>{if(i>=a.length)return market(p);const l=a[i];marketLock('market',()=>{const all=marketRead(),idx=all.findIndex(x=>x.id===l.id&&x.seller===p.id&&(!x.status||x.status==='active'));if(idx<0)return p.sendMessage('§cListing unavailable.');if(!validListing(l))return p.sendMessage('§cInvalid listing.');const stack=new ItemStack(l.type,l.count);if(!inventoryCapacity(p,stack))return p.sendMessage('§cFree inventory space before cancelling.');all[idx].status='returning';try{marketSave(all)}catch{return p.sendMessage('§cUnable to reserve cancellation.')}if(!give(p,stack)){all[idx].status='active';try{marketSave(all)}catch{}return p.sendMessage('§cUnable to return items.')}try{marketSave(marketRead().filter(x=>x.id!==l.id));p.sendMessage('§aListing cancelled; item returned.')}catch{p.sendMessage('§eItem returned; listing cleanup requires administrator review.')}})})}
function tradeBusy(p){const t=trades.get(p.id);if(!t)return false;const online=world.getAllPlayers();if(t.closed||system.currentTick-t.created>600||!online.some(x=>x.id===t.a)||!online.some(x=>x.id===t.b)){tradeClose(t,'Expired or abandoned trade cleared.');return false;}return true}
function trade(p){const online=world.getAllPlayers().filter(q=>q.id!==p.id);form(p,'§dDIRECT TRADING','Select an online player to propose an item-for-item trade. Both must confirm the exact offers.',[...online.map(q=>q.name),'Back'],i=>{if(i>=online.length)return back(p);const q=online[i];if(tradeBusy(p)||tradeBusy(q))return p.sendMessage('§cOne player is already trading. Ask them to cancel or wait up to 30 seconds.');tradeOffer(p,q)})}
function tradeOffer(p,q){const a=itemChoices(p).filter(x=>!x.it.nameTag&&(!x.it.getLore||x.it.getLore().length===0));if(!a.length)return p.sendMessage('§cNo eligible item stacks.');form(p,'OFFER ITEM',`Trading with ${q.name}. Select the stack to offer.`,[...a.map(x=>`${x.it.typeId} ×${x.it.amount}`),'Cancel'],i=>{if(i>=a.length)return;const x=a[i];tradeInvite(p,q,x.slot,x.it.typeId,x.it.amount)})}
function tradeInvite(p,q,slot,type,count){if(tradeBusy(p)||tradeBusy(q))return p.sendMessage('§cA trade is already active.');const id=`${p.id}-${system.currentTick}`,t={id,a:p.id,b:q.id,aSlot:slot,aType:type,aCount:count,created:system.currentTick,closed:false};trades.set(p.id,t);trades.set(q.id,t);system.runTimeout(()=>{if(trades.get(p.id)===t||trades.get(q.id)===t)tradeClose(t,'Trade timed out after 30 seconds.');},600);form(q,'§dTRADE REQUEST',`${p.name} offers ${type} ×${count}. Choose a stack to exchange.`,['Choose My Item','Decline'],i=>{if(trades.get(p.id)!==t)return;if(i===1)return tradeClose(t,'Trade declined.');const a=itemChoices(q).filter(x=>!x.it.nameTag&&(!x.it.getLore||x.it.getLore().length===0));if(!a.length)return tradeClose(t,'No eligible trade items.');form(q,'YOUR OFFER',`Exchange with ${p.name}`,[...a.map(x=>`${x.it.typeId} ×${x.it.amount}`),'Cancel'],j=>{if(j>=a.length)return tradeClose(t,'Trade cancelled.');const x=a[j];t.bSlot=x.slot;t.bType=x.it.typeId;t.bCount=x.it.amount;t.aOK=false;t.bOK=false;tradeConfirm(p,q,t)})})}
function tradeClose(t,message){if(t.closed)return;t.closed=true;if(trades.get(t.a)===t)trades.delete(t.a);if(trades.get(t.b)===t)trades.delete(t.b);for(const p of world.getAllPlayers())if(p.id===t.a||p.id===t.b)p.sendMessage('§e'+message)}
function tradeConfirm(p,q,t){const body=`${p.name}: ${t.aType} ×${t.aCount}\n${q.name}: ${t.bType} ×${t.bCount}\nBoth players must accept. No currency is transferred.`;for(const [player,field] of [[p,'aOK'],[q,'bOK']])new MessageFormData().title('§dCONFIRM TRADE').body(body).button1('Decline').button2('Accept').show(player).then(r=>{if(trades.get(player.id)!==t)return;if(r.canceled||r.selection!==1)return tradeClose(t,'Trade cancelled.');t[field]=true;if(t.aOK&&t.bOK)system.run(()=>tradeExecute(p,q,t))}).catch(()=>tradeClose(t,'Trade UI closed.'))}
function tradeExecute(p,q,t){if(trades.get(p.id)!==t||trades.get(q.id)!==t||t.executing)return;t.executing=true;try{const ai=inventory(p)?.getItem(t.aSlot),bi=inventory(q)?.getItem(t.bSlot);if(!ai||!bi||ai.typeId!==t.aType||bi.typeId!==t.bType||ai.amount!==t.aCount||bi.amount!==t.bCount||ai.nameTag||bi.nameTag||ai.lockMode!==ItemLockMode.none||bi.lockMode!==ItemLockMode.none||(ai.getLore&&ai.getLore().length)||(bi.getLore&&bi.getLore().length))return tradeClose(t,'Items changed; trade cancelled.');
 const aStack=ai.clone(),bStack=bi.clone();if(!inventoryCapacity(p,bStack)||!inventoryCapacity(q,aStack))return tradeClose(t,'Insufficient inventory space.');const aInv=inventory(p),bInv=inventory(q);if(!aInv||!bInv)return tradeClose(t,'Inventory unavailable.');
 // Preserve full item stacks and metadata; restore original slots on failure.
 aInv.setItem(t.aSlot,undefined);try{bInv.setItem(t.bSlot,undefined)}catch(e){aInv.setItem(t.aSlot,aStack);return tradeClose(t,'Trade cancelled.')}try{const ra=aInv.addItem(bStack);const rb=bInv.addItem(aStack);if(ra||rb)throw Error('Inventory changed during exchange');return tradeClose(t,'Trade completed successfully!')}catch(e){p.sendMessage('§cTrade delivery error. Check inventories; contact admin if items are missing.');q.sendMessage('§cTrade delivery error. Check inventories; contact admin if items are missing.');return tradeClose(t,'Trade encountered an error; manual review may be needed.')}}catch(e){tradeClose(t,'Trade failed safely: '+e)}}
function removeItemType(p,type,count){const inv=inventory(p);for(let i=0;i<inv.size&&count>0;i++){const it=inv.getItem(i);if(it?.typeId!==type||it.nameTag)continue;const n=Math.min(count,it.amount);removeExact(p,i,type,n);count-=n}}
world.afterEvents.playerSpawn.subscribe(e=>system.runTimeout(()=>{try{
 const p=e.player;ensureSpawn();const d=claim(p);const due=Number(world.getDynamicProperty('sg_proceeds_'+p.id)||0);if(due>0){d.credits+=due;world.setDynamicProperty('sg_proceeds_'+p.id,0);p.sendMessage(`§aMarketplace sales collected: ${due} Credits.`)}rank(p,d);ensure(p);
 // Fresh flat-void worlds start near Y=-63. Put players on the protected platform.
 // Initial join rescue is immediate; subsequent horn/menu teleports use warm-up.
 if(e.initialSpawn || p.location.y < -50){
  try{p.teleport(C.spawn,{dimension:world.getDimension('overworld'),checkForBlocks:false});
   p.sendMessage('§aWelcome to SkyGen spawn!');}
  catch(err){p.sendMessage('§cSpawn setup failed: '+String(err))}
 }
 p.sendMessage('§bSkyGen: menu compass slot 7, spawn horn slot 8, plot horn slot 9.');
 }catch(err){console.warn('SkyGen join '+err)}},30));
world.afterEvents.itemUse.subscribe(e=>{const p=e.source,i=e.itemStack;if(adminAxe(i)){system.run(()=>adminMenu(p));return;}if(toolmatch(i,TOOLS[0]))system.run(()=>menu(p));if(toolmatch(i,TOOLS[1]))system.run(()=>{ensureSpawn();if(p.location.y<-50){pending.delete(p.id);try{p.teleport(C.spawn,{dimension:world.getDimension('overworld'),checkForBlocks:false});cooldowns.set(p.id,system.currentTick+C.cooldown);p.sendMessage('§aEmergency void rescue to spawn.')}catch(e){p.sendMessage('§cRescue failed: '+e)}}else tpRequest(p,C.spawn,'spawn')});if(toolmatch(i,TOOLS[2]))system.run(()=>tpPlot(p));if(i?.typeId==='minecraft:egg'&&i.nameTag?.startsWith('§bSkyGen ')&&i.nameTag.endsWith(' Generator')){const name=i.nameTag.replace('§bSkyGen ','').replace(' Generator',''),g=GENS.find(g=>g.name===name);if(!g)return;const pos=p.location;if(!belongs(p,pos.x,pos.z)||ownerId(profile(p).plot)!==p.id)return p.sendMessage('§cUse generator eggs only on your own plot.');// Target the block the player is looking at, never a fixed world-direction offset.
 const hit=p.getBlockFromViewDirection({maxDistance:6,includeLiquidBlocks:false,includePassableBlocks:false});
 if(!hit?.block)return p.sendMessage('§cLook directly at a block on your plot to place the generator.');
 const target=hit.block.location;
 const loc={x:target.x,y:target.y+1,z:target.z};
 if(plotAt(loc.x,loc.z)!==profile(p).plot)return p.sendMessage('§cTarget a block inside your own plot.');
 // Bedrock is placed above the clicked floor; the permanent platform is untouched.
 if(loc.y<1||loc.y>300)return p.sendMessage('§cInvalid generator height.');const key=`${loc.x},${loc.y},${loc.z}`;if(generators.has(key))return p.sendMessage('§cGenerator already here.');const record={...loc,owner:p.id,type:g.name,period:g.period,block:g.block,last:system.currentTick,elapsed:0};try{if(!buildGenerator(record))return p.sendMessage('§cGenerator needs two empty blocks above the targeted block. Aim at an open floor area.')}catch(err){return p.sendMessage('§cGenerator could not be built: '+err)}generators.set(key,record);genSave();const inv=p.getComponent('minecraft:inventory')?.container;const selected=p.selectedSlotIndex,stack=inv?.getItem(selected);if(stack&&stack.nameTag===i.nameTag){if(stack.amount===1)inv.setItem(selected,undefined);else{stack.amount--;inv.setItem(selected,stack)}}p.sendMessage(`§aPlaced ${g.name} generator at ${loc.x},${loc.y},${loc.z}. The bedrock base is visible; the first ore appears immediately ON TOP, and regenerates after mining. Mine the ore to produce more.`)}});
world.beforeEvents.playerBreakBlock.subscribe(e=>{
 const {x,y,z}=e.block.location;
 const id=plotAt(x,z);
 // Starter island floor is permanent. The owner may build ABOVE it but cannot mine its layers.
 if(id>=0){const c=coords(id);if(Math.abs(x-c.x)<=8&&Math.abs(z-c.z)<=8&&y>=c.y-3&&y<=c.y-1){e.cancel=true;return;}}
 if(protectedAt(e.player,x,z))e.cancel=true;
});
world.beforeEvents.playerPlaceBlock.subscribe(e=>{if(protectedAt(e.player,e.block.location.x,e.block.location.z))e.cancel=true});
try{world.beforeEvents.playerInteractWithBlock.subscribe(e=>{if(protectedAt(e.player,e.block.location.x,e.block.location.z))e.cancel=true})}catch(e){console.warn('Interaction guard unavailable: '+e)}
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
   }catch(err){genError(key+' '+err)}
  }
 }catch(err){genError('watchdog '+err)}

}

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

system.runTimeout(()=>{try{ensureSpawn()}catch(e){console.warn("SkyGen spawn init: "+e)}},40);
console.warn('[SkyGen] 0.7.2 market, trading, generators and ranks loaded');
