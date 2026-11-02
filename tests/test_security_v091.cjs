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
function owned(t){t.call('genLoad()');t.props.set('sg_plot_0','P');t.p.location={x:512.5,y:106,z:512.5};t.p.data.set('sg_profile',JSON.stringify({credits:50000,orbits:0,xp:1000,rank:50,plot:0}));}
function purchase(t,name='Cobblestone'){
 owned(t);t.call(`issueGeneratorToken(p,GENS.find(g=>g.name===${JSON.stringify(name)}),500)`);
 const item=t.p.inv.getItem(0);assert(item,'token not issued');return {item,id:item.getDynamicProperty('sg_token_id')};
}
test('token use guard registers and cancels vanilla egg throw',()=>{
 const t=setup();assert(!t.loadError);assert(t.events.itemUseBefore);assert.equal(t.call('generatorTokenUseGuardReady'),true);
 const i=new Stack('minecraft:egg');i.nameTag='§bSkyGen Cobblestone Generator';const e={source:t.p,itemStack:i,cancel:false};t.events.itemUseBefore(e);assert(e.cancel);
});
test('forged display-name-only egg cannot create generators',()=>{
 const t=setup();owned(t);const i=new Stack('minecraft:egg');i.nameTag='§bSkyGen Cobblestone Generator';t.p.inv.setItem(0,i);
 const e={source:t.p,itemStack:i,cancel:false};t.events.itemUseBefore(e);t.advance(1);
 assert(e.cancel);assert.equal(t.call('generators.size'),0);assert.equal(t.p.inv.getItem(0).typeId,'minecraft:egg');
});
test('server issuance decrements wallet and attaches unique identity',()=>{
 const t=setup(),{item,id}=purchase(t);assert(/^[1-9]\d*$/.test(id));assert.equal(JSON.parse(t.p.data.get('sg_profile')).credits,49500);
 assert.equal(t.call(`tokenRead('${id}').status`),'issued');assert.equal(item.amount,1);
});
test('valid generator token is consumed before generator and record are granted',()=>{
 const t=setup(),{item,id}=purchase(t);const e={source:t.p,itemStack:item};t.events.customItems['skygen:generator_token_use'].onUse(e);t.advance(1);
assert.equal(t.p.inv.getItem(0),undefined);assert.equal(t.call('generators.size'),1);assert.equal(t.call(`tokenRead('${id}').status`),'spent');
 assert.equal(t.blocks.get(t.at(512,107,512)),'skygen:cobblestone_generator_core');
});
test('a spent or duplicated token cannot register a second generator',()=>{
 const t=setup(),{item,id}=purchase(t);t.call(`placeGeneratorToken(p,0,'${id}')`);assert.equal(t.call('generators.size'),1);
 t.p.inv.setItem(0,item.clone());t.call(`placeGeneratorToken(p,0,'${id}')`);assert.equal(t.call('generators.size'),1);
});
test('changing the selected slot to empty does not grant a free generator',()=>{
 const t=setup(),{id}=purchase(t);t.p.inv.setItem(0,undefined);t.call(`placeGeneratorToken(p,0,'${id}')`);
 assert.equal(t.call('generators.size'),0);assert.equal(t.call(`tokenRead('${id}').status`),'issued');
});
test('failed registry commit never deletes preexisting bedrock base',()=>{
 const t=setup(),{id}=purchase(t);t.blocks.set(t.at(512,107,512),'minecraft:bedrock');
 const old=t.world.setDynamicProperty;t.world.setDynamicProperty=(k,v)=>{if(k==='sg_generators_v2_commit')throw Error('registry failure');return old(k,v)};
 t.call(`placeGeneratorToken(p,0,'${id}')`);
 assert.equal(t.blocks.get(t.at(512,107,512)),'minecraft:bedrock');assert.equal(t.blocks.get(t.at(512,108,512))||'minecraft:air','minecraft:air');
 assert.equal(t.call('generators.size'),0);assert.equal(t.call(`tokenRead('${id}').status`),'issued');
});
test('failed registry commit removes only newly created bedrock',()=>{
 const t=setup(),{id}=purchase(t);const old=t.world.setDynamicProperty;t.world.setDynamicProperty=(k,v)=>{if(k==='sg_generators_v2_commit')throw Error('registry failure');return old(k,v)};
 t.call(`placeGeneratorToken(p,0,'${id}')`);
 assert.equal(t.blocks.get(t.at(512,107,512)),'minecraft:air');assert.equal(t.call('generators.size'),0);
});
test('payout applied marker prevents duplicate credit after queue-clear failure',()=>{
 const t=setup();t.props.set('sg_proceeds_v2_P',JSON.stringify([{id:'L1',seq:1,price:5000}]));t.props.set('sg_proceeds_seq_P',1);
 const old=t.world.setDynamicProperty;t.world.setDynamicProperty=(k,v)=>{if(k==='sg_proceeds_v2_P'&&v==='[]')throw Error('simulated failed payout clear');return old(k,v)};
 t.call('try{settleSellerProceeds(p,profile(p))}catch(e){}');assert.equal(JSON.parse(t.p.data.get('sg_profile')).credits,6000);
 t.call('try{settleSellerProceeds(p,profile(p))}catch(e){}');assert.equal(JSON.parse(t.p.data.get('sg_profile')).credits,6000);
});
test('legacy payout marker prevents duplicate credits after legacy clear failure',()=>{
 const t=setup();t.props.set('sg_proceeds_P',5000);const old=t.world.setDynamicProperty;
 t.world.setDynamicProperty=(k,v)=>{if(k==='sg_proceeds_P'&&v===0)throw Error('failed clear');return old(k,v)};
 t.call('try{settleSellerProceeds(p,profile(p))}catch(e){}');
 t.call('try{settleSellerProceeds(p,profile(p))}catch(e){}');
 assert.equal(JSON.parse(t.p.data.get('sg_profile')).credits,6000);
});
test('queueing an identical seller listing twice is idempotent',()=>{
 const t=setup();t.call('queueSellerPayout("P","listing1",250)');t.call('queueSellerPayout("P","listing1",250)');
 assert.equal(JSON.parse(t.props.get('sg_proceeds_v2_P')).length,1);
});
test('payout queues credit multiple unique listings exactly once',()=>{
 const t=setup();t.call('queueSellerPayout("P","L1",300)');t.call('queueSellerPayout("P","L2",700)');
 t.call('settleSellerProceeds(p,profile(p))');t.call('settleSellerProceeds(p,profile(p))');
 assert.equal(JSON.parse(t.p.data.get('sg_profile')).credits,2000);
});
test('atomic cross-player trade swaps complete without double writes',()=>{
 const t=setup();t.p.inv.setItem(0,new Stack('minecraft:diamond',1));t.q.inv.setItem(0,new Stack('minecraft:emerald',1));
 t.call('const tx={a:"P",b:"Q",aSlot:0,bSlot:0,aType:"minecraft:diamond",bType:"minecraft:emerald",aCount:1,bCount:1,created:0,closed:false};trades.set("P",tx);trades.set("Q",tx);tradeExecute(p,q,tx)');
 assert.equal(t.p.inv.getItem(0).typeId,'minecraft:emerald');assert.equal(t.q.inv.getItem(0).typeId,'minecraft:diamond');
});
test('failed atomic trade swap leaves items intact and saves a review record',()=>{
 const t=setup();t.p.inv.setItem(0,new Stack('minecraft:diamond',1));t.q.inv.setItem(0,new Stack('minecraft:emerald',1));t.q.inv.failSwap=true;
 t.call('const tx={id:"TRADE",a:"P",b:"Q",aSlot:0,bSlot:0,aType:"minecraft:diamond",bType:"minecraft:emerald",aCount:1,bCount:1,created:0,closed:false};trades.set("P",tx);trades.set("Q",tx);tradeExecute(p,q,tx)');
 assert.equal(t.p.inv.getItem(0).typeId,'minecraft:diamond');assert.equal(t.q.inv.getItem(0).typeId,'minecraft:emerald');assert(t.props.has('sg_trade_review_TRADE'));
});
test('protected-plot TNT explosions are cancelled even if initiated outside',()=>{
 const t=setup();assert(t.events.explosionBefore);const e={dimension:t.dim,cancel:false,getImpactedBlocks(){return[{location:{x:512,y:107,z:512}},{location:{x:500,y:107,z:500}}]}};
 t.events.explosionBefore(e);assert(e.cancel);
});
test('ordinary explosions outside protected regions stay enabled',()=>{
 const t=setup();const e={dimension:t.dim,cancel:false,getImpactedBlocks(){return[{location:{x:55,y:50,z:55}}]}};t.events.explosionBefore(e);assert(!e.cancel);
});
test('generator XP is only awarded when a script-generated output is ready',()=>{
 const t=setup();owned(t);t.call('generators.set("512,107,512",{type:"Coal",owner:"P",x:512,y:107,z:512,block:"minecraft:coal_ore"})');
 t.system.currentTick=100;
 t.events.breakAfter({player:t.p,block:{location:{x:512,y:108,z:512}},brokenBlockPermutation:{type:{id:'minecraft:coal_ore'}}});
 assert.equal(JSON.parse(t.p.data.get('sg_profile')).xp,1001);
 t.call('generatorOutputReady.add("512,107,512")');t.system.currentTick=110;
 t.events.breakAfter({player:t.p,block:{location:{x:512,y:108,z:512}},brokenBlockPermutation:{type:{id:'minecraft:coal_ore'}}});
 assert.equal(JSON.parse(t.p.data.get('sg_profile')).xp,1006);
});
test('manual output placement invalidates pending generator harvest XP',()=>{
 const t=setup();owned(t);t.call('generatorOutputReady.add("512,107,512")');t.events.placeAfter({player:t.p,block:{location:{x:512,y:108,z:512}}});
 assert.equal(t.call('generatorOutputReady.size'),0);
});
test('claim journal repairs profile save failure without allocating a second plot',()=>{
 const t=setup();const old=t.p.setDynamicProperty;t.p.setDynamicProperty=function(k,v){if(k==='sg_profile')throw Error('failed profile save');return old.call(this,k,v)};
 assert.throws(()=>t.call('claim(p)'));
 assert.equal(t.props.get('sg_next_plot'),1);assert.equal(t.props.get('sg_claim_reserve_P'),0);assert.equal(t.props.get('sg_plot_0'),'P');
 t.p.setDynamicProperty=old;t.call('claim(p)');assert.equal(t.props.get('sg_next_plot'),1);assert.equal(JSON.parse(t.p.data.get('sg_profile')).plot,0);
});
test('Ocean Runner uses Bedrock supported Speed instead of dolphins grace',()=>{
 const t=setup();assert(!src.includes('minecraft:dolphins_grace'));assert(src.includes("['explore_dolphin','minecraft:speed',0]"));
});
test('operator-only security diagnostics do not expose admin to ordinary players',()=>{
 const t=setup();t.call('securityReviewCommand(p)');assert(t.p.messages.some(x=>x.includes('Operator permission')));
});
test('buying a token with a full inventory does not charge Credits',()=>{
 const t=setup();owned(t);for(let i=0;i<t.p.inv.size;i++)t.p.inv.setItem(i,new Stack('minecraft:dirt',64));
 t.call('issueGeneratorToken(p,GENS[0],500)');
 assert.equal(JSON.parse(t.p.data.get('sg_profile')).credits,50000);
 assert.equal(t.props.get('sg_token_seq'),undefined);
});
test('issuing two tokens creates distinct server ledger records',()=>{
 const t=setup();owned(t);t.call('issueGeneratorToken(p,GENS[0],500)');t.call('issueGeneratorToken(p,GENS[0],500)');
 assert.equal(t.p.inv.getItem(0).getDynamicProperty('sg_token_id'),'1');
 assert.equal(t.p.inv.getItem(1).getDynamicProperty('sg_token_id'),'2');
 assert.equal(t.props.get('sg_token_seq'),2);
});
test('attempting to redeem a token from another player is rejected',()=>{
 const t=setup(),{item,id}=purchase(t);t.q.inv.setItem(0,item.clone());t.call(`placeGeneratorToken(q,0,'${id}')`);
 assert.equal(t.call('generators.size'),0);assert.equal(t.call(`tokenRead('${id}').status`),'issued');
});
test('an explosion filtering error fails closed',()=>{
 const t=setup();const e={dimension:t.dim,cancel:false,getImpactedBlocks(){throw Error('unloaded chunk')}};
 t.events.explosionBefore(e);assert.equal(e.cancel,true);
});
test('XP for ordinary blocks is limited to ten per one-minute window',()=>{
 const t=setup();owned(t);t.system.currentTick=100;
 for(let i=0;i<30;i++){t.system.currentTick+=5;t.events.breakAfter({player:t.p,block:{location:{x:513,y:108,z:513}},brokenBlockPermutation:{type:{id:'minecraft:dirt'}}})}
 assert.equal(JSON.parse(t.p.data.get('sg_profile')).xp,1010);
});
test('operator restoration requires permission and does not charge player Credits',()=>{
 const t=setup();owned(t);t.p.isOp=()=>true;
 t.call('adminTokenRestore(p,"Guest | Cobblestone")');
 assert.equal(t.props.get('sg_token_seq'),1);
 assert.equal(t.q.inv.getItem(0).getDynamicProperty('sg_token_id'),'1');
 assert.equal(JSON.parse(t.p.data.get('sg_profile')).credits,50000);
});
test('ordinary player cannot issue restoration tokens',()=>{
 const t=setup();owned(t);t.call('adminTokenRestore(p,"Guest | Cobblestone")');
 assert.equal(t.props.get('sg_token_seq'),undefined);
});
test('payout queue failure does not silently add seller Credits',()=>{
 const t=setup();const old=t.world.setDynamicProperty;t.world.setDynamicProperty=(k,v)=>{if(k==='sg_proceeds_v2_P')throw Error('queue write failed');return old(k,v)};
 assert.throws(()=>t.call('queueSellerPayout("P","L1",250)'));
 assert.equal(t.p.data.get('sg_profile'),undefined);
});
test('claim reservation fault does not assign the same plot to another player',()=>{
 const t=setup();const old=t.world.setDynamicProperty;
 t.world.setDynamicProperty=(k,v)=>{if(k==='sg_next_plot')throw Error('next index failed');return old(k,v)};
 assert.throws(()=>t.call('claim(p)'));
 assert.equal(t.props.get('sg_plot_0'),'P');
 assert.throws(()=>t.call('claim(q)'));
});
test('a stronger existing potion effect is never reduced by a skill pulse',()=>{
 const t=setup();owned(t);const d=JSON.parse(t.p.data.get('sg_profile'));d.skills=['move_speed_1'];t.p.data.set('sg_profile',JSON.stringify(d));
 t.p.getEffect=()=>({amplifier:2,duration:300});t.p.addEffect=()=>{throw Error('Should not overwrite higher amplifier')};
 t.call('skillPulse()');assert(!t.logs.some(x=>x.includes('Should not overwrite')));
});

