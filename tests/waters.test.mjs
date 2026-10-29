import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readThought,keepThought,releaseThought,WATERS_KEY} from '../src/story/waters.ts';
test('thoughts save only through keep and release removes their stored words',()=>{
 const data=new Map();const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 assert.equal(readThought(storage),'');assert.equal(keepThought(storage,'  A little win  '),true);
 assert.equal(readThought(storage),'A little win');assert.equal(releaseThought(storage),true);
 assert.equal(data.has(WATERS_KEY),false);assert.equal(readThought(storage),'');
});
test('invalid and blocked storage never falsely report successful saves or releases',()=>{
 assert.equal(keepThought(null,'hello'),false);assert.equal(releaseThought(null),false);
 const blocked={getItem:()=>'{broken',setItem:()=>{throw Error()},removeItem:()=>{throw Error()}};
 assert.equal(readThought(blocked),'');assert.equal(keepThought(blocked,'hello'),false);assert.equal(releaseThought(blocked),false);
 assert.equal(keepThought(blocked,'x'.repeat(281)),false);
 assert.equal(readThought({getItem:()=>JSON.stringify({version:2,note:'An unsupported save'})}), '');
});
