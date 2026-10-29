import { activityDialog } from './dialog';
type Member={id:string;handle:string;role:'member'|'moderator'};
type Post={id:string;authorId:string;handle:string;body:string;audience:'private'|'community';status:string;mine:boolean;reaction:string|null};
type Review={id:string;body:string;handle:string};
type Report={id:string;postId:string|null;reason:string;reporter:string;body:string|null};

export class Community {
  private modal=activityDialog('community','The postcard garden',`
    <p class="activity-lead">Small words. A little connection. An invited student pilot, with room to simply read.</p>
    <details class="community-rules"><summary>How this space works</summary><p>Share ordinary moments, encouragement, or a small creation in words. Be kind. Keep real names, contact details, school IDs and other people's private stories out of postcards.</p><p>Community postcards are reviewed before appearing. Reports go to a human moderator; this space is not continuously monitored or an emergency service. For urgent support, contact someone you trust or local emergency services.</p><p>Only me postcards are stored on this service and hidden from other members and the moderator interface. The service operator can access the database. Your private bench and water writing is never copied here.</p></details>
    <p id="community-status" class="activity-status" role="status"></p>
    <section id="community-auth"><h3>A small circle, at your pace.</h3><form id="community-auth-form">
      <label for="community-handle">Alias <span class="optional">3–24 letters, numbers, _ or -</span></label><input id="community-handle" autocomplete="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,23}">
      <label for="community-password">Passphrase <span class="optional">12–128 characters</span></label><input id="community-password" type="password" autocomplete="current-password" required minlength="12" maxlength="128">
      <div id="community-invite-field" hidden><label for="community-invite">Invitation code</label><input id="community-invite" type="password" autocomplete="off"></div>
      <p class="privacy-note">An account is only needed for postcards. Use an alias, not a real name. This pilot does not provide email password recovery.</p>
      <div class="activity-actions"><button class="primary-button" id="community-auth-submit">Sign in</button><button type="button" class="wander-button" id="community-auth-switch">Join with an invitation</button></div>
    </form></section>
    <section id="community-member" hidden><div class="community-member-heading"><p id="community-identity"></p><button id="community-logout" class="wander-button">Sign out</button></div>
      <form id="postcard-form"><label for="postcard-body">A postcard from your day <span class="optional">500 characters</span></label><textarea id="postcard-body" maxlength="500" required rows="3" placeholder="Something ordinary, something kind…"></textarea>
      <label for="postcard-audience">Who can see this?</label><select id="postcard-audience"><option value="private">Only me · saved on this service</option><option value="community">Invited community · after moderator review</option></select>
      <button class="primary-button" id="postcard-preview">Review my postcard</button></form>
      <section id="postcard-review" class="postcard-review" hidden><h3>Before you send</h3><p id="postcard-review-body"></p><p id="postcard-review-audience"></p><button id="postcard-confirm" class="primary-button">Confirm</button><button id="postcard-cancel" class="wander-button">Keep editing</button></section>
      <div class="community-feed-heading"><h3>Postcards &amp; your private notes</h3><button id="community-refresh" class="wander-button">Refresh</button></div><div id="postcard-feed"></div>
      <details><summary>Blocked members</summary><div id="community-blocks"></div></details>
      <section id="community-moderation" hidden><h3>Moderator desk</h3><p class="privacy-note">Review community submissions against the space's rules. Private postcards are not shown here.</p><div id="moderation-pending"></div><h3>Reports</h3><div id="moderation-reports"></div></section>
      <details class="account-delete"><summary>Leave this community</summary><p class="privacy-note">Deleting your account removes your postcards, responses and sign-in sessions from the live service. This does not clear your solo-world browser saves.</p><label class="check-label"><input id="delete-account-confirm" type="checkbox"> Delete my account and all my postcards</label><button id="delete-account" class="forget-button" disabled>Delete my account</button></details>
    </section>`);
  private user:Member|null=null;
  private joining=false;
  private draft:{body:string;audience:string}|null=null;
  private busy=false;
  private q<T extends HTMLElement=HTMLElement>(selector:string):T{return this.modal.dialog.querySelector<T>(selector)!;}
  constructor(){
    this.q<HTMLFormElement>('#community-auth-form').onsubmit=event=>{
      event.preventDefault();void this.perform(async()=>{
        const result=await this.api<{user:Member}>(`/api/auth/${this.joining?'register':'login'}`,'POST',{
          handle:this.q<HTMLInputElement>('#community-handle').value,password:this.q<HTMLInputElement>('#community-password').value,invite:this.q<HTMLInputElement>('#community-invite').value,
        });
        this.user=result.user;this.q<HTMLInputElement>('#community-password').value='';this.q<HTMLInputElement>('#community-invite').value='';
        await this.refresh();this.say('Welcome. There is no need to post to belong here.');
      });
    };
    this.q('#community-auth-switch').onclick=()=>{
      this.joining=!this.joining;this.q('#community-invite-field').hidden=!this.joining;
      this.q<HTMLInputElement>('#community-invite').required=this.joining;
      this.q<HTMLInputElement>('#community-password').autocomplete=this.joining?'new-password':'current-password';
      this.q('#community-auth-submit').textContent=this.joining?'Join the pilot':'Sign in';
      this.q('#community-auth-switch').textContent=this.joining?'I already have an account':'Join with an invitation';
    };
    this.q('#community-logout').onclick=()=>void this.perform(async()=>{await this.api('/api/auth/logout','POST',{});this.clearDraft();await this.refresh();this.say('Signed out. Your private solo world is still here.');});
    this.q<HTMLFormElement>('#postcard-form').onsubmit=event=>{
      event.preventDefault();const text=this.q<HTMLTextAreaElement>('#postcard-body').value.trim();if(!text)return;
      this.draft={body:text,audience:this.q<HTMLSelectElement>('#postcard-audience').value};
      this.q('#postcard-review-body').textContent=text;
      this.q('#postcard-review-audience').textContent=this.draft.audience==='private'?'Audience: Only me. Saved on this community service.':'Audience: Invited community. A moderator must approve it first.';
      this.q('#postcard-confirm').textContent=this.draft.audience==='private'?'Save privately':'Submit for moderator review';
      this.q('#postcard-review').hidden=false;this.q('#postcard-confirm').focus();
    };
    for(const id of ['#postcard-body','#postcard-audience'])this.q(id).oninput=()=>{this.draft=null;this.q('#postcard-review').hidden=true;};
    this.q('#postcard-cancel').onclick=()=>{this.q('#postcard-review').hidden=true;this.draft=null;this.q('#postcard-body').focus();};
    this.q('#postcard-confirm').onclick=()=>void this.perform(async()=>{
      if(!this.draft)return;
      const audience=this.draft.audience;await this.api('/api/postcards','POST',this.draft);this.clearDraft();await this.refresh();
      this.say(audience==='private'?'Your postcard is saved for only you on this service.':'Submitted for review. It is not visible to the community yet.');
    });
    this.q('#community-refresh').onclick=()=>void this.perform(()=>this.refresh());
    this.q<HTMLInputElement>('#delete-account-confirm').onchange=()=>{this.q<HTMLButtonElement>('#delete-account').disabled=!this.q<HTMLInputElement>('#delete-account-confirm').checked;};
    this.q('#delete-account').onclick=()=>void this.perform(async()=>{
      if(!this.q<HTMLInputElement>('#delete-account-confirm').checked)return;
      await this.api('/api/account','DELETE',{});this.clearDraft();await this.refresh();this.say('Your account and postcards were deleted from the live service.');
    });
    this.modal.dialog.addEventListener('close',()=>{
      this.q<HTMLInputElement>('#community-password').value='';this.q<HTMLInputElement>('#community-invite').value='';
    });
  }
  open(trigger:HTMLElement):void{this.modal.open(trigger);void this.perform(async()=>{await this.refresh();this.say(this.user?'A few words, whenever you like.':'Sign in or join with an invitation. Exploring the world needs no account.');});}
  private say(message:string):void{this.q('#community-status').textContent=message;}
  private clearDraft():void{this.draft=null;this.q<HTMLTextAreaElement>('#postcard-body').value='';this.q<HTMLSelectElement>('#postcard-audience').value='private';this.q('#postcard-review').hidden=true;this.q<HTMLInputElement>('#delete-account-confirm').checked=false;this.q<HTMLButtonElement>('#delete-account').disabled=true;}
  private async perform(action:()=>Promise<void>):Promise<void>{
    if(this.busy)return;this.busy=true;this.modal.dialog.setAttribute('aria-busy','true');
    try{await action();}catch(error){this.say(error instanceof Error?error.message:'The garden could not complete that request.');}
    finally{this.busy=false;this.modal.dialog.removeAttribute('aria-busy');}
  }
  private async api<T=unknown>(path:string,method='GET',data?:unknown):Promise<T>{
    let response:Response;
    try{response=await fetch(path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-Requested-With':'Wherelse'},body:data===undefined?undefined:JSON.stringify(data)});}
    catch{throw Error('The postcard garden is unavailable. You can still enjoy the solo world.');}
    if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Postcards need the community service. The solo world is available; see the setup guide to start sharing.');
    const result=await response.json();
    if(!response.ok){
      if(response.status===401){this.user=null;this.clearDraft();this.q('#community-auth').hidden=false;this.q('#community-member').hidden=true;}
      throw Error(result.error||'That request could not be completed.');
    }
    return result as T;
  }
  private async refresh():Promise<void>{
    this.user=(await this.api<{user:Member|null}>('/api/auth/session')).user;
    this.q('#community-auth').hidden=!!this.user;this.q('#community-member').hidden=!this.user;
    if(!this.user){this.q('#postcard-feed').replaceChildren();this.q('#community-blocks').replaceChildren();this.q('#moderation-pending').replaceChildren();this.q('#moderation-reports').replaceChildren();return;}
    this.q('#community-identity').textContent=`Here as ${this.user.handle}${this.user.role==='moderator'?' · moderator':''}`;
    const {posts}=await this.api<{posts:Post[]}>('/api/postcards');this.renderPosts(posts);
    const {blocks}=await this.api<{blocks:{id:string;handle:string}[]}>('/api/blocks');
    const blockList=this.q('#community-blocks');blockList.replaceChildren();
    if(!blocks.length)blockList.textContent='No blocked members.';
    for(const blocked of blocks){const row=document.createElement('p');row.textContent=`${blocked.handle} `;row.append(this.button('Unblock',()=>this.api(`/api/blocks/${blocked.id}`,'DELETE',{})));blockList.append(row);}
    this.q('#community-moderation').hidden=this.user.role!=='moderator';
    if(this.user.role==='moderator')this.renderModeration(await this.api<{pending:Review[];reports:Report[]}>('/api/moderation'));
  }
  private button(label:string,action:()=>Promise<unknown>):HTMLButtonElement{
    const button=document.createElement('button');button.className='card-action';button.textContent=label;
    button.onclick=()=>void this.perform(async()=>{await action();await this.refresh();this.say('Updated.');});return button;
  }
  private renderPosts(posts:Post[]):void{
    const feed=this.q('#postcard-feed');feed.replaceChildren();
    if(!posts.length){const empty=document.createElement('p');empty.className='privacy-note';empty.textContent='A quiet garden for now. Your private postcards and approved community postcards will appear here.';feed.append(empty);}
    for(const post of posts){
      const card=document.createElement('article');card.className='postcard';card.dataset.postId=post.id;
      const by=document.createElement('p');by.className='eyebrow';by.textContent=post.mine?`You · ${post.audience==='private'?'Only me':post.status==='pending'?'Awaiting moderator review':post.status}`:post.handle;
      const text=document.createElement('p');text.className='postcard-text';text.textContent=post.body||'This postcard was removed by a moderator.';
      const actions=document.createElement('div');actions.className='postcard-actions';card.append(by,text,actions);
      if(post.mine){
        actions.append(this.button('Delete postcard',()=>this.api(`/api/postcards/${post.id}`,'DELETE',{})));
        if(post.audience==='community'&&post.body)actions.append(this.button('Move to Only me',()=>this.api(`/api/postcards/${post.id}`,'PATCH',{body:post.body,audience:'private'})));
      }else{
        for(const [kind,label] of [['hear','I hear you'],['thanks','Thank you']]){const button=this.button(label,()=>this.api(`/api/postcards/${post.id}/react`,'POST',{kind}));button.setAttribute('aria-pressed',String(post.reaction===kind));actions.append(button);}
        actions.append(this.button('Block member',()=>this.api('/api/blocks','POST',{userId:post.authorId})));
        const label=document.createElement('label');label.textContent='Report reason';
        const reason=document.createElement('select');reason.setAttribute('aria-label',`Report reason for postcard by ${post.handle}`);
        for(const [value,title] of [['unkind','Unkind or harassing'],['personal-info','Personal information'],['unsafe','Unsafe content'],['other','Other concern']]){const option=document.createElement('option');option.value=value;option.textContent=title;reason.append(option);}
        label.append(reason);actions.append(label,this.button('Report and hide',()=>this.api(`/api/postcards/${post.id}/report`,'POST',{reason:reason.value})));
      }
      feed.append(card);
    }
  }
  private renderModeration(data:{pending:Review[];reports:Report[]}):void{
    const pending=this.q('#moderation-pending'),reports=this.q('#moderation-reports');pending.replaceChildren();reports.replaceChildren();
    if(!data.pending.length)pending.textContent='No postcards awaiting review.';
    if(!data.reports.length)reports.textContent='No open reports.';
    for(const post of data.pending){const card=document.createElement('article');card.className='postcard';const text=document.createElement('p');text.textContent=`${post.handle}: ${post.body}`;card.append(text,this.button('Approve',()=>this.api(`/api/moderation/${post.id}`,'POST',{action:'approve'})),this.button('Reject',()=>this.api(`/api/moderation/${post.id}`,'POST',{action:'reject'})));pending.append(card);}
    for(const report of data.reports){const card=document.createElement('article');card.className='postcard';const text=document.createElement('p');text.textContent=`${report.reason} · reported by ${report.reporter}. ${report.body??'The postcard is no longer shared.'}`;card.append(text);
      if(report.postId&&report.body)card.append(this.button('Remove postcard',()=>this.api(`/api/moderation/${report.postId}`,'POST',{action:'remove'})));
      card.append(this.button('Resolve report',()=>this.api(`/api/reports/${report.id}/resolve`,'POST',{})));reports.append(card);}
  }
}
