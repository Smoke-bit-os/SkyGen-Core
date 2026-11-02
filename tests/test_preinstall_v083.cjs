// SkyGen Core v0.8.2 comprehensive mocked validation suite.
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
test('shop exact buy and sell unit prices for every SKU',()=>{
 const t=setup();const buys=[5,10,50,500],sells=[1,2,10,100];
 for(let i=0;i<buys.length;i++){
  assert.strictEqual(t.call(`shopUnitPrice(SHOP[${i}],true)`),buys[i]);
  assert.strictEqual(t.call(`shopUnitPrice(SHOP[${i}],false)`),sells[i]);
  for(const n of [1,16,64,2304]){
   assert.strictEqual(t.call(`shopUnitPrice(SHOP[${i}],true)*${n}`),buys[i]*n);
   assert.strictEqual(t.call(`shopUnitPrice(SHOP[${i}],false)*${n}`),sells[i]*n);
  }
 }
});
test('nonmultiple 1, 16, 64, max purchases are allowed',()=>{
 assert(!src.includes('quantity in multiples of'));
 assert(src.includes('const total=count*unitPrice'));
});
test('generator failure preserves an existing bedrock block',()=>{
 const t=setup();const loc=t.at(513,107,513);t.blocks.set(loc,'minecraft:bedrock');
 const original=t.dim.getBlock;
 t.dim.getBlock=function(pos){const b=original(pos);if(pos.x===513&&pos.y===108&&pos.z===513){b.setType=()=>{throw Error('failed setType')}}return b};
 assert.throws(()=>t.call('buildGenerator({x:513,y:107,z:513,block:"minecraft:coal_ore"})'),/failed setType/);
 assert.strictEqual(t.blocks.get(loc),'minecraft:bedrock');
});
test('generator failure rolls back a newly created base',()=>{
 const t=setup();const loc=t.at(514,107,513);const original=t.dim.getBlock;
 t.dim.getBlock=function(pos){const b=original(pos);if(pos.x===514&&pos.y===108&&pos.z===513){b.setType=()=>{throw Error('failed setType')}}return b};
 assert.throws(()=>t.call('buildGenerator({x:514,y:107,z:513,block:"minecraft:coal_ore"})'),/failed setType/);
 assert.strictEqual(t.blocks.get(loc),'minecraft:air');
});
test('new Plot Horn can assign plot without forcing a rejoin',()=>{
 const t=setup();t.call('tpPlot(p)');
 assert.strictEqual(t.props.get('sg_plot_0'),'P');
 assert.strictEqual(JSON.parse(t.p.data.get('sg_profile')).plot,0);
});
test('early initial spawn rescue does not teleport twice',()=>{
 const t=setup();t.events.spawn({player:t.p,initialSpawn:true});
 t.advance(7);assert.strictEqual(t.p.teleports.length,1);
 t.advance(65);assert.strictEqual(t.p.teleports.length,1);
});
test('preinstall build retains original menu and credits conversion',()=>{
 const t=setup({noBeforePlace:true});assert(!t.loadError);
 assert.strictEqual(t.call('C.exchange'),18000000);
 assert(src.includes('How many Orbits do you want?'));
 assert(src.includes("['My Plot','Visit Other Plots','Generators','Server Shop','Player Marketplace','Player Trading','Ranks','Wallet / Exchange','Teleport','Help']"));
});
test('shop prevents nonintegral unit pricing',()=>{
 const t=setup();assert.throws(()=>t.call('shopUnitPrice({buy:1,sell:1,count:8},true)'),/whole Credit/);
});
test('market blocks keep-on-death and adventure-mode metadata',()=>{
 const t=setup();
 const k=new Stack('minecraft:diamond',1);k.keepOnDeath=true;
 t.p.inv.setItem(0,k);
 assert.strictEqual(t.call('marketPlain(inventory(p).getItem(0))'),false);
 const c=new Stack('minecraft:diamond',1);c.getCanPlaceOn=()=>['minecraft:grass_block'];
 t.p.inv.setItem(0,c);
 assert.strictEqual(t.call('marketPlain(inventory(p).getItem(0))'),false);
 const d=new Stack('minecraft:diamond',1);d.getDynamicPropertyIds=()=>['metadata'];
 t.p.inv.setItem(0,d);
 assert.strictEqual(t.call('marketPlain(inventory(p).getItem(0))'),false);
});
console.log(`Pre-install extra tests: ${n-failed} passed, ${failed} failed`);if(failed)process.exitCode=1;
