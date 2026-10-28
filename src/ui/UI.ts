import { PLACES, type Place } from '../world/World';

function el<T extends HTMLElement>(id: string): T {
  const node=document.getElementById(id);
  if(!node)throw new Error(`Missing interface element: #${id}`);
  return node as T;
}

export interface UIActions {
  navigate:(id:string)=>void;
  action:(id:string)=>void;
  zoom:(factor:number)=>void;
  resetCamera:()=>void;
  night:(night:boolean)=>void;
  resetProgress:()=>void;
}

export class UI {
  private intro=el<HTMLElement>('intro');
  private panel=el<HTMLElement>('journal');
  private menu=el<HTMLElement>('menu');
  private story=el<HTMLElement>('story');
  private toast=el<HTMLElement>('toast');
  private hover=el<HTMLElement>('hover-label');
  private count=el<HTMLElement>('count');
  private night=false;
  private selected='';
  private discovered=new Set<string>();
  private toastTimer=0;
  private storyAction=el<HTMLButtonElement>('story-action');

  constructor(private actions:UIActions){
    el('explore-button').addEventListener('click',()=>this.dismissIntro());
    el('menu-button').addEventListener('click',()=>this.togglePanel(this.menu));
    el('journal-button').addEventListener('click',()=>this.togglePanel(this.panel));
    el('close-menu').addEventListener('click',()=>this.menu.classList.add('hidden'));
    el('close-journal').addEventListener('click',()=>this.panel.classList.add('hidden'));
    el('story-close').addEventListener('click',()=>this.hideStory());
    el('day-button').addEventListener('click',()=>{
      this.night=!this.night;
      document.body.classList.toggle('night',this.night);
      el('day-button').textContent=this.night?'☾':'☀';
      el('day-button').setAttribute('aria-label',this.night?'Switch to daytime':'Switch to nighttime');
      this.actions.night(this.night);
      this.showToast(this.night?'A little starlight for your journey ✧':'Here comes the sunshine ☀');
    });
    el('reset-camera').addEventListener('click',()=>this.actions.resetCamera());
    el('zoom-in').addEventListener('click',()=>this.actions.zoom(.77));
    el('zoom-out').addEventListener('click',()=>this.actions.zoom(1.3));
    el('reset-progress').addEventListener('click',()=>{
      this.actions.resetProgress();this.discovered.clear();this.renderJournal();this.updateCount();
      this.menu.classList.add('hidden');this.hideStory();this.showToast('A fresh little adventure begins. ✿');
    });
    this.storyAction.addEventListener('click',()=>{
      if(this.selected)this.actions.action(this.selected);
      this.hideStory();
    });
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'){this.closePanels();this.hideStory();}
      if(e.key.toLowerCase()==='j'&&e.target===document.body)this.togglePanel(this.panel);
    });
    this.renderJournal();
    this.updateCount();
  }

  initialize(discovered:Set<string>):void {
    this.discovered=new Set(discovered);
    this.renderJournal();this.updateCount();
    if(this.discovered.size>0) this.dismissIntro();
  }

  dismissIntro():void {
    this.intro.classList.add('dismissed');
    el('tip').classList.add('show');
  }

  private closePanels():void {this.panel.classList.add('hidden');this.menu.classList.add('hidden');}
  private togglePanel(target:HTMLElement):void {
    const isHidden=target.classList.contains('hidden');
    this.closePanels();this.hideStory();this.dismissIntro();
    if(isHidden)target.classList.remove('hidden');
  }

  private updateCount():void {
    this.count.textContent=`${this.discovered.size} / ${PLACES.length}`;
    if(this.discovered.size===PLACES.length){
      el('journal-button').classList.add('complete');
    }else el('journal-button').classList.remove('complete');
  }

  private renderJournal():void {
    const items=el<HTMLElement>('journal-items');items.replaceChildren();
    for(const p of PLACES){
      const found=this.discovered.has(p.id);
      const row=document.createElement('button');
      row.className='journal-row'+(found?' found':'');
      const icon=document.createElement('span');icon.className='journal-icon';icon.textContent=found?p.icon:'?';
      const words=document.createElement('span');words.className='journal-row-text';
      const title=document.createElement('strong');title.textContent=found?p.title:'A hidden wonder';
      const caption=document.createElement('small');caption.textContent=found?p.subtitle:'Somewhere on the planet...';
      words.append(title,caption);
      const arrow=document.createElement('span');arrow.className='journal-arrow';arrow.textContent='↗';
      row.append(icon,words,arrow);
      row.addEventListener('click',()=>{
        this.dismissIntro();
        if(!found){this.showToast('This little wonder is still waiting to be found. ✦');return;}
        this.panel.classList.add('hidden');this.actions.navigate(p.id);
      });
      items.append(row);
    }
  }

  showDiscovery(place:Place,isNew:boolean):void {
    this.closePanels();this.dismissIntro();
    this.selected=place.id;
    this.discovered.add(place.id);this.updateCount();this.renderJournal();
    el('story-kicker').textContent=isNew?'✦ WONDER DISCOVERED':'A LITTLE WONDER';
    el('story-title').textContent=place.title;
    el('story-description').textContent=place.description;
    this.storyAction.innerHTML='';
    const text=document.createTextNode(place.action+' ');
    const arrow=document.createElement('span');arrow.textContent='↗';
    this.storyAction.append(text,arrow);
    this.story.classList.remove('hidden');
    if(isNew){
      this.showToast(this.discovered.size===PLACES.length?'You found all six wonders! Your little world is complete. ♡':`A new little wonder! ${this.discovered.size} of ${PLACES.length} found ✦`);
    }
  }

  hideStory():void {this.story.classList.add('hidden');}

  showToast(message:string):void {
    window.clearTimeout(this.toastTimer);
    this.toast.textContent=message;this.toast.classList.remove('hidden');
    this.toastTimer=window.setTimeout(()=>this.toast.classList.add('hidden'),2900);
  }

  showHover(place:Place|undefined,x:number,y:number):void {
    if(!place){this.hover.classList.add('hidden');return;}
    this.hover.textContent='✦ '+place.title;
    this.hover.style.left=Math.min(window.innerWidth-160,x+14)+'px';
    this.hover.style.top=Math.min(window.innerHeight-55,y-30)+'px';
    this.hover.classList.remove('hidden');
  }
}
