(function(root){
  'use strict';
  const data=typeof module!=='undefined'?require('./data.js'):root.BENTLEY;
  const totalWeight=data.items.reduce((n,x)=>n+x.weight,0);
  if(totalWeight!==100000)throw new Error(`확률 합계 오류: ${totalWeight}/100000`);
  const ranks={bronze:0,silver:1,gold:2,pink:3};
  function randomUnit(){
    if(root.crypto&&root.crypto.getRandomValues){const a=new Uint32Array(1);root.crypto.getRandomValues(a);return a[0]/4294967296;}
    return Math.random();
  }
  function sample(rng=randomUnit){
    const u=rng();if(!Number.isFinite(u)||u<0||u>=1)throw new RangeError('Random value must be in [0,1).');
    // Correct only floating-point representation error at an exact bucket boundary.
    const target=Math.min(totalWeight-1,Math.floor(u*totalWeight+Number.EPSILON*totalWeight));let acc=0;
    for(const item of data.items){acc+=item.weight;if(target<acc)return item;}
    throw new Error('Invalid probability distribution');
  }
  function fresh(){return {version:1,total:0,tokens:0,credits:0,tickets:0,inventory:{},crafted:{},claimed:[],history:[],pending:null,settings:{sound:true,fast:false,reducedMotion:false}};}
  function validCounts(obj,allowed){
    if(!obj||typeof obj!=='object'||Array.isArray(obj))return {};
    return Object.fromEntries(Object.entries(obj).filter(([id,n])=>allowed.has(id)&&Number.isSafeInteger(n)&&n>0));
  }
  function restore(raw){
    const empty=fresh();if(!raw||raw.version!==1)return empty;
    const ids=new Set(data.items.map(x=>x.id));const craftIds=new Set(data.crafting.map(x=>x.id));
    for(const key of ['total','tokens','credits','tickets'])if(Number.isSafeInteger(raw[key])&&raw[key]>=0)empty[key]=raw[key];
    empty.inventory=validCounts(raw.inventory,ids);empty.crafted=validCounts(raw.crafted,craftIds);
    empty.claimed=Array.isArray(raw.claimed)?[...new Set(raw.claimed.filter(n=>data.milestones.some(m=>m.at===n)&&n<=empty.total))]:[];
    empty.history=Array.isArray(raw.history)?raw.history.filter(h=>h&&ids.has(h.id)&&Number.isSafeInteger(h.number)&&h.number>0).slice(0,200):[];
    for(const key of ['sound','fast','reducedMotion'])if(typeof raw.settings?.[key]==='boolean')empty.settings[key]=raw.settings[key];
    const p=raw.pending;
    if(p&&[1,10].includes(p.ids?.length)&&p.ids.every(id=>ids.has(id))&&Array.isArray(p.revealed)&&p.revealed.length===p.ids.length&&p.revealed.every(x=>typeof x==='boolean'))empty.pending={ids:[...p.ids],revealed:[...p.revealed]};
    return empty;
  }
  function draw(state,count,rng=randomUnit){
    if(![1,10].includes(count))throw new RangeError('Only 1 or 10 draws allowed');
    if(state.pending)return state.pending;
    const items=Array.from({length:count},()=>sample(rng));
    for(const item of items){state.total++;state.inventory[item.id]=(state.inventory[item.id]||0)+1;if(item.grade==='재화')state.credits+=item.quantity;state.history.unshift({id:item.id,number:state.total});}
    state.tokens+=15*count;state.history=state.history.slice(0,200);
    state.pending={ids:items.map(x=>x.id),revealed:Array(count).fill(false)};
    return state.pending;
  }
  function highest(items){return items.reduce((best,x)=>ranks[x.tier]>ranks[best]?x.tier:best,'bronze');}
  function reveal(state,index){if(state.pending&&index>=0&&index<state.pending.ids.length)state.pending.revealed[index]=true;}
  function finish(state){if(state.pending?.revealed.every(Boolean)){state.pending=null;return true;}return false;}
  function claim(state,at){
    const m=data.milestones.find(x=>x.at===at);
    if(!m||state.total<at||state.claimed.includes(at))return false;
    state.claimed.push(at);
    if(m.kind==='credit')state.credits+=m.qty;
    if(m.kind==='ticket')state.tickets+=m.qty;
    if(m.kind==='item')state.inventory[m.itemId]=(state.inventory[m.itemId]||0)+m.qty;
    return true;
  }
  function craft(state,id){
    const item=data.crafting.find(x=>x.id===id);
    if(!item||state.tokens<item.cost)return false;
    state.tokens-=item.cost;state.crafted[id]=(state.crafted[id]||0)+1;
    if(item.asset==='7-5')state.tickets++;
    if(item.asset==='7-6')state.credits+=6000;
    return true;
  }
  const api={totalWeight,ranks,randomUnit,sample,fresh,restore,draw,highest,reveal,finish,claim,craft};
  root.BentleyCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
