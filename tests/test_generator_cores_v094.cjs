// SkyGen Core v0.9.0 comprehensive mocked validation suite.
// This is a Node/vm simulation, NOT a Minecraft Xbox/Realm integration test.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||'/mnt/data/skygen_v091_work/behavior_pack/scripts/main.js','utf8').replace(/^import .*?;\n/gm,'');
class Stack{
 constructor(type,amount=1){this.typeId=type;this.amount=amount;this.maxAmount=(type==='minecraft:goat_horn'||type.startsWith('skygen:generator_'))?1:type==='minecraft:egg'?16:64;this.lockMode=0;this.nameTag='';this.keepOnDeath=false;this.lore=[];this.props={}}
 getLore(){return this.lore}
 setLore(l){this.lore=l}
 setDynamicProperty(k,v){if(this.maxAmount!==1)throw Error('UnsupportedFunctionalityError: item dynamic properties require non-stackable items');this.props[k]=v}
 getDynamicProperty(k){return this.props[k]}
 getDynamicPropertyIds(){return Object.keys(this.props)}
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
  swapItems(from,to,other){if(this.failSwap||other.failSwap)throw Error('Swap failed without mutation');const a=this.slots[from],b=other.slots[to];this.slots[from]=b;other.slots[to]=a;}
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
  getBlockFromViewDirection(){return {block:{location:{x:512,y:106,z:512}}}}
 }}
 const p=player('P','Player'),q=player('Q','Guest');p.selectedSlotIndex=0;q.selectedSlotIndex=0;
 const world={getDimension(){return dim},getAllPlayers(){return[p,q]},getDynamicProperty(k){return props.get(k)},getDynamicPropertyIds(){return [...props.keys()]},setDynamicProperty(k,v){if(k===throwSaveKey)throw Error('Simulated persistence failure');props.set(k,v)},
  beforeEvents:{itemUse:{subscribe(f){events.itemUseBefore=f}},explosion:{subscribe(f){events.explosionBefore=f}},playerBreakBlock:{subscribe(f){events.breakBefore=f}},...(opts.noBeforePlace?{}:{playerPlaceBlock:{subscribe(f){events.placeBefore=f}}}),...(opts.noInteract?{}:{playerInteractWithBlock:{subscribe(f){events.interactBefore=f}}})},
  afterEvents:{playerSpawn:{subscribe(f){events.spawn=f}},itemUse:{subscribe(f){events.use=f}},playerBreakBlock:{subscribe(f){events.breakAfter=f}},playerPlaceBlock:{subscribe(f){events.placeAfter=f}},playerLeave:{subscribe(f){events.leave=f}}}};
 const system={currentTick:0,beforeEvents:{startup:{subscribe(f){events.startup=f}}},afterEvents:{scriptEventReceive:{subscribe(f){events.command=f}}},runTimeout(f,n=1){jobs.push({f,at:this.currentTick+n})},runInterval(f,n){events.interval=f},run(f){this.runTimeout(f,1)}};
 const ctx=vm.createContext({world,system,ItemStack:Stack,ItemLockMode:{none:0,slot:1,inventory:2},ActionFormData:class{},ModalFormData:class{},MessageFormData:class{},console:{warn(...msg){logs.push(msg.join(' '))},log(...msg){logs.push(msg.join(' '))}}});
 let loadError;try{vm.runInContext(src,ctx);if(events.startup){events.customItems={};events.startup({itemComponentRegistry:{registerCustomComponent(id,handlers){events.customItems[id]=handlers}}})}}catch(e){loadError=e}
 function call(code){ctx.p=p;ctx.q=q;return vm.runInContext(code,ctx)}
 function advance(n){for(let i=0;i<n;i++){system.currentTick++;for(const job of jobs.filter(j=>j.at<=system.currentTick)){jobs.splice(jobs.indexOf(job),1);job.f()}}}
 return {props,blocks,events,commands,areas,jobs,logs,p,q,world,dim,system,call,advance,at,loadError,Stack};
}

