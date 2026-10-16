const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const D=require('../data.js'),C=require('../core.js');
test('official distribution covers all 100000 integer probability slots, including boundaries',()=>{
  assert.equal(D.items.length,129);assert.equal(C.totalWeight,100000);let start=0;
  for(const item of D.items){
    assert.equal(C.sample(()=>start/100000).id,item.id);
    assert.equal(C.sample(()=>(start+item.weight-.1)/100000).id,item.id);
    start+=item.weight;
  }
  assert.throws(()=>C.sample(()=>1),RangeError);
  assert.equal(D.items[0].probability,.15);assert.equal(D.items[1].probability,.2);assert.equal(D.items[2].probability,.25);
});
test('ten draws are independent and re-entry cannot duplicate inventory or tokens',()=>{
  const s=C.fresh();let n=0;const p=C.draw(s,10,()=>((n++)+.1)/10);
  assert.equal(n,10);assert.equal(p.ids.length,10);assert.equal(s.total,10);assert.equal(s.tokens,150);
  assert.equal(Object.values(s.inventory).reduce((a,b)=>a+b,0),10);
  assert.equal(C.draw(s,10,()=>0),p);assert.equal(s.total,10);assert.equal(s.tokens,150);
  assert.equal(C.finish(s),false);for(let i=0;i<10;i++)C.reveal(s,i);assert.equal(C.finish(s),true);assert.equal(s.pending,null);
});
test('pending results survive JSON save/reload without reroll',()=>{
  const s=C.fresh();C.draw(s,10,()=>.001);C.reveal(s,3);
  const loaded=C.restore(JSON.parse(JSON.stringify(s)));assert.deepEqual(loaded,s);
  assert.deepEqual(C.draw(loaded,1,()=>.9).ids,s.pending.ids);assert.equal(loaded.total,10);
});
test('milestones and token purchases pay once and never permit negative balances',()=>{
  const s=C.fresh();assert.equal(C.claim(s,15),false);s.total=85;
  assert.equal(C.claim(s,15),true);assert.equal(C.claim(s,15),false);assert.equal(s.tickets,1);
  assert.equal(C.claim(s,30),true);assert.equal(s.credits,10000);
  assert.equal(C.claim(s,85),true);assert.equal(s.inventory['cargo-2'],1);
  assert.equal(C.craft(s,'cargo-0'),false);s.tokens=5000;assert.equal(C.craft(s,'cargo-0'),true);assert.equal(s.tokens,0);assert.equal(s.crafted['cargo-0'],1);assert.equal(C.craft(s,'cargo-0'),false);
});
test('tampered / incompatible saves do not inject invalid items or pending results',()=>{
  const s=C.restore({version:1,total:-1,tokens:'infinity',inventory:{bogus:3,'cargo-0':-1},crafted:{bogus:2},claimed:[999],pending:{ids:['bogus'],revealed:[false]}});
  assert.equal(s.total,0);assert.equal(s.tokens,0);assert.deepEqual(s.inventory,{});assert.equal(s.pending,null);
  assert.deepEqual(C.restore({version:2}),C.fresh());
});
test('all referenced images exist, craft-only items stay out of the random pool',()=>{
  for(const item of [...D.items,...D.crafting,...D.milestones])if(item.asset)assert.ok(fs.existsSync(path.join(__dirname,'../assets/items',item.asset+'.webp')),item.asset);
  const ids=new Set(D.items.map(x=>x.id));assert.equal(D.crafting.length,66);
  for(const item of D.crafting.filter(x=>x.exclusive))assert.ok(!ids.has(item.id));
  assert.equal(C.highest([{tier:'bronze'},{tier:'pink'},{tier:'gold'}]),'pink');
});
