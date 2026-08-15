'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const timer=require('../src/core/elapsed-timer');

test('formatElapsed starts at zero and keeps tenths',()=>{
  assert.equal(timer.formatElapsed(0),'00:00.0');
  assert.equal(timer.formatElapsed(99),'00:00.0');
  assert.equal(timer.formatElapsed(100),'00:00.1');
  assert.equal(timer.formatElapsed(4623),'00:04.6');
});

test('formatElapsed handles minute and hour durations',()=>{
  assert.equal(timer.formatElapsed(61_230),'01:01.2');
  assert.equal(timer.formatElapsed(3_661_999),'01:01:01.9');
});

test('timer emits zero immediately and freezes final elapsed time',()=>{
  let t=1000,cb=null,cleared=false;
  const ticks=[];
  const c=timer.create({
    now:()=>t,
    intervalMs:100,
    setInterval:fn=>{cb=fn;return 7;},
    clearInterval:id=>{assert.equal(id,7);cleared=true;},
    onTick:x=>ticks.push(x)
  });
  c.start();
  assert.equal(ticks[0].text,'00:00.0');
  t=2460;cb();
  assert.equal(ticks.at(-1).text,'00:01.4');
  t=5630;
  const final=c.stop();
  assert.equal(final,4630);
  assert.equal(c.format(),'00:04.6');
  assert.equal(c.isRunning(),false);
  assert.equal(cleared,true);
});