let n=0,failed=0;
function test(name,fn){n++;try{fn();console.log('PASS',name)}catch(err){failed++;console.error('FAIL',name,err.stack||err)}}
function addGen(t,name='Cobblestone',pos={x:512,y:107,z:512}){
 const g=t.call('GENS.find(x=>x.name==='+JSON.stringify(name)+')');
 const rec={...pos,type:name,block:g.block,owner:'P',period:g.period,last:0,elapsed:0};
 t.call('generators.set('+JSON.stringify(`${pos.x},${pos.y},${pos.z}`)+','+JSON.stringify(rec)+')');
 return rec;
}
function owned(t){t.call('genLoad()');t.props.set('sg_plot_0','P');t.p.location={x:512.5,y:106,z:512.5};t.p.data.set('sg_profile',JSON.stringify({credits:2000000,orbits:0,xp:1000,rank:50,plot:0}));}
function issue(t,name='Cobblestone'){
 owned(t);t.call(`issueGeneratorToken(p,GENS.find(x=>x.name===${JSON.stringify(name)}),500)`);
 const item=t.p.inv.getItem(0);assert(item);return {item,id:item.getDynamicProperty('sg_token_id')};
}

test('42 generator types map to distinct stable namespaced core IDs',()=>{
 const t=setup();assert(!t.loadError);
 const all=JSON.parse(t.call('JSON.stringify(GENS.map(x=>generatorCoreType(x)))'));
 assert.equal(all.length,42);assert.equal(new Set(all).size,42);
 assert(all.every(x=>/^skygen:[a-z0-9_]+_generator_core$/.test(x)));
});
test('the original custom generator token IDs remain unchanged',()=>{
 const t=setup();assert.equal(t.call("generatorItemId(GENS.find(x=>x.name==='Cobblestone'))"),'skygen:generator_cobblestone');
});
test('new purchase places its custom core and resource above, not bedrock',()=>{
 const t=setup(),{id}=issue(t);t.call(`placeGeneratorToken(p,0,${JSON.stringify(id)})`);
 assert.equal(t.blocks.get(t.at(512,107,512)),'skygen:cobblestone_generator_core');
 assert.equal(t.blocks.get(t.at(512,108,512)),'minecraft:cobblestone');
 assert.equal(t.call('generators.size'),1);assert.equal(t.call(`tokenRead(${JSON.stringify(id)}).status`),'spent');
});
test('diamond token places diamond-specific core and ore output',()=>{
 const t=setup(),{id}=issue(t,'Diamond');t.call(`placeGeneratorToken(p,0,${JSON.stringify(id)})`);
 assert.equal(t.blocks.get(t.at(512,107,512)),'skygen:diamond_generator_core');
 assert.equal(t.blocks.get(t.at(512,108,512)),'minecraft:diamond_ore');
});
test('existing bedrock at new token target cannot be replaced and token is kept',()=>{
 const t=setup(),{id}=issue(t);t.blocks.set(t.at(512,107,512),'minecraft:bedrock');
 t.call(`placeGeneratorToken(p,0,${JSON.stringify(id)})`);
 assert.equal(t.blocks.get(t.at(512,107,512)),'minecraft:bedrock');
 assert.equal(t.call('generators.size'),0);assert(t.p.inv.getItem(0));
 assert.equal(t.call(`tokenRead(${JSON.stringify(id)}).status`),'issued');
});
test('existing player block at new token target cannot be replaced',()=>{
 const t=setup(),{id}=issue(t);t.blocks.set(t.at(512,107,512),'minecraft:gold_block');
 t.call(`placeGeneratorToken(p,0,${JSON.stringify(id)})`);
 assert.equal(t.blocks.get(t.at(512,107,512)),'minecraft:gold_block');assert(t.p.inv.getItem(0));
});
test('registered legacy bedrock migrates to the matching custom core',()=>{
 const t=setup();const rec=addGen(t);t.blocks.set(t.at(512,107,512),'minecraft:bedrock');
 t.blocks.set(t.at(512,108,512),'minecraft:cobblestone');t.call('genWatchdog()');
 assert.equal(t.blocks.get(t.at(512,107,512)),'skygen:cobblestone_generator_core');
 assert.equal(t.blocks.get(t.at(512,108,512)),'minecraft:cobblestone');
 assert.equal(t.call('generators.size'),1);
});
test('legacy diamond generator migration uses diamond texture block',()=>{
 const t=setup();addGen(t,'Diamond');t.blocks.set(t.at(512,107,512),'minecraft:bedrock');
 t.call('genWatchdog()');assert.equal(t.blocks.get(t.at(512,107,512)),'skygen:diamond_generator_core');
});
test('migration changes only the base at registered coordinates',()=>{
 const t=setup();addGen(t);t.blocks.set(t.at(512,107,512),'minecraft:bedrock');t.blocks.set(t.at(515,107,515),'minecraft:bedrock');
 t.call('genWatchdog()');assert.equal(t.blocks.get(t.at(515,107,515)),'minecraft:bedrock');
});
test('wrong foreign block at a registered base is never overwritten',()=>{
 const t=setup();addGen(t);t.blocks.set(t.at(512,107,512),'minecraft:diamond_block');t.call('genWatchdog()');
 assert.equal(t.blocks.get(t.at(512,107,512)),'minecraft:diamond_block');
});
test('migration remains idempotent and does not rewrite converted base',()=>{
 const t=setup();addGen(t);t.blocks.set(t.at(512,107,512),'minecraft:bedrock');
 let writes=0;const orig=t.dim.getBlock;
 t.dim.getBlock=function(loc){const b=orig(loc);if(loc.x===512&&loc.y===107&&loc.z===512){const st=b.setType;b.setType=x=>{writes++;st(x)}}return b};
 t.call('genWatchdog()');t.call('genWatchdog()');assert.equal(writes,1);
});
test('a failed conversion retains registered bedrock for safe retry',()=>{
 const t=setup();addGen(t);t.blocks.set(t.at(512,107,512),'minecraft:bedrock');const orig=t.dim.getBlock;
 t.dim.getBlock=function(loc){const b=orig(loc);if(loc.x===512&&loc.y===107&&loc.z===512)b.setType=()=>{throw Error('chunk save failure')};return b};
 t.call('genWatchdog()');assert.equal(t.blocks.get(t.at(512,107,512)),'minecraft:bedrock');
 assert.equal(t.call('generators.size'),1);
});
test('registered custom core is accepted by generator watchdog',()=>{
 const t=setup();addGen(t);t.blocks.set(t.at(512,107,512),'skygen:cobblestone_generator_core');
 t.call('genWatchdog()');assert.equal(t.call('genEmptySeconds.size'),1);
});
test('old bedrock converts even when output block is still present',()=>{
 const t=setup();addGen(t);t.blocks.set(t.at(512,107,512),'minecraft:bedrock');
 t.blocks.set(t.at(512,108,512),'minecraft:cobblestone');t.call('genWatchdog()');
 assert.equal(t.blocks.get(t.at(512,107,512)),'skygen:cobblestone_generator_core');
});
test('new custom core output regenerates on normal configured timing',()=>{
 const t=setup();addGen(t);t.blocks.set(t.at(512,107,512),'skygen:cobblestone_generator_core');
 t.system.currentTick=100;t.call('genWatchdog()');
 t.system.currentTick=301;t.call('genWatchdog()');
 assert.equal(t.blocks.get(t.at(512,108,512)),'minecraft:cobblestone');
});
test('custom core is protected against owner mining',()=>{
 const t=setup();addGen(t);t.blocks.set(t.at(512,107,512),'skygen:cobblestone_generator_core');
 const e={player:t.p,block:t.dim.getBlock({x:512,y:107,z:512}),cancel:false};
 t.events.breakBefore(e);assert.equal(e.cancel,true);
});
test('custom core is protected against visitor mining',()=>{
 const t=setup();addGen(t);t.blocks.set(t.at(512,107,512),'skygen:cobblestone_generator_core');
 const e={player:t.q,block:t.dim.getBlock({x:512,y:107,z:512}),cancel:false};t.events.breakBefore(e);assert.equal(e.cancel,true);
});
test('registered legacy bedrock also guarded against owner mining',()=>{
 const t=setup();addGen(t);t.blocks.set(t.at(512,107,512),'minecraft:bedrock');
 const e={player:t.p,block:t.dim.getBlock({x:512,y:107,z:512}),cancel:false};t.events.breakBefore(e);assert.equal(e.cancel,true);
});
test('failed generator persistence removes only freshly placed core',()=>{
 const t=setup(),{id}=issue(t);const orig=t.world.setDynamicProperty;
 t.world.setDynamicProperty=(k,v)=>{if(k==='sg_generators_v2_commit')throw Error('storage failed');orig(k,v)};
 t.call(`placeGeneratorToken(p,0,${JSON.stringify(id)})`);
 assert.equal(t.blocks.get(t.at(512,107,512)),'minecraft:air');assert.equal(t.blocks.get(t.at(512,108,512)),'minecraft:air');
 assert.equal(t.call('generators.size'),0);assert.equal(t.call(`tokenRead(${JSON.stringify(id)}).status`),'review');
});
test('failed output creation rolls back custom core and never strands it',()=>{
 const t=setup();const dim=t.dim,orig=dim.getBlock;
 dim.getBlock=function(pos){const b=orig(pos);if(pos.x===512&&pos.y===108&&pos.z===512)b.setType=()=>{throw Error('output failure')};return b};
 assert.throws(()=>t.call('buildGenerator({x:512,y:107,z:512,type:"Cobblestone",block:"minecraft:cobblestone"})'),/output failure/);
 assert.equal(t.blocks.get(t.at(512,107,512)),'minecraft:air');
});
test('failed conversion cannot overwrite a different custom core',()=>{
 const t=setup();addGen(t,'Diamond');t.blocks.set(t.at(512,107,512),'skygen:cobblestone_generator_core');
 t.call('genWatchdog()');assert.equal(t.blocks.get(t.at(512,107,512)),'skygen:cobblestone_generator_core');
});


