import { PLACES, type Place } from '../world/World';
import { Bench } from './Bench';
import { Waters } from './Waters';
import { Library } from './Library';
import { Community } from './Community';
import { qualityOrDefault,type GraphicsQuality } from '../game/settings';
import { localStorageOrUnavailable } from './dialog';
import type { BenchMood, FlowerColor } from '../story/bench';

function el<T extends HTMLElement>(id: string): T {
  const node=document.getElementById(id);
  if(!node)throw new Error(`Missing interface element: #${id}`);
  return node as T;
}

const PLACE_HINTS:Record<string,string>={
  nook:'A warm cup and a seat beside Pip',
  pond:'Follow the blue water and wooden bridge',
  meadow:'Look for butterflies above the flowers',
  library:'A round little library among the trees',
  grove:'Look for a circle of golden lanterns',
  picnic:'A table tucked beyond the woodland',
};

export interface UIActions {
  navigate:(id:string)=>void;
  action:(id:string)=>void;
  zoom:(factor:number)=>void;
  resetCamera:()=>void;
  night:(night:boolean)=>void;
  resetProgress:()=>void;
  benchMood:(mood:BenchMood)=>void;
  benchFlower:(flower:FlowerColor|null)=>void;
  motion:(reduced:boolean)=>void;
  releaseBoat:()=>void;
  storyMemory:(count:number)=>void;
  quality:(quality:GraphicsQuality)=>void;
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
  private bench:Bench;
  private waters:Waters;
  private library:Library;
  private community:Community;

  constructor(private actions:UIActions){
    this.bench=new Bench({mood:actions.benchMood,flower:actions.benchFlower});
    this.waters=new Waters(actions.releaseBoat);
    this.library=new Library(actions.storyMemory);
    this.community=new Community();
    el('community-button').onclick=()=>{this.closePanels();this.dismissIntro();this.community.open(el('menu-button'));};
    const quality=el<HTMLSelectElement>('graphics-quality');
    let savedQuality:unknown;
    try{savedQuality=localStorageOrUnavailable()?.getItem('little-elsewhere-graphics');}catch{/* Use balanced. */}
    quality.value=qualityOrDefault(savedQuality);actions.quality(quality.value as GraphicsQuality);
    quality.onchange=()=>{
      actions.quality(qualityOrDefault(quality.value));
      try{const storage=localStorageOrUnavailable();if(!storage)throw Error();storage.setItem('little-elsewhere-graphics',quality.value);}
      catch{this.showToast('Graphics changed for this visit. This browser could not save the setting.');}
    };
    el('bench-button').addEventListener('click',()=>{
      this.actions.navigate('nook');
      // Keep the story action visible as the return-focus target after the modal closes.
      this.storyAction.focus();
      this.bench.open(this.storyAction);
    });
    el('explore-button').addEventListener('click',()=>this.dismissIntro());
    const motion=el<HTMLInputElement>('reduce-motion');
    motion.checked=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    motion.addEventListener('change',()=>this.actions.motion(motion.checked));
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{
      motion.checked=e.matches;this.actions.motion(e.matches);
    });
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
      if(this.selected==='nook'){this.bench.open(this.storyAction);return;}
      if(this.selected==='pond'){this.waters.open(this.storyAction);return;}
      if(this.selected==='library'){this.library.open(this.storyAction);return;}
      if(this.selected==='picnic'){this.community.open(this.storyAction);return;}
      if(this.selected)this.actions.action(this.selected);
      this.hideStory();
    });
    document.addEventListener('keydown',e=>{
      if(document.querySelector('dialog[open]'))return;
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
    const first=!document.body.classList.contains('exploring');
    document.body.classList.add('exploring');
    this.intro.classList.add('dismissed');
    el('tip').classList.add('show');
    if(first)window.dispatchEvent(new Event('resize'));
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
      const title=document.createElement('strong');title.textContent=p.title;
      const caption=document.createElement('small');caption.textContent=found?p.subtitle:PLACE_HINTS[p.id];
      words.append(title,caption);
      const arrow=document.createElement('span');arrow.className='journal-arrow';arrow.textContent='→';arrow.setAttribute('aria-hidden','true');
      row.append(icon,words,arrow);
      row.addEventListener('click',()=>{
        this.dismissIntro();
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
    const arrow=document.createElement('span');arrow.textContent='→';arrow.setAttribute('aria-hidden','true');
    this.storyAction.append(text,arrow);
    this.story.classList.remove('hidden');
    this.storyAction.focus({preventScroll:true});
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
