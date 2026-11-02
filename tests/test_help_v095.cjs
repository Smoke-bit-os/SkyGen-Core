// v0.9.5 chat-help regression tests running a mocked Bedrock API.
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
function test(label,fn){n++;try{fn();console.log('PASS '+label)}catch(e){failed++;console.error('FAIL '+label,e.stack||e)}}
function fire(t,id,message='',actor=t.p){
 const before=actor?.messages.length||0;
 t.events.command({id,message,sourceEntity:actor,sourceType:'Entity'});
 t.advance(2);
 return (actor?.messages||[]).slice(before).join('\n');
}
function worldTest(){const t=setup();assert(!t.loadError,t.loadError?.stack);for(const x of [t.p,t.q])x.typeId='minecraft:player';return t}

test('help command is registered exactly once in scriptEventReceive allowlist',()=>{
 const s=src;
 assert(s.includes("'skygen:menu','skygen:help','skygen:adminaxe'"));
 assert(s.includes("if(e.id==='skygen:help')helpCommand(actor,e.message);"));
});
test('normal help lists player commands and points to operator help',()=>{
 const t=worldTest();const o=fire(t,'skygen:help');
 for(const id of ['skygen:help','skygen:menu','skygen:debug','skygen:adminaxe'])assert(o.includes(id),id);
 assert(o.includes('help admin'));
 assert(!o.includes('skygen:admin grant'));
});
test('generator help explains new custom cores without requiring purchase',()=>{
 const t=worldTest();const o=fire(t,'skygen:help','generators');
 assert(o.includes('custom core'));assert(o.includes('ABOVE'));assert(o.includes('My Generators'));
 assert.equal(t.props.size,0);assert.equal(t.p.data.size,0);
});
test('non-operator cannot read privileged help page',()=>{
 const t=worldTest();const o=fire(t,'skygen:help','admin');assert(o.includes('Operator permission required'));assert(!o.includes('tokenrestore'));
});
test('only operators get privileged help on all page',()=>{
 const t=worldTest();let o=fire(t,'skygen:help','all');assert(!o.includes('admin grant'));
 t.p.isOp=()=>true;o=fire(t,'skygen:help','all');
 for(const id of ['skygen:admin grant','skygen:admin revoke','skygen:security','skygen:marketreview','skygen:tokenrestore'])assert(o.includes(id),id);
});
test('operator help includes grant/revoke, review and token recovery example',()=>{
 const t=worldTest();t.p.isOp=()=>true;
 const o=fire(t,'skygen:help','admin');assert(o.includes('tokenrestore PlayerName | Cobblestone'));assert(o.includes('verify original purchase'));
 assert(o.includes('admin grant PlayerName')&&o.includes('admin revoke PlayerName'));
});
test('case insensitive extra whitespace support',()=>{
 const t=worldTest();t.p.isOp=()=>true;const o=fire(t,'skygen:help','  AdMiN  ');
 assert(o.includes('OPERATOR COMMANDS'));
});
test('admin help aliases to security only for operators',()=>{
 const t=worldTest();t.p.isOp=()=>true;let o=fire(t,'skygen:help','security');assert(o.includes('marketreview'));
 t.p.isOp=()=>false;o=fire(t,'skygen:help','security');assert(o.includes('Operator permission required'));
});
test('unknown help topic returns usage',()=>{
 const t=worldTest();const o=fire(t,'skygen:help','totally_unknown');assert(o.includes('Unknown help topic'));assert(o.includes('Usage:'));
});
test('player topic does not show operator info even when operator',()=>{
 const t=worldTest();t.p.isOp=()=>true;const o=fire(t,'skygen:help','player');assert(o.includes('SKYGEN COMMAND HELP'));assert(!o.includes('admin grant'));
});
test('existing command IDs are still dispatched through same listener',()=>{
 const t=worldTest();const o=fire(t,'skygen:debug');assert(o.includes('command handler active'));
 const o2=fire(t,'skygen:security');assert(o2.includes('Operator permission required'));
});
test('non-player command source is rejected without errors',()=>{
 const t=worldTest();t.events.command({id:'skygen:help',message:'admin',sourceEntity:undefined,sourceType:'Server'});t.advance(2);
 assert(!t.logs.some(x=>x.includes('SkyGen command error')));
});
test('help does not change world properties, inventories, or generator data',()=>{
 const t=worldTest();t.p.isOp=()=>true;
 fire(t,'skygen:help');fire(t,'skygen:help','generators');fire(t,'skygen:help','admin');
 assert.equal(t.props.size,0);assert.equal(t.p.inv.slots.filter(Boolean).length,0);assert.equal(t.p.data.size,0);
});
console.log(`SkyGen v0.9.5 command help tests: ${n-failed} passed, ${failed} failed`);
if(failed)process.exitCode=1;