test('deletion removes registered custom core and expected generated output',()=>{
 const t=setup();const g=addGen(t);t.blocks.set(t.at(512,107,512),'skygen:cobblestone_generator_core');
 t.blocks.set(t.at(512,108,512),'minecraft:cobblestone');t.call(`eraseGeneratorWorldBlocks(world.getDimension('overworld'),${JSON.stringify(g)})`);
 assert.equal(t.blocks.get(t.at(512,107,512)),'minecraft:air');
 assert.equal(t.blocks.get(t.at(512,108,512)),'minecraft:air');
});
test('deletion supports old registered bedrock when its chunk was not migrated yet',()=>{
 const t=setup();const g=addGen(t);t.blocks.set(t.at(512,107,512),'minecraft:bedrock');
 t.call(`eraseGeneratorWorldBlocks(world.getDimension('overworld'),${JSON.stringify(g)})`);
 assert.equal(t.blocks.get(t.at(512,107,512)),'minecraft:air');
});
test('deletion does not erase a foreign block placed in the output location',()=>{
 const t=setup();const g=addGen(t);t.blocks.set(t.at(512,107,512),'skygen:cobblestone_generator_core');
 t.blocks.set(t.at(512,108,512),'minecraft:diamond_block');t.call(`eraseGeneratorWorldBlocks(world.getDimension('overworld'),${JSON.stringify(g)})`);
 assert.equal(t.blocks.get(t.at(512,108,512)),'minecraft:diamond_block');
});
test('deletion refuses a mismatched base without modifying either block',()=>{
 const t=setup();const g=addGen(t);t.blocks.set(t.at(512,107,512),'skygen:diamond_generator_core');
 t.blocks.set(t.at(512,108,512),'minecraft:cobblestone');
 assert.throws(()=>t.call(`eraseGeneratorWorldBlocks(world.getDimension('overworld'),${JSON.stringify(g)})`),/mismatched/);
 assert.equal(t.blocks.get(t.at(512,107,512)),'skygen:diamond_generator_core');
 assert.equal(t.blocks.get(t.at(512,108,512)),'minecraft:cobblestone');
});
test('delete base failure restores expected output before reporting failure',()=>{
 const t=setup();const g=addGen(t);t.blocks.set(t.at(512,107,512),'skygen:cobblestone_generator_core');
 t.blocks.set(t.at(512,108,512),'minecraft:cobblestone');const old=t.dim.getBlock;
 t.dim.getBlock=function(p){const b=old(p);if(p.x===512&&p.y===107&&p.z===512)b.setType=()=>{throw Error('delete failure')};return b};
 assert.throws(()=>t.call(`eraseGeneratorWorldBlocks(world.getDimension('overworld'),${JSON.stringify(g)})`),/delete failure/);
 assert.equal(t.blocks.get(t.at(512,107,512)),'skygen:cobblestone_generator_core');
 assert.equal(t.blocks.get(t.at(512,108,512)),'minecraft:cobblestone');
});
test('delete output failure preserves existing registered generator core',()=>{
 const t=setup();const g=addGen(t);t.blocks.set(t.at(512,107,512),'skygen:cobblestone_generator_core');
 t.blocks.set(t.at(512,108,512),'minecraft:cobblestone');const old=t.dim.getBlock;
 t.dim.getBlock=function(p){const b=old(p);if(p.x===512&&p.y===108&&p.z===512)b.setType=()=>{throw Error('output delete failure')};return b};
 assert.throws(()=>t.call(`eraseGeneratorWorldBlocks(world.getDimension('overworld'),${JSON.stringify(g)})`),/output delete failure/);
 assert.equal(t.blocks.get(t.at(512,107,512)),'skygen:cobblestone_generator_core');
 assert.equal(t.blocks.get(t.at(512,108,512)),'minecraft:cobblestone');
});
console.log(`v0.9.4 generator block migration tests: ${n-failed} passed, ${failed} failed`);
if(failed)process.exitCode=1;
