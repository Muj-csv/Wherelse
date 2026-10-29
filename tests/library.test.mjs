import {test} from 'node:test';import assert from 'node:assert/strict';
import {STUDENT_STORIES,storyNode,readStories,saveStories} from '../src/story/library.ts';
test('every authored branch reaches a valid ending without cycles',()=>{
 for(const story of STUDENT_STORIES){const visit=(id,seen)=>{assert.ok(story.nodes[id]);assert.ok(!seen.includes(id));for(const option of story.nodes[id].options)visit(option.next,[...seen,id]);};visit('start',[]);}
});
test('branch recall respects valid transitions and rejects forged paths',()=>{
 const story=STUDENT_STORIES[0];assert.equal(storyNode(story,['ask','hello']).title,'A beginning can be small.');
 const storage={getItem:()=>JSON.stringify({seat:['ask','forged','hello'],result:['pause'],friend:['unknown']})};
 assert.deepEqual(readStories(storage),{seat:['ask'],result:['pause'],friend:[]});
 assert.equal(saveStories(null,{}),false);
});
