const test=require('node:test');
const assert=require('node:assert/strict');
const store=require('../src/core/copy-snapshot-store.js');

function copies(label){return Array.from({length:8},(_,i)=>({version:i+1,style:label,block:{mainTitle:`${label}-${i+1}`}}));}

test('keeps only the newest five generated batches',()=>{
  let state=store.normalizeState(null);
  for(let i=1;i<=6;i++)state=store.addBatch(state,{input:`p${i}`,copies:copies(`s${i}`),selected:[]},{id:`b${i}`,now:`2026-08-07T0${i}:00:00.000Z`});
  assert.deepEqual(state.batches.map(x=>x.id),['b6','b5','b4','b3','b2']);
  assert.equal(state.activeId,'b6');
});

test('restores active batch including selected versions',()=>{
  let state=store.addBatch(null,{input:'牙膏',copies:copies('A'),selected:[1,3,9,-1]},{id:'a',now:'2026-08-07T01:00:00.000Z'});
  state=store.addBatch(state,{input:'凝胶',copies:copies('B'),selected:[0]},{id:'b',now:'2026-08-07T02:00:00.000Z'});
  state=store.activate(state,'a');
  const batch=store.activeBatch(state);
  assert.equal(batch.input,'牙膏');
  assert.deepEqual(batch.selected,[1,3]);
  assert.equal(batch.copies[0].block.mainTitle,'A-1');
});

test('updates current snapshot without reordering history',()=>{
  let state=store.addBatch(null,{input:'old',copies:copies('old'),selected:[]},{id:'old',now:'2026-08-07T01:00:00.000Z'});
  state=store.addBatch(state,{input:'new',copies:copies('new'),selected:[]},{id:'new',now:'2026-08-07T02:00:00.000Z'});
  state=store.activate(state,'old');
  const changed=copies('edited');
  state=store.updateActive(state,{input:'edited input',copies:changed,selected:[2],updatedAt:'2026-08-07T03:00:00.000Z'});
  assert.deepEqual(state.batches.map(x=>x.id),['new','old']);
  assert.equal(store.activeBatch(state).input,'edited input');
  assert.deepEqual(store.activeBatch(state).selected,[2]);
});

test('normalizes malformed persisted data safely',()=>{
  const state=store.normalizeState('{bad json');
  assert.deepEqual(state,{version:2,activeId:'',batches:[]});
});

test('pinned snapshots survive while five ordinary recent batches are still retained',()=>{
  let state=store.normalizeState(null);
  for(let i=1;i<=5;i++)state=store.addBatch(state,{input:`p${i}`,copies:copies(`s${i}`),selected:[]},{id:`b${i}`,now:`2026-08-07T0${i}:00:00.000Z`});
  state=store.setPinned(state,'b1',true,{now:'2026-08-07T06:00:00.000Z'});
  state=store.addBatch(state,{input:'p6',copies:copies('s6'),selected:[]},{id:'b6',now:'2026-08-07T06:10:00.000Z'});
  assert.deepEqual(state.batches.map(x=>x.id),['b6','b5','b4','b3','b2','b1']);
  assert.equal(state.batches.find(x=>x.id==='b1').pinned,true);
  assert.deepEqual(store.stats(state),{total:6,pinned:1,recent:5,maxRecent:5});
});

test('unpinning an old retained snapshot returns it to the five-batch eviction rule',()=>{
  let state=store.normalizeState(null);
  for(let i=1;i<=5;i++)state=store.addBatch(state,{input:`p${i}`,copies:copies(`s${i}`),selected:[]},{id:`b${i}`,now:`2026-08-07T0${i}:00:00.000Z`});
  state=store.setPinned(state,'b1',true);
  state=store.addBatch(state,{input:'p6',copies:copies('s6'),selected:[]},{id:'b6',now:'2026-08-07T06:00:00.000Z'});
  assert.equal(state.batches.length,6);
  state=store.setPinned(state,'b1',false);
  assert.deepEqual(state.batches.map(x=>x.id),['b6','b5','b4','b3','b2']);
});

test('deleting a snapshot removes it permanently and moves active id when needed',()=>{
  let state=store.addBatch(null,{input:'a',copies:copies('A'),selected:[]},{id:'a'});
  state=store.addBatch(state,{input:'b',copies:copies('B'),selected:[]},{id:'b'});
  state=store.activate(state,'a');
  state=store.deleteBatch(state,'a');
  assert.deepEqual(state.batches.map(x=>x.id),['b']);
  assert.equal(state.activeId,'b');
});

test('normalizes legacy starred aliases into the pinned field',()=>{
  const state=store.normalizeState({version:1,activeId:'legacy',batches:[{id:'legacy',input:'x',copies:copies('L'),starred:true}]});
  assert.equal(state.version,2);
  assert.equal(state.batches[0].pinned,true);
});
