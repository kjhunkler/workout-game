import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arm } from '../src/space';
import type { Pose } from '../src/types';
test('straight upper-body arm aims in mirrored direction without legs',()=>{
 const p:Pose=[];p[11]={x:.2,y:.4,visibility:1};p[13]={x:.4,y:.4,visibility:1};p[15]={x:.6,y:.4,visibility:1};
 assert.ok(arm(p,0)!.dx<0);
 p[15]={x:.4,y:.6,visibility:1};assert.equal(arm(p,0),undefined);
 p[15]={x:.6,y:.4,visibility:.1};assert.equal(arm(p,0),undefined);
});
