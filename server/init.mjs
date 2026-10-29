import { mkdirSync,writeFileSync,existsSync,chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
const dir=resolve(process.env.COMMUNITY_DATA_DIR||'.community');
mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700);
const file=resolve(dir,'invitations.json');
if(!existsSync(file))writeFileSync(file,JSON.stringify({member:randomBytes(18).toString('hex'),moderator:randomBytes(32).toString('hex')},null,2),{mode:0o600,flag:'wx'});
chmodSync(file,0o600);
console.log('Private invitation configuration is ready in the community data directory. Codes were not printed. Keep this directory outside version control.');