test('Bedrock stackable eggs reject item identity and the new non-stackable token succeeds',()=>{
 const t=setup();owned(t);
 const egg=new Stack('minecraft:egg');assert.throws(()=>egg.setDynamicProperty('sg_token_id','123'),/UnsupportedFunctionalityError/);
 t.call("issueGeneratorToken(p,GENS.find(g=>g.name==='Cobblestone'),500)");
 const token=t.p.inv.getItem(0);assert(token);assert.equal(token.typeId,'skygen:generator_cobblestone');assert.equal(token.maxAmount,1);
 assert(/^[1-9]\d*$/.test(token.getDynamicProperty('sg_token_id')));
 assert.equal(JSON.parse(t.p.data.get('sg_profile')).credits,49500);
});
test('ordinary teleport horns are ignored by the generator redemption guard',()=>{
 const t=setup();const horn=new Stack('minecraft:goat_horn');horn.nameTag='§6Go to Spawn';
 const e={source:t.p,itemStack:horn,cancel:false};t.events.itemUseBefore(e);assert.equal(e.cancel,false);
});
test('forged generator horn name without a server ID is cancelled, not redeemed',()=>{
 const t=setup();owned(t);const horn=new Stack('minecraft:goat_horn');horn.nameTag='§bSkyGen Cobblestone Generator';t.p.inv.setItem(0,horn);
 const e={source:t.p,itemStack:horn,cancel:false};t.events.itemUseBefore(e);t.advance(1);
 assert.equal(e.cancel,true);assert.equal(t.call('generators.size'),0);assert.equal(t.p.inv.getItem(0),horn);
});
test('old name-only generator eggs are blocked with operator recovery guidance',()=>{
 const t=setup();owned(t);const egg=new Stack('minecraft:egg');egg.nameTag='§bSkyGen Cobblestone Generator';
 const e={source:t.p,itemStack:egg,cancel:false};t.events.itemUseBefore(e);t.advance(1);
 assert.equal(e.cancel,true);assert(t.p.messages.some(s=>s.includes('Old generator egg')));
});

