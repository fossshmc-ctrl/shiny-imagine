const test=require('node:test');
const assert=require('node:assert/strict');
const gateApi=require('../src/core/latest-request-gate');

test('older async status responses cannot overwrite the latest request',()=>{
  const gate=gateApi.create();
  const oldRequest=gate.begin();
  const newRequest=gate.begin();
  assert.equal(gate.isLatest(oldRequest),false);
  assert.equal(gate.isLatest(newRequest),true);
});

test('invalidate rejects every previously issued request token',()=>{
  const gate=gateApi.create();
  const request=gate.begin();
  gate.invalidate();
  assert.equal(gate.isLatest(request),false);
});
