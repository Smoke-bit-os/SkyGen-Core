// v0.9.6 Food Shop security, menus and purchase/sale simulations.
// Uses mocked Bedrock API; does not substitute for Xbox/Realm testing.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(process.argv[2]||'/mnt/data/skygen_v096_build/behavior_pack/scripts/main.js','utf8').replace(/^import .*?;\n/gm,'');
const catalog=JSON.parse(fs.readFileSync('/mnt/data/skygen_v096_build/food_shop_catalog.json','utf8'));
class Stack {
 constructor(type,amount=1){this.typeId=type;this.amount=amount;this.maxAmount=/minecraft:(mushroom_stew|rabbit_stew|beetroot_soup)$/.test(type)?1:type==='minecraft:honey_bottle'?16:type==='minecraft:goat_horn'||type.startsWith('skygen:generator_')?1:64;this.lockMode=0;this.nameTag='';this.lore=[];this.keepOnDeath=false;this.props={}}
 getLore(){return this.lore}setLore(x){this.lore=x}clone(){const x=new Stack(this.typeId,this.amount);Object.assign(x,structuredClone({...this}));return x}getDynamicPropertyIds(){return Object.keys(this.props)}getDynamicProperty(k){return this.props[k]}setDynamicProperty(k,v){this.props[k]=v}
}
function make(){
 const jobs=[],forms=[],events={},globalProps=new Map(),blocks=new Map(),messages=[],logs=[],formResponses=[];
 class Form{
  constructor(){this.buttons=[];this._title='';this.formType=this.constructor.name;}
  title(s){this._title=s;return this}body(s){this._body=s;return this}
  button(s){this.buttons.push(s);return this}
  textField(label,placeholder,options){this._field={label,placeholder,options};return this}
  button1(s){this.buttons.push(s);return this}button2(s){this.buttons.push(s);return this}
  show(p){forms.push(this);const next=formResponses.shift();if(!next)throw Error('Unexpected UI '+this.formType+' '+this._title);if(next.title&&!this._title.includes(next.title))throw Error('Wrong UI '+this._title+' expected '+next.title);return Promise.resolve(next.response)}
 }
 class ActionFormData extends Form{};class ModalFormData extends Form{};class MessageFormData extends Form{};
 class Inv {
  constructor(){this.size=36;this.slots=Array(this.size).fill(undefined);this.failAdd=false;this.failSet=false}
  getItem(i){return this.slots[i]}
  setItem(i,item){if(this.failSet){this.failSet=false;throw Error('Mock inventory set failed')}this.slots[i]=item?.clone()}
  addItem(stack){if(this.failAdd){this.failAdd=false;throw Error('Mock item delivery failed')};let left=stack.amount;
   for(let i=0;i<this.size&&left>0;i++){const at=this.slots[i];if(!at||at.typeId!==stack.typeId||at.nameTag||at.lockMode!==0||at.getLore().length)continue;const available=at.maxAmount-at.amount;if(available>0){const n=Math.min(left,available);at.amount+=n;left-=n}}
   for(let i=0;i<this.size&&left>0;i++){if(this.slots[i])continue;const n=Math.min(left,stack.maxAmount);this.slots[i]=new Stack(stack.typeId,n);left-=n}
   return left?new Stack(stack.typeId,left):undefined
  }
  swapItems(i,j,other){const a=this.slots[i],b=other.slots[j];this.slots[i]=b;other.slots[j]=a;}
 }
 const inv=new Inv(),p={id:'p1',name:'TestPlayer',isValid:true,typeId:'minecraft:player',dimension:{id:'minecraft:overworld'},location:{x:0,y:2,z:0},inv,messages,selectedSlotIndex:0,
  sendMessage(s){messages.push(String(s))},data:new Map(),getDynamicProperty(k){return this.data.get(k)},setDynamicProperty(k,v){this.data.set(k,v)},getComponent(k){return k==='minecraft:inventory'?{container:inv}:undefined},onScreenDisplay:{setTitle(){},setActionBar(){}},getBlockFromViewDirection(){return null},isOp(){return true},teleport(){},tryTeleport(){return true}
 };
 const dim={id:'minecraft:overworld',runCommand(){return {statusMessage:'',successCount:1}},getBlock({x,y,z}){const key=`${x},${y},${z}`;return {typeId:blocks.get(key)||'minecraft:air',isAir:!blocks.has(key),location:{x,y,z},setType(v){blocks.set(key,v)}}}};
 const world={getDimension(){return dim},getAllPlayers(){return[p]},getDynamicProperty(k){return globalProps.get(k)},getDynamicPropertyIds(){return [...globalProps.keys()]},setDynamicProperty(k,v){globalProps.set(k,v)},beforeEvents:{itemUse:{subscribe(fn){events.itemUseBefore=fn}},explosion:{subscribe(fn){events.explosionBefore=fn}},playerBreakBlock:{subscribe(fn){events.breakBefore=fn}},playerPlaceBlock:{subscribe(fn){events.placeBefore=fn}},playerInteractWithBlock:{subscribe(fn){events.interactBefore=fn}}},afterEvents:{playerSpawn:{subscribe(fn){events.spawn=fn}},itemUse:{subscribe(fn){events.use=fn}},playerBreakBlock:{subscribe(fn){events.breakAfter=fn}},playerPlaceBlock:{subscribe(fn){events.placeAfter=fn}},playerLeave:{subscribe(fn){events.leave=fn}}}};
 const system={currentTick:0,beforeEvents:{startup:{subscribe(fn){events.startup=fn}}},afterEvents:{scriptEventReceive:{subscribe(fn){events.command=fn}}},runTimeout(f,n=1){jobs.push({f,t:this.currentTick+n})},runInterval(f,n){events.interval=f},run(f){this.runTimeout(f,1)}};
 const context=vm.createContext({p,world,system,ItemStack:Stack,ItemLockMode:{none:0,slot:1,inventory:2},ActionFormData,ModalFormData,MessageFormData,console:{warn(...msg){logs.push(msg.join(' '))},log(...msg){logs.push(msg.join(' '))}},Date});
 vm.runInContext(source,context);
 if(events.startup)events.startup({itemComponentRegistry:{registerCustomComponent(){}}});
 const call=code=>vm.runInContext(code,context);
 function queue(...all){formResponses.push(...all.map(x=>({title:x[0],response:x[1]})))}
 async function tick(count=1){for(let i=0;i<count;i++){system.currentTick++;let guard=0;while(jobs.some(j=>j.t<=system.currentTick)){if(++guard>1000)throw Error('Job loop');const next=jobs.find(j=>j.t<=system.currentTick);jobs.splice(jobs.indexOf(next),1);next.f()}await Promise.resolve();await Promise.resolve();}}
 async function drain(){await tick(100);if(formResponses.length)throw Error('Unused queued forms '+formResponses.map(x=>x.title))}
 function setCredits(credits){p.data.set('sg_profile',JSON.stringify({credits,rank:1,xp:0,orbits:0,plot:0,skills:[]}))}
 function credits(){return JSON.parse(p.data.get('sg_profile')||'{"credits":0}').credits}
 function total(type){return inv.slots.filter(s=>s?.typeId===type).reduce((sum,s)=>sum+s.amount,0)}
 return {p,inv,forms,messages,events,system,call,queue,tick,drain,setCredits,credits,total,formResponses,logs,Stack};
}
let passes=0,failed=0;
async function test(name,cb){try{await cb();console.log('PASS '+name);passes++}catch(e){console.error('FAIL '+name+' '+(e.stack||e));failed++}}
const qq=(t,action,category,index,count,confirm=true)=>{t.queue([action===0?'FOOD SHOP':'FOOD SHOP',{selection:action}],['CATEGORY',{selection:category}],['ITEMS',{selection:index}],['Quantity',{formValues:[String(count)]}],['Confirm Shop',{selection:confirm?1:0}])};
const ready=t=>{t.setCredits(1e6);return t};
(async()=>{
 await test('all 25 foods have unique valid Bedrock identifiers and five categories',async()=>{
  const t=make();const data=Array.from(t.call('FOOD_SHOP'));assert.equal(data.length,25);assert.equal(new Set(data.map(x=>x.id)).size,25);assert.equal(new Set(data.map(x=>x.category)).size,5);
  assert.deepStrictEqual(Array.from(t.call('FOOD_CATEGORIES')),['Basics','Cooked Meats','Seafood','Snacks','Premium']);
  for(const x of data){assert(x.id.startsWith('minecraft:'));assert(Number.isInteger(x.buy)&&Number.isInteger(x.sell));assert(x.buy>x.sell&&x.sell>0);assert.equal(x.count,1)}
 });
 await test('source catalog matches runtime catalog byte-for-byte',async()=>{const a=make();const v=JSON.parse(JSON.stringify(Array.from(a.call('FOOD_SHOP'))));assert.deepStrictEqual(v,catalog)});
 await test('original server shop remains 28 items and unchanged',async()=>{const t=make();assert.equal(t.call('SHOP.length'),28);assert.equal(t.call('SHOP[0].buy'),80);assert.equal(t.call('SHOP[3].id'),'minecraft:diamond')});
 await test('Food Shop appears directly after Server Shop in main menu',async()=>{
  const t=ready(make());t.queue(['SKYGEN CORE',{canceled:true}]);t.call('menu(p)');await t.drain();const a=t.forms[0].buttons;assert.equal(a[a.indexOf('Server Shop')+1],'Food Shop');assert.equal(a.length,13);assert(a.includes('Player Marketplace')&&a.includes('Skill Tree'));
 });
 await test('main menu Food Shop button actually opens food purchase UI',async()=>{
  const t=ready(make());t.queue(['SKYGEN CORE',{selection:4}],['FOOD SHOP',{canceled:true}]);t.call('menu(p)');await t.drain();assert(t.forms[1]._title.includes('FOOD SHOP'));
 });
 await test('Food Shop shows Buy, Sell, Back buttons',async()=>{const t=ready(make());t.queue(['FOOD SHOP',{canceled:true}]);t.call('foodShop(p)');await t.drain();assert.deepStrictEqual(t.forms[0].buttons,['Buy','Sell','Back'])});
 await test('food category selection lists 5 groups with correct stock count',async()=>{
  const t=ready(make());t.queue(['FOOD SHOP',{selection:0}],['CATEGORY',{canceled:true}]);t.call('foodShop(p)');await t.drain();let b=t.forms[1].buttons;assert(b.includes('Basics (6)')&&b.includes('Cooked Meats (5)')&&b.includes('Seafood (3)')&&b.includes('Snacks (5)')&&b.includes('Premium (6)'));
 });
 await test('food selection shows names rather than namespace identifiers',async()=>{
  const t=ready(make());t.queue(['FOOD SHOP',{selection:0}],['CATEGORY',{selection:0}],['ITEMS',{canceled:true}]);t.call('foodShop(p)');await t.drain();assert(t.forms[2].buttons.some(x=>x.startsWith('Bread (40')));
 });
 await test('buying one Bread charges 40 credits and delivers one food item',async()=>{
  const t=ready(make());qq(t,0,0,1,1);t.call('foodShop(p)');await t.drain();assert.equal(t.total('minecraft:bread'),1);assert.equal(t.credits(),999960);assert(t.messages.some(m=>m.includes('Purchased 1 minecraft:bread')));
 });
 await test('buying 16 steaks charges exactly 1520 Credits',async()=>{
  const t=ready(make());qq(t,0,1,0,16);t.call('foodShop(p)');await t.drain();assert.equal(t.total('minecraft:cooked_beef'),16);assert.equal(t.credits(),1e6-16*95);
 });
 await test('buying 64 cooked salmon delivers 64 and charges 5440 Credits',async()=>{
  const t=ready(make());qq(t,0,2,1,64);t.call('foodShop(p)');await t.drain();assert.equal(t.total('minecraft:cooked_salmon'),64);assert.equal(t.credits(),1e6-64*85);
 });
 await test('selling 1 plain Apple credits 8 and removes exactly one',async()=>{
  const t=ready(make());t.inv.slots[0]=new Stack('minecraft:apple',3);qq(t,1,0,0,1);t.call('foodShop(p)');await t.drain();assert.equal(t.total('minecraft:apple'),2);assert.equal(t.credits(),1000008);
 });
 await test('selling 16 plain Bread credits 160, preserving other items',async()=>{
  const t=ready(make());t.inv.slots[0]=new Stack('minecraft:bread',20);t.inv.slots[1]=new Stack('minecraft:coal',10);qq(t,1,0,1,16);t.call('foodShop(p)');await t.drain();assert.equal(t.total('minecraft:bread'),4);assert.equal(t.total('minecraft:coal'),10);assert.equal(t.credits(),1000160);
 });
 await test('named food items cannot be sold as plain food',async()=>{
  const t=ready(make());t.inv.slots[0]=new Stack('minecraft:bread',16);t.inv.slots[0].nameTag='Special Bread';qq(t,1,0,1,16);t.call('foodShop(p)');await t.drain();assert.equal(t.total('minecraft:bread'),16);assert.equal(t.credits(),1e6);assert(t.messages.some(m=>m.includes('Not enough ordinary unlocked items')));
 });
 await test('locked food items cannot be sold',async()=>{
  const t=ready(make());t.inv.slots[0]=new Stack('minecraft:bread',1);t.inv.slots[0].lockMode=1;qq(t,1,0,1,1);t.call('foodShop(p)');await t.drain();assert.equal(t.total('minecraft:bread'),1);assert.equal(t.credits(),1e6);
 });
 await test('cancelled confirmation cannot deduct Credits or deliver food',async()=>{
  const t=ready(make());qq(t,0,0,1,64,false);t.call('foodShop(p)');await t.drain();assert.equal(t.credits(),1e6);assert.equal(t.total('minecraft:bread'),0);
 });
 await test('insufficient Credits block food purchases',async()=>{
  const t=make();t.setCredits(12);qq(t,0,0,1,1);t.call('foodShop(p)');await t.drain();assert.equal(t.credits(),12);assert.equal(t.total('minecraft:bread'),0);assert(t.messages.some(m=>m.includes('Not enough Credits')));
 });
 await test('full inventory blocks purchases without charge',async()=>{
  const t=ready(make());for(let i=0;i<t.inv.size;i++)t.inv.slots[i]=new Stack('minecraft:stone',64);qq(t,0,0,1,1);t.call('foodShop(p)');await t.drain();assert.equal(t.credits(),1e6);assert.equal(t.total('minecraft:bread'),0);assert(t.messages.some(m=>m.includes('Not enough inventory space')));
 });
 await test('Mushroom Stew is non-stackable and requires multiple free slots',async()=>{
  const t=ready(make());qq(t,0,4,3,3);t.call('foodShop(p)');await t.drain();assert.equal(t.total('minecraft:mushroom_stew'),3);assert.equal(t.inv.slots.filter(x=>x?.typeId==='minecraft:mushroom_stew').length,3);assert.equal(t.credits(),1e6-3*90);
 });
 await test('Golden Apple premium food is priced correctly',async()=>{
  const t=ready(make());qq(t,0,4,1,2);t.call('foodShop(p)');await t.drain();assert.equal(t.total('minecraft:golden_apple'),2);assert.equal(t.credits(),1e6-2800);
 });
 await test('economy buy-discount skill is applied when buying food',async()=>{
  const t=ready(make());t.p.data.set('sg_profile',JSON.stringify({credits:10000,rank:50,xp:49000,orbits:0,plot:0,skills:['econ_buy_1']}));qq(t,0,0,1,1);t.call('foodShop(p)');await t.drain();assert.equal(t.credits(),10000-Math.floor(40*.98));
 });
 await test('food selling applies sell skill but never approaches purchase price',async()=>{
  const t=ready(make());t.p.data.set('sg_profile',JSON.stringify({credits:10000,rank:50,xp:49000,orbits:0,plot:0,skills:['econ_sell_1']}));t.inv.slots[0]=new Stack('minecraft:bread',1);qq(t,1,0,1,1);t.call('foodShop(p)');await t.drain();assert(t.credits()>=10010&&t.credits()<10040);
 });
 await test('help food topic is read-only and gives menu navigation',async()=>{
  const t=ready(make()),before=t.credits();t.events.command({id:'skygen:help',message:'food',sourceEntity:t.p,sourceType:'Entity'});await t.tick(5);assert(t.messages.some(m=>m.includes('FOOD SHOP')));assert(t.messages.some(m=>m.includes('Categories:')));assert.equal(t.credits(),before);
 });
 await test('reject invalid quantities: zero decimal negative and greater than 2304',async()=>{
  for(const qty of ['0','-1','1.5','2305','abc']){
   const t=ready(make());t.queue(['FOOD SHOP',{selection:0}],['CATEGORY',{selection:0}],['ITEMS',{selection:1}],['Quantity',{formValues:[qty]}]);t.call('foodShop(p)');await t.drain();assert.equal(t.total('minecraft:bread'),0);assert.equal(t.credits(),1e6);assert(t.messages.some(m=>m.includes('whole number')));
  }
 });
 await test('shop UI escape Back from category returns Food Shop not Server Shop',async()=>{
  const t=ready(make());t.queue(['FOOD SHOP',{selection:0}],['CATEGORY',{selection:5}],['FOOD SHOP',{canceled:true}]);t.call('foodShop(p)');await t.drain();assert(t.forms[2]._title.includes('FOOD SHOP'));
 });
 await test('sell never pays for the wrong food item',async()=>{
  const t=ready(make());t.inv.slots[0]=new Stack('minecraft:apple',64);qq(t,1,0,1,64);t.call('foodShop(p)');await t.drain();assert.equal(t.total('minecraft:apple'),64);assert.equal(t.credits(),1e6);
 });
 await test('food purchase aborts before delivery when wallet persistence fails',async()=>{
  const t=ready(make());const before=t.credits();const original=t.p.setDynamicProperty;t.p.setDynamicProperty=function(k,v){if(k==='sg_profile')throw Error('Simulated wallet error');return original.call(this,k,v)};
  qq(t,0,0,1,2);t.call('foodShop(p)');await t.drain();assert.equal(t.credits(),before);assert.equal(t.total('minecraft:bread'),0);assert(t.messages.some(x=>x.includes('Payment storage unavailable')));
 });
 await test('partial delivery refunds only undelivered food',async()=>{
  const t=ready(make());const original=t.inv.addItem.bind(t.inv);let first=true;
  t.inv.addItem=function(stack){if(first){first=false;original(new Stack(stack.typeId,stack.amount-1));return new Stack(stack.typeId,1)}return original(stack)};
  qq(t,0,0,1,3);t.call('foodShop(p)');await t.drain();assert.equal(t.total('minecraft:bread'),2);assert.equal(t.credits(),1e6-80);assert(t.messages.some(x=>x.includes('Only 2 items delivered')));
 });
 await test('non-stackable stew requires enough empty inventory slots',async()=>{
  const t=ready(make());for(let i=0;i<t.inv.size-2;i++)t.inv.slots[i]=new Stack('minecraft:stone',64);qq(t,0,4,3,3);t.call('foodShop(p)');await t.drain();assert.equal(t.total('minecraft:mushroom_stew'),0);assert.equal(t.credits(),1e6);assert(t.messages.some(x=>x.includes('Not enough inventory space')));
 });
 await test('lore-bearing food cannot be sold in bulk',async()=>{
  const t=ready(make());t.inv.slots[0]=new Stack('minecraft:apple',64);t.inv.slots[0].setLore(['special']);qq(t,1,0,0,32);t.call('foodShop(p)');await t.drain();assert.equal(t.total('minecraft:apple'),64);assert.equal(t.credits(),1e6);
 });
 await test('existing Server Shop purchase still works after food-menu refactor',async()=>{
  const t=ready(make());t.queue(['SERVER SHOP',{selection:0}],['CATEGORY',{selection:0}],['ITEMS',{selection:0}],['Quantity',{formValues:['16']}],['Confirm Shop',{selection:1}]);
  t.call('shop(p)');await t.drain();assert.equal(t.total('minecraft:cobblestone'),16);assert.equal(t.credits(),1e6-80);
 });
 console.log(`SkyGen v0.9.6 Food Shop tests: ${passes} passed, ${failed} failed`);
 if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
