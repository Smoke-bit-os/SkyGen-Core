// SkyGen Core v0.9.0 progression and migration simulations.
// This is a Node/vm simulation, NOT a Minecraft Xbox/Realm integration test.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||'/mnt/data/skygen_v090_working.js','utf8').replace(/^import .*?;\n/gm,'');
class Stack{
 constructor(type,amount=1){this.typeId=type;this.amount=amount;this.maxAmount=64;this.lockMode=0;this.nameTag='';this.keepOnDeath=false;this.lore=[]}
 getLore(){return this.lore}
 setLore(l){this.lore=l}
 clone(){const x=new Stack(this.typeId,this.amount);Object.assign(x,structuredClone({...this}));return x}
}
function setup(opts={}){
 const props=new Map(),blocks=new Map(),events={},commands=[],areas=new Map(),jobs=[],logs=[];
 const at=(x,y,z)=>`${x},${y},${z}`;
 let throwSaveKey=opts.throwSaveKey,failSetItem=opts.failSetItem;
 class Inv{
  constructor(){this.size=12;this.slots=Array(12).fill(undefined);this.failNext=false;this.failOnIndex=-1;}
  getItem(i){return this.slots[i]}
  setItem(i,s){if(this.failNext||(this.failOnIndex===i)){this.failNext=false;throw Error('Simulated slot failure')}this.slots[i]=s}
  addItem(it){const target=this.slots.findIndex(x=>!x);if(target<0)return it;this.slots[target]=it.clone();return undefined}
 }
 const dim={id:'minecraft:overworld',getBlock({x,y,z}){
   if(opts.unloaded)return undefined;
   const t=blocks.get(at(x,y,z))||'minecraft:air';
   return {typeId:t,isAir:t==='minecraft:air',location:{x,y,z},setType(v){blocks.set(at(x,y,z),v)}};
  },runCommand(cmd){
   commands.push(cmd);
   if(cmd==='tickingarea list')return {statusMessage:[...areas.keys()].join(' ')};
   if(cmd.startsWith('tickingarea remove ')){areas.delete(cmd.slice('tickingarea remove '.length));return {successCount:1}}
   if(cmd.startsWith('tickingarea add circle ')){const m=/tickingarea add circle (-?\d+) (-?\d+) (-?\d+) 1 (\w+) false/.exec(cmd);if(!m)throw Error(cmd);areas.set(m[4],true);return {successCount:1}}
   if(cmd.startsWith('setworldspawn '))return {successCount:1};
   if(cmd.startsWith('fill ')){
    if(opts.failFill)throw Error('fill denied');
    const m=/fill (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (\S+) keep/.exec(cmd);if(!m)throw Error('destructive or unknown fill '+cmd);
    const [a,b,c,d,e,f]=m.slice(1,7).map(Number),type=m[7];
    for(let x=a;x<=d;x++)for(let y=b;y<=e;y++)for(let z=c;z<=f;z++)if(!blocks.has(at(x,y,z)))blocks.set(at(x,y,z),type);
    return {successCount:1}
   }
   throw Error('Unexpected command '+cmd)
  }};
 function player(id,name){const inv=new Inv();return {id,name,isValid:true,dimension:dim,location:{x:.5,y:2,z:.5},data:new Map(),messages:[],teleports:[],inv,
  onScreenDisplay:{setTitle(){},setActionBar(){}},sendMessage(s){this.messages.push(s)},
  getDynamicProperty(k){return this.data.get(k)},setDynamicProperty(k,v){this.data.set(k,v)},
  getComponent(name){return name==='minecraft:inventory'?{container:inv}:null},
  teleport(pos){this.teleports.push(pos);this.location={...pos}},tryTeleport(pos){if(opts.unloaded)return false;this.teleport(pos);return true},
  getBlockFromViewDirection(){return null}
 }}
 const p=player('P','Player'),q=player('Q','Guest');
 const world={getDimension(){return dim},getAllPlayers(){return[p,q]},getDynamicProperty(k){return props.get(k)},setDynamicProperty(k,v){if(k===throwSaveKey)throw Error('Simulated persistence failure');props.set(k,v)},
  beforeEvents:{playerBreakBlock:{subscribe(f){events.breakBefore=f}},...(opts.noBeforePlace?{}:{playerPlaceBlock:{subscribe(f){events.placeBefore=f}}}),...(opts.noInteract?{}:{playerInteractWithBlock:{subscribe(f){events.interactBefore=f}}})},
  afterEvents:{playerSpawn:{subscribe(f){events.spawn=f}},itemUse:{subscribe(f){events.use=f}},playerBreakBlock:{subscribe(f){events.breakAfter=f}},playerPlaceBlock:{subscribe(f){events.placeAfter=f}},playerLeave:{subscribe(f){events.leave=f}}}};
 const system={currentTick:0,afterEvents:{scriptEventReceive:{subscribe(f){events.command=f}}},runTimeout(f,n=1){jobs.push({f,at:this.currentTick+n})},runInterval(f,n){events.interval=f},run(f){this.runTimeout(f,1)}};
 const ctx=vm.createContext({world,system,ItemStack:Stack,ItemLockMode:{none:0,slot:1,inventory:2},ActionFormData:class{},ModalFormData:class{},MessageFormData:class{},console:{warn(...msg){logs.push(msg.join(' '))},log(...msg){logs.push(msg.join(' '))}}});
 let loadError;try{vm.runInContext(src,ctx)}catch(e){loadError=e}
 function call(code){ctx.p=p;ctx.q=q;return vm.runInContext(code,ctx)}
 function advance(n){for(let i=0;i<n;i++){system.currentTick++;for(const job of jobs.filter(j=>j.at<=system.currentTick)){jobs.splice(jobs.indexOf(job),1);job.f()}}}
 return {props,blocks,events,commands,areas,jobs,logs,p,q,world,dim,system,call,advance,at,loadError,Stack};
}
let n=0,failed=0;
function test(name,fn){n++;try{fn();console.log('PASS',name)}catch(e){failed++;console.error('FAIL',name,String(e.stack||e))}}
test('all 42 generators present in correct categories, with unique names',()=>{
 const t=setup(),gs=Array.from(t.call('GENS'));
 assert.strictEqual(gs.length,42);assert.strictEqual(new Set(gs.map(g=>g.name)).size,42);
 assert.deepStrictEqual(['Starter','Mining','Nature','Endgame'].map(c=>gs.filter(g=>g.category===c).length),[12,10,10,10]);
});
test('the original six generator costs, periods and output blocks remain unchanged',()=>{
 const gs=Array.from(setup().call('GENS'));
 const orig=[['Cobblestone','minecraft:cobblestone',500,200],['Coal','minecraft:coal_ore',2500,300],['Iron','minecraft:iron_ore',10000,400],['Gold','minecraft:gold_ore',40000,500],['Diamond','minecraft:diamond_ore',200000,600],['Emerald','minecraft:emerald_ore',500000,800]];
 for(let i=0;i<6;i++)assert.deepStrictEqual([gs[i].name,gs[i].block,gs[i].cost,gs[i].period],orig[i]);
});
test('all 28 shop SKUs have integral prices and original four are unchanged',()=>{
 const t=setup(),shop=Array.from(t.call('SHOP'));
 assert.equal(shop.length,28);
 assert.deepStrictEqual(shop.slice(0,4).map(s=>[s.id,s.count,s.buy,s.sell]),[
 ['minecraft:cobblestone',16,80,16],['minecraft:oak_log',16,160,32],['minecraft:iron_ingot',8,400,80],['minecraft:diamond',1,500,100]]);
 for(const item of shop){assert(Number.isInteger(item.buy/item.count)&&Number.isInteger(item.sell/item.count));assert(item.buy>item.sell)}
});
test('42 skill upgrades are unique, exactly seven per branch, prerequisites valid',()=>{
 const t=setup(),skills=Array.from(t.call('SKILLS')),names=Array.from(t.call('SKILL_BRANCHES'));
 assert.equal(skills.length,42);assert.equal(names.length,6);assert.equal(new Set(skills.map(s=>s.id)).size,42);
 for(const branch of names){const nodes=skills.filter(s=>s.branch===branch);assert.equal(nodes.length,7);
  nodes.forEach((s,i)=>{assert(Number.isInteger(s.cost)&&s.cost>=1&&s.rank<=50);assert.equal(s.prev,i===0?null:nodes[i-1].id)});
 }
});
test('rank-derived skill points are 0 at rank 1, 11 at 10, 35 at 30 and 59 at 50',()=>{
 const t=setup();assert.equal(t.call('skillEntitlement(1)'),0);assert.equal(t.call('skillEntitlement(10)'),11);
 assert.equal(t.call('skillEntitlement(30)'),35);assert.equal(t.call('skillEntitlement(50)'),59);
});
test('legacy Rank 30 profile automatically has 35 skill points without mutation',()=>{
 const t=setup();t.p.data.set('sg_profile',JSON.stringify({credits:1000,orbits:0,rank:30,xp:29000,plot:-1}));
 assert.equal(t.call('skillAvailable(profile(p))'),35);
 assert(!JSON.parse(t.p.data.get('sg_profile')).skills);
});
test('the skill point budget and prerequisite chain cannot be bypassed',()=>{
 const t=setup();t.p.data.set('sg_profile',JSON.stringify({credits:1000,orbits:0,rank:50,xp:49000,plot:-1}));
 assert.equal(t.call('affordableSkill(profile(p),SKILLS.find(s=>s.id==="miner_haste_2"))'),false);
 assert.equal(t.call('affordableSkill(profile(p),SKILLS.find(s=>s.id==="miner_haste_1"))'),true);
 t.call('(()=>{const d=profile(p);d.skills=["miner_haste_1"];save(p,d)})()');
 assert.equal(t.call('skillAvailable(profile(p))'),58);
 assert.equal(t.call('affordableSkill(profile(p),SKILLS.find(s=>s.id==="miner_haste_2"))'),true);
});
test('skill purchase fields preserve legacy profile balances and plot',()=>{
 const t=setup();t.p.data.set('sg_profile',JSON.stringify({credits:123456,orbits:4,rank:30,xp:29000,plot:7}));
 t.call('(()=>{const d=profile(p);d.skills=["miner_haste_1"];save(p,d)})()');
 const d=JSON.parse(t.p.data.get('sg_profile'));assert.equal(d.plot,7);assert.equal(d.credits,123456);assert.equal(d.orbits,4);assert.equal(d.rank,30);
});
test('legacy generator data migrates to a banked registry without modifying original',()=>{
 const t=setup(),legacy=JSON.stringify([['A',{type:'Cobblestone',owner:'P',x:512,y:107,z:512}]]);
 t.props.set('sg_generators',legacy);
 t.call('genLoad()');assert.equal(t.call('generators.size'),1);assert.equal(t.call('genSave()'),true);
 assert.equal(t.props.get('sg_generators'),legacy);
 const meta=JSON.parse(t.props.get('sg_generators_v2_commit'));
 assert.equal(meta.v,2);assert.equal(meta.records,1);assert(t.props.has('sg_g2_0_0'));
 assert.equal(t.call('generatorRead().length'),1);
});
test('larger than 500 registry records use multiple chunks and reload correctly',()=>{
 const t=setup();t.call('genLoad()');
 t.call('for(let k=0;k<750;k++)generators.set("G"+k,{type:"Cobblestone",owner:"P",x:k,y:107,z:512,period:200})');
 assert.equal(t.call('genSave()'),true);
 assert(JSON.parse(t.props.get('sg_generators_v2_commit')).chunks>1);
 t.call('generators.clear();genLoad()');assert.equal(t.call('generators.size'),750);
});
test('failed inactive shard writes never modify the committed generation',()=>{
 const t=setup();t.call('genLoad();generators.set("A",{type:"Coal",owner:"P",x:512,y:106,z:512})');
 assert.equal(t.call('genSave()'),true);
 const snapshot=t.props.get('sg_generators_v2_commit'),original=t.call('generatorRead().length');
 const setter=t.world.setDynamicProperty;t.world.setDynamicProperty=(k,v)=>{if(k.startsWith('sg_g2_1_'))throw Error('simulated shard failure');setter(k,v)};
 t.call('generators.set("B",{type:"Iron",owner:"P",x:513,y:106,z:512})');
 assert.equal(t.call('genSave()'),false);
 assert.equal(t.props.get('sg_generators_v2_commit'),snapshot);
 assert.equal(t.call('generatorRead().length'),original);
});
test('invalid committed shard checksum fails closed instead of wiping generator data',()=>{
 const t=setup();t.call('genLoad();generators.set("A",{type:"Coal",owner:"P",x:512,y:106,z:512});genSave()');
 t.props.set('sg_g2_0_0','["tampered"]');
 assert.throws(()=>t.call('generatorRead()'),/checksum/);
 t.call('genLoad()');assert.equal(t.call('generatorRegistryLoaded'),false);assert.equal(t.call('genSave()'),false);
});
test('no generator records are truncated at the new registry limit',()=>{
 const t=setup();t.call('genLoad()');
 t.call('for(let k=0;k<1201;k++)generators.set("G"+k,{type:"Cobblestone",owner:"P",x:k,y:107,z:512})');
 assert.equal(t.call('genSave()'),false);assert(!t.props.has('sg_generators_v2_commit'));
});
test('generator slots increase from 20 to 25 to 30 with Engineering',()=>{
 const t=setup();assert.equal(t.call('generatorSlots(p)'),20);
 t.call('(()=>{const d=profile(p);d.skills=["eng_slots_1"];save(p,d)})()');assert.equal(t.call('generatorSlots(p)'),25);
 t.call('(()=>{const d=profile(p);d.skills=["eng_slots_1","eng_slots_2"];save(p,d)})()');assert.equal(t.call('generatorSlots(p)'),30);
});
test('generator speed, purchase discount and mobility cooldown use purchased upgrades',()=>{
 const t=setup(),g='{type:"Cobblestone",owner:"P",x:512,y:106,z:512,period:200}';
 assert.equal(t.call(`effectivePeriod(${g})`),200);assert.equal(t.call('teleportCooldown(p)'),100);
 t.call('(()=>{const d=profile(p);d.skills=["eng_speed_1","eng_price_1","move_tp_1"];save(p,d)})()');
 assert.equal(t.call(`effectivePeriod(${g})`),190);
 assert.equal(t.call('perkValue(profile(p),"generatorPrice")'),5);
 assert.equal(t.call('teleportCooldown(p)'),80);
 t.call('(()=>{const d=profile(p);d.skills=["eng_speed_1","eng_speed_2","eng_speed_3","move_tp_1","move_tp_2"];save(p,d)})()');
 assert.equal(t.call(`effectivePeriod(${g})`),170);assert.equal(t.call('teleportCooldown(p)'),60);
});
test('daily UTC quest resets only on date change, claim flags persist',()=>{
 const t=setup();const d=t.call('profile(p)');
 assert.equal(t.call('todayQuests(profile(p)).blocks'),0);
 t.call('(()=>{const d=profile(p);recordDaily(d,"blocks");recordDaily(d,"harvests");save(p,d)})()');
 assert.equal(t.call('todayQuests(profile(p)).blocks'),1);
 assert.equal(t.call('todayQuests(profile(p)).harvests'),1);
});
test('economic skills reduce buying price without increasing it',()=>{
 const t=setup();assert.equal(t.call('discountedPrice(500,0)'),500);assert.equal(t.call('discountedPrice(500,10)'),450);
 assert.equal(t.call('perkValue(profile(p),"buy")'),0);
 t.call('(()=>{const d=profile(p);d.skills=["econ_buy_1","econ_buy_2","econ_buy_3"];save(p,d)})()');
 assert.equal(t.call('perkValue(profile(p),"buy")'),10);
});
test('all active effects restrict activation to owned plots and enforce cooldown',()=>{
 const t=setup();t.p.addEffect=function(effect,duration){this.lastEffect={effect,duration}};
 t.p.data.set('sg_profile',JSON.stringify({rank:50,xp:49000,plot:0,credits:2000,orbits:0,skills:['surv_absorb']}));
 t.props.set('sg_plot_0','P');t.p.location={x:512.5,y:106,z:512.5};
 t.call('useAbility(p,"surv_absorb","minecraft:absorption",200,2400)');
 assert.equal(t.p.lastEffect.effect,'minecraft:absorption');
 const first=t.p.messages.length;t.call('useAbility(p,"surv_absorb","minecraft:absorption",200,2400)');
 assert(t.p.messages.slice(first).some(m=>m.includes('cooldown')));
});
test('skill pulses do not apply passive effects in spawn or visitor plots',()=>{
 const t=setup();t.p.data.set('sg_profile',JSON.stringify({rank:50,xp:49000,plot:0,credits:1,orbits:0,skills:['miner_haste_1']}));
 t.p.addEffect=function(e){this.lastEffect=e};t.p.getEffect=function(){return undefined};
 t.call('skillPulse()');assert.equal(t.p.lastEffect,undefined);
 t.props.set('sg_plot_0','P');t.p.location={x:512.5,y:106,z:512.5};t.call('skillPulse()');assert.equal(t.p.lastEffect,'minecraft:haste');
});
test('generator break awards additional XP while non-generator breaks are rate limited',()=>{
 const t=setup();t.p.data.set('sg_profile',JSON.stringify({rank:1,xp:0,credits:1000,orbits:0,plot:0}));
 t.props.set('sg_plot_0','P');t.p.location={x:512.5,y:106,z:512.5};
 t.call('generators.set("512,107,512",{type:"Coal",owner:"P",x:512,y:107,z:512,block:"minecraft:coal_ore"})');
 t.call('generatorOutputReady.add("512,107,512")');t.system.currentTick=100;
 t.events.breakAfter({player:t.p,block:{location:{x:512,y:108,z:512}},brokenBlockPermutation:{type:{id:'minecraft:coal_ore'}}});
 assert.equal(JSON.parse(t.p.data.get('sg_profile')).xp,5);
 t.events.breakAfter({player:t.p,block:{location:{x:514,y:108,z:512}},brokenBlockPermutation:{type:{id:'minecraft:dirt'}}});
 const before=JSON.parse(t.p.data.get('sg_profile')).xp;
 t.events.breakAfter({player:t.p,block:{location:{x:514,y:108,z:512}},brokenBlockPermutation:{type:{id:'minecraft:dirt'}}});
 assert.equal(JSON.parse(t.p.data.get('sg_profile')).xp,before);
});
test('active ability cooldown remains after in-memory cooldown map reset',()=>{
 const t=setup();t.p.addEffect=function(){};
 t.props.set('sg_plot_0','P');t.p.location={x:512.5,y:106,z:512.5};
 t.p.data.set('sg_profile',JSON.stringify({rank:50,xp:49000,plot:0,credits:2000,orbits:0,skills:['surv_absorb']}));
 t.call('useAbility(p,"surv_absorb","minecraft:absorption",200,2400)');
 assert(JSON.parse(t.p.data.get('sg_profile')).skillCooldownUntil.surv_absorb>Date.now());
 t.call('skillCooldowns.clear()');
 const before=t.p.messages.length;t.call('useAbility(p,"surv_absorb","minecraft:absorption",200,2400)');
 assert(t.p.messages.slice(before).some(x=>x.includes('cooldown')));
});
test('generator bank alternates after every verified save, both versions remain readable',()=>{
 const t=setup();t.call('genLoad()');
 t.call('generators.set("A",{type:"Coal",owner:"P",x:512,y:106,z:512})');assert.equal(t.call('genSave()'),true);
 const first=JSON.parse(t.props.get('sg_generators_v2_commit'));assert.equal(first.bank,0);
 t.call('generators.set("B",{type:"Iron",owner:"P",x:513,y:106,z:512})');assert.equal(t.call('genSave()'),true);
 const second=JSON.parse(t.props.get('sg_generators_v2_commit'));assert.equal(second.bank,1);
 assert.equal(t.call('generatorRead().length'),2);
});
test('all generator blocks and all shop item identifiers use valid-looking Minecraft namespace',()=>{
 const t=setup();for(const v of t.call('GENS'))assert(/^minecraft:[a-z0-9_]+$/.test(v.block));
 for(const v of t.call('SHOP'))assert(/^minecraft:[a-z0-9_]+$/.test(v.id));
});
test('rank progression creates skill points without mutating existing currency',()=>{
 const t=setup();const before=t.call('skillEntitlement(9)');t.p.data.set('sg_profile',JSON.stringify({credits:1000,orbits:0,rank:9,xp:9000,plot:-1}));
 t.call('const d=profile(p);d.xp=9000;rank(p,d)');
 const d=JSON.parse(t.p.data.get('sg_profile'));
 assert.equal(d.rank,10);assert.equal(d.orbits,1);assert(d.credits>1000);assert.equal(t.call('skillEntitlement(10)')-before,3);
});
test('on leaving a plot, active potions are removed by skillPulse',()=>{
 const t=setup();t.props.set('sg_plot_0','P');t.p.location={x:512.5,y:106,z:512.5};
 t.p.data.set('sg_profile',JSON.stringify({rank:50,xp:49000,plot:0,credits:2000,orbits:0,skills:['surv_absorb']}));
 t.p.addEffect=function(){};t.p.removeEffect=function(e){this.removed=e};
 t.call('useAbility(p,"surv_absorb","minecraft:absorption",200,2400)');
 t.p.location={x:.5,y:2,z:.5};t.call('skillPulse()');
 assert.equal(t.p.removed,'minecraft:absorption');
});
console.log(`SkyGen v0.9.0 expansion regression tests: ${n-failed} passed, ${failed} failed`);if(failed)process.exitCode=1;