test('custom item component registered for onUse and onUseOn',()=>{
 const t=setup();assert(!t.loadError);const c=t.events.customItems?.['skygen:generator_token_use'];
 assert(c);assert.equal(typeof c.onUse,'function');assert.equal(typeof c.onUseOn,'function');
 assert.equal(t.call('generatorTokenCustomReady'),true);
});
test('both duplicate use callbacks consume only one custom token',()=>{
 const t=setup(),{item,id}=purchase(t),c=t.events.customItems['skygen:generator_token_use'];
 c.onUse({source:t.p,itemStack:item});c.onUseOn({source:t.p,itemStack:item});
 assert.equal(t.jobs.filter(j=>j.at===1).length,1);
 t.advance(1);assert.equal(t.call('generators.size'),1);assert.equal(t.call(`tokenRead('${id}').status`),'spent');
});
test('new generator items use distinct matching identifiers',()=>{
 const t=setup();owned(t);
 t.call(`issueGeneratorToken(p,GENS.find(g=>g.name==='Coal'),500)`);
 t.call(`issueGeneratorToken(p,GENS.find(g=>g.name==='Stone'),500)`);
 assert.equal(t.p.inv.getItem(0).typeId,'skygen:generator_coal');
 assert.equal(t.p.inv.getItem(1).typeId,'skygen:generator_stone');
 assert.notEqual(t.p.inv.getItem(0).getDynamicProperty('sg_token_id'),t.p.inv.getItem(1).getDynamicProperty('sg_token_id'));
});
test('type-swapped token cannot redeem as the original resource',()=>{
 const t=setup(),{item,id}=purchase(t);const counterfeit=item.clone();counterfeit.typeId='skygen:generator_diamond';t.p.inv.setItem(0,counterfeit);
 t.call(`placeGeneratorToken(p,0,'${id}')`);assert.equal(t.call('generators.size'),0);
 assert.equal(t.call(`tokenRead('${id}').status`),'issued');
});
test('valid v0.9.2 issued generator horn redeems after upgrading to v0.9.3',()=>{
 const t=setup(),{item,id}=purchase(t);const legacy=item.clone();legacy.typeId='minecraft:goat_horn';
 t.p.inv.setItem(0,legacy);const e={source:t.p,itemStack:legacy,cancel:false};
 t.events.itemUseBefore(e);assert(e.cancel);t.advance(1);assert.equal(t.call('generators.size'),1);
});
test('forged custom resource item without server-issued ID cannot place',()=>{
 const t=setup();owned(t);const fake=new Stack('skygen:generator_diamond');fake.nameTag='§bSkyGen Diamond Generator';t.p.inv.setItem(0,fake);
 const c=t.events.customItems['skygen:generator_token_use'];c.onUseOn({source:t.p,itemStack:fake});t.advance(1);
 assert.equal(t.call('generators.size'),0);assert.equal(t.p.inv.getItem(0),fake);
});
test('a wrong custom item cannot spoof an existing generator token by its name',()=>{
 const t=setup(),{item,id}=purchase(t);const fake=item.clone();fake.typeId='skygen:generator_coal';
 t.p.inv.setItem(0,fake);t.call(`placeGeneratorToken(p,0,'${id}')`);
 assert.equal(t.call('generators.size'),0);assert.equal(t.call(`tokenRead('${id}').status`),'issued');
});
test('the two locked teleport horns do not activate custom generator component',()=>{
 const t=setup();const c=t.events.customItems['skygen:generator_token_use'];
 c.onUse({source:t.p,itemStack:new Stack('minecraft:goat_horn')});assert.equal(t.jobs.filter(j=>j.at===1).length,0);
});
test('global Bedrock itemUse fallback triggers custom token securely',()=>{
 const t=setup(),{item,id}=purchase(t);const e={source:t.p,itemStack:item,cancel:false};
 t.events.itemUseBefore(e);assert(e.cancel);t.advance(1);
 assert.equal(t.call('generators.size'),1);assert.equal(t.call(`tokenRead('${id}').status`),'spent');
});
test('custom component and global itemUse both fire only one queued redemption',()=>{
 const t=setup(),{item,id}=purchase(t),c=t.events.customItems['skygen:generator_token_use'];
 const e={source:t.p,itemStack:item,cancel:false};t.events.itemUseBefore(e);c.onUseOn({source:t.p,itemStack:item});
 assert(e.cancel);assert.equal(t.jobs.filter(j=>j.at===1).length,1);
 t.advance(1);assert.equal(t.call('generators.size'),1);assert.equal(t.call(`tokenRead('${id}').status`),'spent');
});
console.log(`SkyGen v0.9.3 focused security tests: ${n-failed} passed, ${failed} failed`);if(failed)process.exitCode=1;
