import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCommunity} from '../server/community.mjs';

const origin='http://127.0.0.1:8787';
async function fixture(options={}){
 const dir=mkdtempSync(join(tmpdir(),'elsewhere-test-'));
 const config={dbPath:join(dir,'test.sqlite'),origin,inviteCode:'test-member-invitation',moderatorCode:'test-moderator-invitation',...options};
 let app=createCommunity(config);
 async function listen(){await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));return `http://127.0.0.1:${app.server.address().port}`;}
 let base=await listen();
 async function stop(){app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));app.close();}
 return {async call(path,method='GET',body,cookie,headers={}){
   const response=await fetch(base+path,{method,headers:{Origin:origin,'X-Requested-With':'Wherelse',...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
   return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
 },async restart(){await stop();app=createCommunity(config);base=await listen();},async close(){await stop();rmSync(dir,{recursive:true,force:true});}};
}
async function register(f,handle,moderator=false){
 const result=await f.call('/api/auth/register','POST',{handle,password:'A unique test passphrase 123!',invite:moderator?'test-moderator-invitation':'test-member-invitation'});
 assert.equal(result.status,200);assert.ok(result.cookie);return {...result.data.user,cookie:result.cookie};
}
test('community enforces identity, audience, moderation, deletion and blocking across accounts',async t=>{
 const f=await fixture();t.after(()=>f.close());
 const alice=await register(f,'alice'),bob=await register(f,'bob'),mod=await register(f,'keeper',true);
 let privateId,sharedId;
 await t.test('authentication and same-origin protection are required',async()=>{
   assert.equal((await f.call('/api/postcards')).status,401);
   assert.equal((await f.call('/api/postcards','POST',{body:'hello'},alice.cookie,{Origin:'https://attacker.example'})).status,403);
   assert.equal((await f.call('/api/postcards','POST',{body:'hello'},alice.cookie,{'X-Requested-With':''})).status,403);
   assert.equal((await f.call('/api/auth/register','POST',{handle:'outsider',password:'a long passphrase 123',invite:'wrong'})).status,403);
   assert.equal((await f.call('/api/moderation','GET',undefined,bob.cookie)).status,403);
 });
 await t.test('Only me is the server default and private content never reaches members or moderator views',async()=>{
   const created=await f.call('/api/postcards','POST',{body:'A private thought'},alice.cookie);privateId=created.data.id;
   assert.equal(created.status,201);assert.equal(created.data.status,'private');
   assert.equal((await f.call(`/api/postcards/${privateId}`,'GET',undefined,bob.cookie)).status,404);
   assert.equal((await f.call(`/api/postcards/${privateId}`,'GET',undefined,mod.cookie)).status,404);
   assert.equal((await f.call('/api/postcards','GET',undefined,bob.cookie)).data.posts.length,0);
   assert.equal((await f.call('/api/moderation','GET',undefined,mod.cookie)).data.pending.length,0);
 });
 await t.test('community sharing stays pending until a moderator approves it',async()=>{
   const created=await f.call('/api/postcards','POST',{body:'A small shared victory',audience:'community'},alice.cookie);sharedId=created.data.id;
   assert.equal(created.data.status,'pending');assert.equal((await f.call(`/api/postcards/${sharedId}`,'GET',undefined,bob.cookie)).status,404);
   assert.equal((await f.call('/api/moderation','GET',undefined,mod.cookie)).data.pending[0].id,sharedId);
   assert.equal((await f.call(`/api/moderation/${sharedId}`,'POST',{action:'approve'},bob.cookie)).status,403);
   assert.equal((await f.call(`/api/moderation/${sharedId}`,'POST',{action:'approve'},mod.cookie)).status,200);
   assert.equal((await f.call('/api/postcards','GET',undefined,bob.cookie)).data.posts[0].body,'A small shared victory');
   assert.equal((await f.call(`/api/postcards/${sharedId}`,'DELETE',{},bob.cookie)).status,403);
   assert.equal((await f.call(`/api/postcards/${sharedId}`,'PATCH',{body:'tamper',audience:'private'},bob.cookie)).status,403);
   assert.equal((await f.call(`/api/postcards/${sharedId}/react`,'POST',{kind:'hear'},bob.cookie)).status,200);
   assert.equal((await f.call('/api/postcards','GET',undefined,bob.cookie)).data.posts[0].reaction,'hear');
 });
 await t.test('blocking hides content in both directions and unblocking restores access',async()=>{
   assert.equal((await f.call('/api/blocks','POST',{userId:alice.id},bob.cookie)).status,200);
   assert.equal((await f.call('/api/postcards','GET',undefined,bob.cookie)).data.posts.length,0);
   assert.equal((await f.call(`/api/postcards/${sharedId}`,'GET',undefined,bob.cookie)).status,404);
   assert.equal((await f.call(`/api/blocks/${alice.id}`,'DELETE',{},bob.cookie)).status,200);
   assert.equal((await f.call(`/api/postcards/${sharedId}`,'GET',undefined,bob.cookie)).status,200);
 });
 await t.test('reports hide the card for the reporter; retracting it does not leak its newly private body to moderators',async()=>{
   assert.equal((await f.call(`/api/postcards/${sharedId}/report`,'POST',{reason:'personal-info'},bob.cookie)).status,200);
   assert.equal((await f.call('/api/postcards','GET',undefined,bob.cookie)).data.posts.length,0);
   assert.equal((await f.call(`/api/postcards/${sharedId}`,'PATCH',{body:'Now private again',audience:'private'},alice.cookie)).status,200);
   const reports=(await f.call('/api/moderation','GET',undefined,mod.cookie)).data.reports;
   assert.equal(reports.length,1);assert.equal(reports[0].body,null);
   assert.equal((await f.call(`/api/moderation/${sharedId}`,'POST',{action:'remove'},mod.cookie)).status,404);
   assert.equal((await f.call(`/api/reports/${reports[0].id}/resolve`,'POST',{},mod.cookie)).status,200);
 });
 await t.test('stored content and authentication survive a backend restart',async()=>{
   await f.restart();
   assert.equal((await f.call(`/api/postcards/${privateId}`,'GET',undefined,alice.cookie)).data.post.body,'A private thought');
   const login=await f.call('/api/auth/login','POST',{handle:'alice',password:'A unique test passphrase 123!'});assert.equal(login.status,200);
 });
 await t.test('authors can delete cards; account deletion revokes every session and removes their cards',async()=>{
   assert.equal((await f.call(`/api/postcards/${privateId}`,'DELETE',{},alice.cookie)).status,200);
   assert.equal((await f.call(`/api/postcards/${privateId}`,'GET',undefined,alice.cookie)).status,404);
   assert.equal((await f.call('/api/account','DELETE',{},alice.cookie)).status,200);
   assert.equal((await f.call('/api/auth/session','GET',undefined,alice.cookie)).data.user,null);
   assert.equal((await f.call(`/api/postcards/${sharedId}`,'GET',undefined,bob.cookie)).status,404);
 });
});
test('request rate limits produce an explicit 429 response',async t=>{
 const f=await fixture({rateLimit:2});t.after(()=>f.close());
 assert.equal((await f.call('/api/health')).status,200);assert.equal((await f.call('/api/health')).status,200);assert.equal((await f.call('/api/health')).status,429);
});
test('public hosting rejects insecure origins and missing invitations',()=>{
 assert.throws(()=>createCommunity({dbPath:':memory:',origin:'http://public.example',inviteCode:'a',moderatorCode:'b'}),/HTTPS/);
 assert.throws(()=>createCommunity({dbPath:':memory:',origin,inviteCode:'',moderatorCode:''}),/invitation/);
});
test('private shelves have a bounded size and all own cards remain manageable',async t=>{
 const f=await fixture({maxCards:2});t.after(()=>f.close());const user=await register(f,'shelf');
 for(const body of ['First private note','Second private note'])assert.equal((await f.call('/api/postcards','POST',{body},user.cookie)).status,201);
 assert.equal((await f.call('/api/postcards','POST',{body:'one too many'},user.cookie)).status,400);
 assert.equal((await f.call('/api/postcards','GET',undefined,user.cookie)).data.posts.length,2);
});
test('rejected postcards stay hidden, and logout revokes the specific session',async t=>{
 const f=await fixture();t.after(()=>f.close());const author=await register(f,'writer'),mod=await register(f,'reviewer',true),reader=await register(f,'reader');
 const post=await f.call('/api/postcards','POST',{body:'A submission to review',audience:'community'},author.cookie);
 assert.equal((await f.call(`/api/moderation/${post.data.id}`,'POST',{action:'reject'},mod.cookie)).status,200);
 assert.equal((await f.call('/api/postcards','GET',undefined,author.cookie)).data.posts[0].status,'rejected');
 assert.equal((await f.call(`/api/postcards/${post.data.id}`,'GET',undefined,reader.cookie)).status,404);
 assert.equal((await f.call('/api/auth/logout','POST',{},author.cookie)).status,200);
 assert.equal((await f.call('/api/auth/session','GET',undefined,author.cookie)).data.user,null);
 assert.equal((await f.call('/api/postcards','POST',{body:'No session'},author.cookie)).status,401);
 assert.equal((await f.call('/api/auth/login','POST',{handle:'writer',password:'Incorrect long passphrase'})).status,401);
});
