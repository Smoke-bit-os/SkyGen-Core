const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(process.argv[2] || './source/behavior_pack/scripts/main.js','utf8').replace(/^import .*?;\n/gm,'');
function setup({failArea=false,chunkNeverLoads=false,existingFloor=false,blockedCenter=false}={}){
 const blocks=new Map(),areas=new Map(),props=new Map(),jobs=[];let next=0;const subscriptions={};
 const key=(x,y,z)=>`${x},${y},${z}`;
 const spawn={x:0.5,y:2,z:0.5};
 const world={
  getDynamicProperty:(key)=>props.get(key),setDynamicProperty:(key,v)=>props.set(key,v),
  getDimension:()=>dim,getAllPlayers:()=>[p],
  beforeEvents:{playerBreakBlock:{subscribe:()=>{}},playerPlaceBlock:{subscribe:()=>{}},playerInteractWithBlock:{subscribe:()=>{}}},
  afterEvents:{playerSpawn:{subscribe:f=>subscriptions.spawn=f},itemUse:{subscribe:f=>subscriptions.itemUse=f},playerBreakBlock:{subscribe:()=>{}}}
 };
 const dim={id:'minecraft:overworld',
  getBlock:({x,y,z})=>{
   if(chunkNeverLoads||![...areas.values()].some(a=>Math.abs(a.x-x)<=32&&Math.abs(a.z-z)<=32))return undefined;
   const typeId=blocks.get(key(x,y,z))||'minecraft:air';
   return {typeId,isAir:typeId==='minecraft:air',setType(t){blocks.set(key(x,y,z),t)}};
  },
  runCommand(cmd){
   if(cmd.startsWith('tickingarea add circle ')){
    if(failArea)throw Error('No ticking area permission');
    const m=/tickingarea add circle (\d+) (\d+) (\d+) (\d+) (\S+) (true|false)/.exec(cmd); assert(m,cmd);
    areas.set(m[5],{x:Number(m[1]),z:Number(m[3])});return {successCount:1};
   }
   if(cmd.startsWith('tickingarea remove ')){
    const name=cmd.split(' ').at(-1);if(!areas.has(name))throw Error('No ticking area');areas.delete(name);return {successCount:1};
   }
   if(cmd.startsWith('fill ')){
    const m=/fill (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (\S+) keep/.exec(cmd); assert(m,cmd);
    const [,x1,y1,z1,x2,y2,z2,type]=m;
    if(areas.size===0)throw Error('Chunk unloaded');
    for(let x=+x1;x<=+x2;x++)for(let y=+y1;y<=+y2;y++)for(let z=+z1;z<=+z2;z++)if(!blocks.has(key(x,y,z)))blocks.set(key(x,y,z),type);
    return {successCount:1};
   }
   if(cmd.startsWith('setworldspawn'))return {successCount:1};
   throw Error('Unhandled command: '+cmd);
  }
 };
 const p={id:'playerA',name:'TestPlayer',isValid:true,dimension:dim,location:{...spawn},messages:[],teleports:[],
   data:new Map(),onScreenDisplay:{setTitle:()=>{},setActionBar:()=>{}},sendMessage(x){this.messages.push(x)},
   getDynamicProperty(k){return this.data.get(k)},setDynamicProperty(k,v){this.data.set(k,v)},
   getComponent(){return null},
   teleport(to){this.teleports.push({to,withArea:areas.size>0});this.location={...to}},
   tryTeleport(to){if(areas.size===0)return false;this.teleports.push({to,withArea:true});this.location={...to};return true}
 };
 const system={currentTick:0,afterEvents:{scriptEventReceive:{subscribe:()=>{}}},
  runTimeout(fn,t=1){jobs.push({at:system.currentTick+Math.max(t,1),fn,id:next++})},runInterval:()=>{},run:fn=>system.runTimeout(fn,1)
 };
 const context=vm.createContext({world,system,ItemStack:function(){},ItemLockMode:{none:0,slot:1},ActionFormData:function(){},ModalFormData:function(){},MessageFormData:function(){},console:{warn:()=>{},log:()=>{}}});
 vm.runInContext(code,context);
 function advance(n){for(let i=0;i<n;i++){system.currentTick++;let due=jobs.filter(x=>x.at<=system.currentTick).sort((a,b)=>a.id-b.id);for(const j of due){jobs.splice(jobs.indexOf(j),1);j.fn()}}}
 function call(expr){context.p=p;return vm.runInContext(expr,context)}
 if(existingFloor)for(let x=504;x<=520;x++)for(let z=504;z<=520;z++){blocks.set(key(x,103,z),'minecraft:dirt');blocks.set(key(x,104,z),'minecraft:dirt');blocks.set(key(x,105,z),'minecraft:grass_block')}
 if(blockedCenter){blocks.set(key(512,106,512),'minecraft:stone');blocks.set(key(512,107,512),'minecraft:stone')}
 return {p,areas,blocks,props,world,system,call,advance,key};
}
function test(label,fn){try{fn();console.log('PASS '+label)}catch(e){console.error('FAIL '+label,e);process.exitCode=1}}
test('new player auto-generates starter island without teleporting',()=>{
 const t=setup();t.call('claim(p)');t.advance(200);
 assert.equal(t.p.teleports.length,0);assert.equal(t.blocks.get(t.key(512,105,512)),'minecraft:grass_block');
 assert.equal(t.blocks.get(t.key(520,105,520)),'minecraft:grass_block');assert.equal(t.areas.size,0);
 t.call('tpPlot(p)');t.advance(200);
 assert.equal(t.p.teleports.length,1);assert.equal(t.p.teleports[0].withArea,true);assert.equal(t.p.location.y,107);assert.equal(t.areas.size,0);
});
test('existing plot, unloaded chunk: one-click load then teleport',()=>{
 const t=setup({existingFloor:true});t.call('claim(p)');t.advance(200);t.call('tpPlot(p)');t.advance(200);
 assert.equal(t.p.teleports.length,1);assert.equal(t.p.teleports[0].withArea,true);assert.equal(t.p.location.x,512.5);
});
test('early plot horn upgrades in-progress generation and teleports',()=>{
 const t=setup();t.call('claim(p)');t.advance(12);t.call('tpPlot(p)');t.advance(200);
 assert.equal(t.p.teleports.length,1);
});
test('moving during countdown cancels safely, loader cleaned',()=>{
 const t=setup();t.call('claim(p)');t.advance(200);t.call('tpPlot(p)');t.advance(30);
 t.p.location.x+=1;t.advance(160);
 assert.equal(t.p.teleports.length,0);assert.equal(t.areas.size,0);
 assert(t.p.messages.some(x=>x.includes('cancelled: you moved')));
});
test('tickingarea denied: no plot teleport and useful failure',()=>{
 const t=setup({failArea:true});t.call('claim(p)');t.advance(200);t.call('tpPlot(p)');t.advance(200);
 assert.equal(t.p.teleports.length,0);assert.equal(t.areas.size,0);
 assert(t.p.messages.some(x=>x.includes('Check that cheats are enabled')));
});
test('chunks never load: safely times out without teleport',()=>{
 const t=setup({chunkNeverLoads:true});t.call('claim(p)');t.advance(600);t.call('tpPlot(p)');t.advance(600);
 assert.equal(t.p.teleports.length,0);assert.equal(t.areas.size,0);
 assert(t.p.messages.some(x=>x.includes('No teleport attempted')));
});
test('blocked plot center: teleport lands at a clear alternate position',()=>{
 const t=setup({blockedCenter:true});t.call('claim(p)');t.advance(200);t.call('tpPlot(p)');t.advance(200);
 assert.equal(t.p.teleports.length,1);assert.notEqual(t.p.location.x,512.5);
 assert.equal(t.blocks.get(t.key(512,106,512)),'minecraft:stone');
});
test('stale pre-existing tickingarea name is cleaned before add',()=>{
 const t=setup();t.areas.set('sg_p0',{x:512,z:512});t.call('claim(p)');t.advance(200);assert.equal(t.areas.size,0);
});
test('repeated horn does not open concurrent countdowns or consume slots',()=>{
 const t=setup();t.call('claim(p)');t.advance(200);t.call('tpPlot(p)');t.call('tpPlot(p)');t.advance(200);assert.equal(t.p.teleports.length,1);assert.equal(t.areas.size,0);
});
