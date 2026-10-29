import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash, scrypt as rawScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

const scrypt=promisify(rawScrypt);
const hash=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)));
class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
const fail=(status,message)=>{throw new HttpError(status,message);};
const cleanText=(value,max)=>{
  if(typeof value!=='string'||!value.trim()||value.length>max)fail(400,`Please enter between 1 and ${max} characters.`);
  return value.trim();
};

export function createCommunity({dbPath,origin,inviteCode,moderatorCode,distPath=resolve('dist'),rateLimit=120,maxCards=100}) {
  if(!inviteCode||!moderatorCode||inviteCode===moderatorCode)throw Error('Distinct member and moderator invitation codes are required. Run npm run community:init.');
  const publicURL=new URL(origin);
  if(!['http:','https:'].includes(publicURL.protocol)||publicURL.pathname!=='/'||publicURL.search||publicURL.hash)throw Error('COMMUNITY_ORIGIN must be an HTTP(S) origin.');
  const local=['localhost','127.0.0.1','[::1]'].includes(publicURL.hostname);
  if(!local&&publicURL.protocol!=='https:')throw Error('A public community requires an HTTPS origin.');
  const origins=new Set([publicURL.origin]);
  if(local){origins.add('http://localhost:5173');origins.add('http://127.0.0.1:5173');}
  const db=new DatabaseSync(dbPath);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,handle TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,salt TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('member','moderator')));
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS postcards(id TEXT PRIMARY KEY,author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,audience TEXT NOT NULL CHECK(audience IN ('private','community')),status TEXT NOT NULL CHECK(status IN ('private','pending','approved','rejected','removed')),created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS blocks(blocker TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,blocked TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(blocker,blocked));
    CREATE TABLE IF NOT EXISTS reactions(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,post_id TEXT NOT NULL REFERENCES postcards(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN ('hear','thanks')),PRIMARY KEY(user_id,post_id));
    CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,post_id TEXT REFERENCES postcards(id) ON DELETE SET NULL,reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',created INTEGER NOT NULL,UNIQUE(post_id,reporter_id));
    CREATE TABLE IF NOT EXISTS moderation_log(id TEXT PRIMARY KEY,moderator_id TEXT REFERENCES users(id) ON DELETE SET NULL,post_id TEXT,action TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS postcard_feed ON postcards(audience,status,created);
    CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires);`);
  const run=(sql,...args)=>db.prepare(sql).run(...args);
  const one=(sql,...args)=>db.prepare(sql).get(...args);
  const all=(sql,...args)=>db.prepare(sql).all(...args);
  const buckets=new Map();
  function limit(key,max=rateLimit,window=60_000){
    const now=Date.now();let bucket=buckets.get(key);
    if(!bucket||bucket.until<now){
      if(buckets.size>10_000){for(const [k,b] of buckets)if(b.until<now)buckets.delete(k);if(buckets.size>10_000)fail(429,'Please try again later.');}
      bucket={until:now+window,count:0};buckets.set(key,bucket);
    }
    if(++bucket.count>max)fail(429,'A little pause, please. Try again in a minute.');
  }
  function userFor(req){
    const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('elsewhere_session='))?.slice(18);
    if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
    run('DELETE FROM sessions WHERE expires < ?',Date.now());
    return one('SELECT u.id,u.handle,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires>?',hash(token),Date.now())||null;
  }
  function requireUser(req){const user=userFor(req);if(!user)fail(401,'Sign in to enter the postcard garden.');return user;}
  function requireModerator(req){const user=requireUser(req);if(user.role!=='moderator')fail(403,'Only a community moderator can do this.');return user;}
  function session(res,id){
    const token=randomBytes(32).toString('hex');
    run('INSERT INTO sessions VALUES(?,?,?)',hash(token),id,Date.now()+7*86400000);
    res.setHeader('Set-Cookie',`elsewhere_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${publicURL.protocol==='https:'?'; Secure':''}`);
  }
  function body(req){
    if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'Use JSON for this request.');
    return new Promise((resolveBody,reject)=>{
      let size=0,chunks=[];
      req.on('data',chunk=>{size+=chunk.length;if(size>8192){chunks=[];reject(new HttpError(413,'This request is too large.'));}else chunks.push(chunk);});
      req.on('end',()=>{try{const value=JSON.parse(Buffer.concat(chunks).toString());if(!value||typeof value!=='object'||Array.isArray(value))throw Error();resolveBody(value);}catch{reject(new HttpError(400,'Please check the request.'));}});
      req.on('error',reject);
    });
  }
  function visiblePost(user,id){
    const post=one('SELECT * FROM postcards WHERE id=?',id);
    if(!post)fail(404,'This postcard is no longer here.');
    const blocked=one('SELECT 1 FROM blocks WHERE (blocker=? AND blocked=?) OR (blocker=? AND blocked=?)',user.id,post.author_id,post.author_id,user.id);
    if(blocked||!(post.author_id===user.id||(post.audience==='community'&&post.status==='approved')))fail(404,'This postcard is no longer here.');
    return post;
  }
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const send=(data,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));};
    try{
      const path=new URL(req.url,publicURL).pathname,method=req.method;
      if(!path.startsWith('/api/')){
        if(method!=='GET'&&method!=='HEAD')fail(405,'Method not allowed.');
        let file=resolve(distPath,`.${decodeURIComponent(path==='/'?'/index.html':path)}`);
        if(!file.startsWith(resolve(distPath)+sep))fail(404,'Not found.');
        const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'}[extname(file)];
        if(!mime)fail(404,'Not found.');
        let content;try{content=await readFile(file);}catch{fail(404,'Build the app first with npm run build.');}
        res.setHeader('Content-Type',mime);res.setHeader('Cache-Control',path.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache');res.end(method==='HEAD'?undefined:content);return;
      }
      limit(`request:${req.socket.remoteAddress}`);
      if(!['GET','HEAD'].includes(method)){
        if(!origins.has(req.headers.origin)||req.headers['x-requested-with']!=='Wherelse')fail(403,'This request must come from this community.');
      }
      if(path==='/api/health'&&method==='GET'){send({ready:true,mode:'invited-pilot'});return;}
      if(path==='/api/auth/session'&&method==='GET'){send({user:userFor(req)});return;}
      if(['/api/auth/register','/api/auth/login'].includes(path)&&method==='POST'){
        limit(`auth:${req.socket.remoteAddress}`,20);
        const data=await body(req),handle=cleanText(data.handle,24).toLowerCase();
        if(!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(handle))fail(400,'Use 3–24 letters, numbers, underscores or hyphens for your alias.');
        if(typeof data.password!=='string'||data.password.length<12||data.password.length>128)fail(400,'Use a passphrase of 12–128 characters.');
        let user;
        if(path.endsWith('/register')){
          if(typeof data.invite!=='string'||(!same(data.invite,inviteCode)&&!same(data.invite,moderatorCode)))fail(403,'A valid invitation is needed to join this pilot.');
          if(one('SELECT 1 FROM users WHERE handle=?',handle))fail(409,'That alias is already in use.');
          const id=randomUUID(),salt=randomBytes(16).toString('hex'),passwordHash=Buffer.from(await scrypt(data.password,salt,64)).toString('hex');
          const role=same(data.invite,moderatorCode)?'moderator':'member';
          try{run('INSERT INTO users VALUES(?,?,?,?,?)',id,handle,passwordHash,salt,role);}catch{fail(409,'That alias is already in use.');}
          user={id,handle,role};
        }else{
          const stored=one('SELECT * FROM users WHERE handle=?',handle);
          const computed=Buffer.from(await scrypt(data.password,stored?.salt||'unknown-user-salt',64));
          if(!stored||!timingSafeEqual(computed,Buffer.from(stored.password_hash,'hex')))fail(401,'That alias and passphrase did not match.');
          user={id:stored.id,handle:stored.handle,role:stored.role};
        }
        session(res,user.id);send({user});return;
      }
      if(path==='/api/auth/logout'&&method==='POST'){
        const user=requireUser(req);void user;
        const token=req.headers.cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('elsewhere_session='))?.slice(18);
        if(token)run('DELETE FROM sessions WHERE token_hash=?',hash(token));
        res.setHeader('Set-Cookie','elsewhere_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');send({ok:true});return;
      }
      const user=requireUser(req);
      if(path==='/api/account'&&method==='DELETE'){run('DELETE FROM users WHERE id=?',user.id);res.setHeader('Set-Cookie','elsewhere_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');send({ok:true});return;}
      if(path==='/api/postcards'&&method==='GET'){
        const posts=all(`SELECT p.id,p.author_id AS authorId,u.handle,p.body,p.audience,p.status,p.created,r.kind AS reaction FROM postcards p JOIN users u ON u.id=p.author_id LEFT JOIN reactions r ON r.post_id=p.id AND r.user_id=?
          WHERE (p.author_id=? OR p.id IN (SELECT id FROM postcards WHERE audience='community' AND status='approved' ORDER BY created DESC LIMIT 100))
          AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker=? AND b.blocked=p.author_id) OR (b.blocker=p.author_id AND b.blocked=?))
          AND NOT EXISTS(SELECT 1 FROM reports t WHERE t.post_id=p.id AND t.reporter_id=?) ORDER BY p.created DESC`,user.id,user.id,user.id,user.id,user.id);
        send({posts:posts.map(post=>({...post,mine:post.authorId===user.id}))});return;
      }
      if(path==='/api/postcards'&&method==='POST'){
        limit(`post:${user.id}`,5);const data=await body(req),text=cleanText(data.body,500),audience=data.audience??'private';
        if(!['private','community'].includes(audience))fail(400,'Choose Only me or Community.');
        if(one('SELECT COUNT(*) AS total FROM postcards WHERE author_id=?',user.id).total>=maxCards)fail(400,`Your shelf holds ${maxCards} postcards. Delete an older postcard before adding another.`);
        const id=randomUUID();run('INSERT INTO postcards VALUES(?,?,?,?,?,?)',id,user.id,text,audience,audience==='private'?'private':'pending',Date.now());send({id,status:audience==='private'?'private':'pending'},201);return;
      }
      const cardMatch=path.match(/^\/api\/postcards\/([a-f0-9-]+)(?:\/(report|react))?$/);
      if(cardMatch){
        const [,id,action]=cardMatch;
        const post=visiblePost(user,id);
        if(!action&&method==='GET'){send({post});return;}
        if(!action&&['DELETE','PATCH'].includes(method)){
          if(post.author_id!==user.id)fail(403,'Only the author can change this postcard.');
          if(method==='DELETE'){run('DELETE FROM postcards WHERE id=?',id);send({ok:true});return;}
          const data=await body(req),text=cleanText(data.body,500),audience=data.audience;
          if(!['private','community'].includes(audience))fail(400,'Choose Only me or Community.');
          run('UPDATE postcards SET body=?,audience=?,status=? WHERE id=?',text,audience,audience==='private'?'private':'pending',id);send({ok:true});return;
        }
        if(action&&method==='POST'){
          if(post.author_id===user.id||post.status!=='approved'||post.audience!=='community')fail(400,'Choose a shared postcard from someone else.');
          const data=await body(req);
          if(action==='report'){
            if(!['unkind','personal-info','unsafe','other'].includes(data.reason))fail(400,'Choose a report reason.');
            run('INSERT OR IGNORE INTO reports(id,post_id,reporter_id,reason,created) VALUES(?,?,?,?,?)',randomUUID(),id,user.id,data.reason,Date.now());send({ok:true});return;
          }
          if(!['hear','thanks'].includes(data.kind))fail(400,'Choose a response.');
          run('INSERT INTO reactions VALUES(?,?,?) ON CONFLICT(user_id,post_id) DO UPDATE SET kind=excluded.kind',user.id,id,data.kind);send({ok:true});return;
        }
      }
      if(path==='/api/blocks'&&method==='GET'){send({blocks:all('SELECT u.id,u.handle FROM users u JOIN blocks b ON b.blocked=u.id WHERE b.blocker=?',user.id)});return;}
      if(path==='/api/blocks'&&method==='POST'){
        const data=await body(req);if(typeof data.userId!=='string'||data.userId===user.id||!one('SELECT 1 FROM users WHERE id=?',data.userId))fail(400,'Choose another member.');
        run('INSERT OR IGNORE INTO blocks VALUES(?,?)',user.id,data.userId);send({ok:true});return;
      }
      const unblock=path.match(/^\/api\/blocks\/([a-f0-9-]+)$/);
      if(unblock&&method==='DELETE'){run('DELETE FROM blocks WHERE blocker=? AND blocked=?',user.id,unblock[1]);send({ok:true});return;}
      if(path==='/api/moderation'&&method==='GET'){
        requireModerator(req);
        send({pending:all("SELECT p.id,p.body,u.handle,p.created FROM postcards p JOIN users u ON u.id=p.author_id WHERE p.status='pending' AND p.audience='community' ORDER BY p.created LIMIT 100"),
          reports:all("SELECT r.id,r.post_id AS postId,r.reason,u.handle AS reporter,p.status,CASE WHEN p.audience='community' THEN p.body ELSE NULL END AS body FROM reports r JOIN users u ON u.id=r.reporter_id LEFT JOIN postcards p ON p.id=r.post_id WHERE r.status='open' ORDER BY r.created LIMIT 100")});return;
      }
      const moderation=path.match(/^\/api\/moderation\/([a-f0-9-]+)$/);
      if(moderation&&method==='POST'){
        const moderator=requireModerator(req),data=await body(req),id=moderation[1];
        if(!['approve','reject','remove'].includes(data.action))fail(400,'Choose approve, reject, or remove.');
        const card=one("SELECT * FROM postcards WHERE id=? AND audience='community'",id);
        if(!card)fail(404,'This shared postcard is no longer here.');
        if(data.action!=='remove'&&card.status!=='pending')fail(409,'This postcard has already been reviewed.');
        const status={approve:'approved',reject:'rejected',remove:'removed'}[data.action];
        db.exec('BEGIN');
        try{
          run('UPDATE postcards SET status=?,body=? WHERE id=?',status,data.action==='remove'?'':card.body,id);
          run("UPDATE reports SET status='resolved' WHERE post_id=?",id);
          run('INSERT INTO moderation_log VALUES(?,?,?,?,?)',randomUUID(),moderator.id,id,data.action,Date.now());db.exec('COMMIT');
        }catch(error){db.exec('ROLLBACK');throw error;}
        send({ok:true});return;
      }
      const resolveReport=path.match(/^\/api\/reports\/([a-f0-9-]+)\/resolve$/);
      if(resolveReport&&method==='POST'){requireModerator(req);run("UPDATE reports SET status='resolved' WHERE id=?",resolveReport[1]);send({ok:true});return;}
      fail(404,'Not found.');
    }catch(error){if(!res.writableEnded)send({error:error instanceof HttpError?error.message:'The garden could not complete that request. Please try again.'},error instanceof HttpError?error.status:500);}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
  return {server,close:()=>db.close()};
}
