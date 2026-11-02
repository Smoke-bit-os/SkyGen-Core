// SkyGen Core v0.9.0 comprehensive mocked validation suite.
// This is a Node/vm simulation, NOT a Minecraft Xbox/Realm integration test.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(process.argv[2]||'/mnt/data/skygen_v082_working.js','utf8').replace(/^import .*?;\n/gm,'');
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
test('stable API startup survives missing beta before-place event',()=>{const t=setup({noBeforePlace:true});assert(!t.loadError);assert(t.events.spawn);assert(t.events.breakAfter);assert(t.events.interval);assert(t.events.interactBefore)});
test('protected block interactions are cancelled before execution',()=>{const t=setup({noBeforePlace:true});t.props.set('sg_plot_0','P');const ev={player:t.q,block:{location:{x:512,y:106,z:512}},cancel:false};t.events.interactBefore(ev);assert.equal(ev.cancel,true)});
test('visitors fail closed when interaction protection is unavailable',()=>{const t=setup({noInteract:true});assert(!t.loadError);t.props.set('sg_plot_0','P');t.props.set('sg_visitors_0',JSON.stringify(['Q']));assert.strictEqual(t.call('canVisit(q,0)'),false);assert.strictEqual(t.call('canVisit(p,0)'),true)});
test('all 289 island floor tiles are checked',()=>{const t=setup();for(const [dx,dz] of [[0,0],[8,0],[-8,0],[0,8],[0,-8],[8,8],[8,-8],[-8,8],[-8,-8]])t.blocks.set(t.at(512+dx,105,512+dz),'minecraft:stone');assert.strictEqual(t.call('plotFloorReady(0)'),false)});
test('island builder fills holes but preserves player-built blocks',()=>{const t=setup();t.blocks.set(t.at(513,105,512),'minecraft:gold_block');assert.strictEqual(t.call('buildPlotInLoadedChunk(0)'),true);assert.equal(t.blocks.get(t.at(513,105,512)),'minecraft:gold_block');assert.equal(t.blocks.get(t.at(514,105,512)),'minecraft:grass_block');assert(t.commands.every(s=>!s.startsWith('fill')||s.endsWith(' keep')))});
test('spawn construction never deletes player structures and becomes idempotent',()=>{const t=setup();t.blocks.set(t.at(4,2,4),'minecraft:diamond_block');const a=t.call('ensureSpawn()');assert(a);t.call('ensureSpawn()');assert.equal(t.blocks.get(t.at(4,2,4)),'minecraft:diamond_block');assert(!t.commands.some(s=>s.includes(' air')));assert.equal(t.commands.filter(s=>s.startsWith('fill')).length,1)});
test('unloaded spawn cancels rescue instead of blind teleport',()=>{const t=setup({unloaded:true,failFill:true});t.call('safeSpawnTravel(p,true)');t.advance(280);assert.equal(t.p.teleports.length,0);assert(t.p.messages.some(s=>s.includes('could not be verified')));assert.equal(t.areas.size,0)});
test('startup removes stale SkyGen plot ticking areas only',()=>{const t=setup();t.props.set('sg_active_plot_areas_v1',JSON.stringify(['sg_p42']));t.areas.set('sg_p42',true);t.areas.set('my_farm',true);t.advance(25);assert.equal(t.areas.has('sg_p42'),false);assert.equal(t.areas.has('my_farm'),true)});
test('spawn rescue still runs when player profile claim fails',()=>{const t=setup();t.p.data.set('sg_profile','{corrupt');t.events.spawn({player:t.p,initialSpawn:true});t.advance(80);assert.equal(t.p.teleports.length,1);assert.equal(t.p.location.y,1)});
test('new plot assignment persists unique index and owner',()=>{const t=setup();t.call('claim(p)');assert.equal(t.props.get('sg_next_plot'),1);assert.equal(t.props.get('sg_plot_0'),'P');assert.equal(JSON.parse(t.p.data.get('sg_profile')).plot,0)});
test('corrupt player profile fails closed without resetting wallet',()=>{const t=setup();t.p.data.set('sg_profile','{corrupt');assert.throws(()=>t.call('profile(p)'),/corrupt/i);assert.equal(t.p.data.get('sg_profile'),'{corrupt')});
test('valid generator registry saves and verifies correctly',()=>{const t=setup();t.call('genLoad()');t.call('generators.set("G",{type:"Cobblestone",owner:"P",x:512,y:106,z:512})');assert.strictEqual(t.call('genSave()'),true);assert.equal(JSON.parse(t.props.get('sg_generators_v2_commit')).records,1);assert.equal(t.call('generatorRead().length'),1)});
test('corrupt legacy generator registry refuses to overwrite saved data',()=>{const t=setup();t.props.set('sg_generators','{corrupt');t.call('genLoad()');t.call('generators.set("G",{type:"Cobblestone",owner:"P",x:512,y:106,z:512})');assert.strictEqual(t.call('genSave()'),false);assert.equal(t.props.get('sg_generators'),'{corrupt')});
test('generator record 501 migrates safely without truncation',()=>{const t=setup();t.props.set('sg_generators','[]');t.call('genLoad()');t.call('for(let k=0;k<501;k++)generators.set("G"+k,{type:"Cobblestone",x:k,y:107,z:512,owner:"P"})');assert.strictEqual(t.call('genSave()'),true);assert.equal(t.props.get('sg_generators'),'[]');assert.equal(t.call('generatorRead().length'),501)});
test('generator persistence failures propagate false',()=>{const t=setup({throwSaveKey:'sg_generators_v2_commit'});t.call('genLoad()');t.call('generators.set("G",{type:"Cobblestone",owner:"P",x:512,y:106,z:512})');assert.strictEqual(t.call('genSave()'),false)});
test('generator registration is not truncated when loaded from legacy data',()=>{const t=setup();const records=Array.from({length:501},(_,i)=>['G'+i,{type:'Cobblestone',owner:'P',x:i,y:107,z:512}]);t.props.set('sg_generators',JSON.stringify(records));t.call('genLoad()');assert.equal(t.call('generators.size'),501)});
test('marketplace rejects complex enchanted/durable items from new listings',()=>{const t=setup();const plain=new Stack('minecraft:diamond',3),sword=new Stack('minecraft:diamond_sword',1);t.p.inv.setItem(0,plain);assert.strictEqual(t.call('marketPlain(inventory(p).getItem(0))'),true);t.p.inv.setItem(1,sword);assert.strictEqual(t.call('marketPlain(inventory(p).getItem(1))'),false);const labeled=new Stack('minecraft:diamond',1);labeled.nameTag='Fancy';t.p.inv.setItem(2,labeled);assert.strictEqual(t.call('marketPlain(inventory(p).getItem(2))'),false)});
test('interrupted market reservations become review-only, not reopened',()=>{const t=setup();t.props.set('sg_market_v1',JSON.stringify([{id:'L',seller:'P',type:'minecraft:diamond',count:1,price:500,status:'reserved',buyer:'Q'}]));t.call('marketRecover()');const arr=JSON.parse(t.props.get('sg_market_v1'));assert.equal(arr[0].status,'review');assert.equal(arr[0].buyer,'Q')});
test('legacy unsupported listings are quarantined and preserved',()=>{const t=setup();t.props.set('sg_market_v1',JSON.stringify([{id:'OLD',seller:'P',type:'minecraft:diamond_sword',count:1,price:500,status:'active'}]));t.call('marketRecover()');const arr=JSON.parse(t.props.get('sg_market_v1'));assert.equal(arr.length,1);assert.equal(arr[0].status,'review')});
test('market recovery preserves legitimate active commodity listings',()=>{const t=setup();const raw=JSON.stringify([{id:'L',seller:'P',type:'minecraft:diamond',count:1,price:500,status:'active'}]);t.props.set('sg_market_v1',raw);t.call('marketRecover()');assert.equal(t.props.get('sg_market_v1'),raw)});
test('trade swap succeeds with fully occupied inventories',()=>{const t=setup();for(let i=0;i<t.p.inv.size;i++){t.p.inv.setItem(i,new Stack('minecraft:stone',64));t.q.inv.setItem(i,new Stack('minecraft:dirt',64))}const a=new Stack('minecraft:diamond',1),b=new Stack('minecraft:emerald',1);a.magic=7;b.magic=9;t.p.inv.setItem(0,a);t.q.inv.setItem(0,b);t.call('const tx={a:"P",b:"Q",aSlot:0,bSlot:0,aType:"minecraft:diamond",bType:"minecraft:emerald",aCount:1,bCount:1,created:0,closed:false};trades.set("P",tx);trades.set("Q",tx);tradeExecute(p,q,tx)');assert.equal(t.p.inv.getItem(0).typeId,'minecraft:emerald');assert.equal(t.q.inv.getItem(0).typeId,'minecraft:diamond');assert.equal(t.p.inv.getItem(0).magic,9);assert.equal(t.q.inv.getItem(0).magic,7)});
test('failed atomic trade swap leaves both original items unchanged',()=>{const t=setup();t.p.inv.setItem(0,new Stack('minecraft:diamond',1));t.q.inv.setItem(0,new Stack('minecraft:emerald',1));t.q.inv.failSwap=true;t.call('const tx={a:"P",b:"Q",aSlot:0,bSlot:0,aType:"minecraft:diamond",bType:"minecraft:emerald",aCount:1,bCount:1,created:0,closed:false};trades.set("P",tx);trades.set("Q",tx);tradeExecute(p,q,tx)');assert.equal(t.p.inv.getItem(0).typeId,'minecraft:diamond');assert.equal(t.q.inv.getItem(0).typeId,'minecraft:emerald')});
test('Orbit exchange rate and original menu options retained',()=>{const t=setup();assert.equal(t.call('C.exchange'),18000000);assert(src.includes("['My Plot','Visit Other Plots','Generators','Server Shop','Player Marketplace','Player Trading','Ranks','Wallet / Exchange','Teleport','Skill Tree','Daily Quests','Help']"));assert(src.includes('How many Orbits do you want?'))});
test('plot protection and XP never apply at matching Nether coordinates',()=>{const t=setup();t.p.dimension={id:'minecraft:nether'};t.props.set('sg_plot_0','Q');assert.strictEqual(t.call('protectedAt(p,512,512)'),false);assert.strictEqual(t.call('belongs(p,512,512)'),false)});
test('corrupted market storage refuses to be overwritten',()=>{const t=setup();t.props.set('sg_market_v1','{corrupt');assert.throws(()=>t.call('marketRead()'),/corrupt/i);t.call('try{marketRecover()}catch(e){}');assert.equal(t.props.get('sg_market_v1'),'{corrupt');});
test('plot starter floor break is denied before block removed',()=>{const t=setup();t.props.set('sg_plot_0','P');const event={block:{location:{x:512,y:105,z:512}},player:t.p,cancel:false};t.events.breakBefore(event);assert.strictEqual(event.cancel,true)});
console.log(`Completed ${n} regression tests: ${n-failed} passed, ${failed} failed`);if(failed)process.exitCode=1;
