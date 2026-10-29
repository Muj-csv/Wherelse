import { activityDialog,localStorageOrUnavailable } from './dialog';
import { STUDENT_STORIES,readStories,saveStories,storyNode } from '../story/library';

export class Library {
  private modal=activityDialog('library','The Story Tree',`
    <p class="activity-lead">Ordinary student days. A few different ways through them. There are no right endings.</p>
    <div id="library-shelf" class="story-shelf" role="group" aria-label="Choose a student story"></div>
    <section id="library-page" class="library-page" aria-live="polite" aria-atomic="true"><p id="library-theme" class="eyebrow"></p><h3 id="library-node-title"></h3><p id="library-text"></p></section>
    <div id="library-options" class="activity-actions"></div>
    <button id="library-restart" class="wander-button">Try another direction in this story</button>
    <p class="privacy-note">Your reading choices are remembered only on this browser. These are fictional, authored stories, not posts from other students.</p>
    <p id="library-status" class="activity-status" role="status"></p>
    <button id="library-forget" class="forget-button">Forget my reading choices</button>`);
  private storage=localStorageOrUnavailable();
  private memory=readStories(this.storage);
  private selected=STUDENT_STORIES[0];
  constructor(private onRemember:(count:number)=>void){
    const shelf=this.modal.dialog.querySelector('#library-shelf')!;
    for(const story of STUDENT_STORIES){
      const button=document.createElement('button');button.textContent=story.title;button.dataset.story=story.id;
      button.onclick=()=>{this.selected=story;this.render();};shelf.append(button);
    }
    this.modal.dialog.querySelector<HTMLButtonElement>('#library-restart')!.onclick=()=>{this.memory[this.selected.id]=[];this.save();this.render();};
    this.modal.dialog.querySelector<HTMLButtonElement>('#library-forget')!.onclick=()=>{this.memory={};this.save();this.render();};
    this.onRemember(Object.values(this.memory).filter(path=>path.length).length);
  }
  open(trigger:HTMLElement):void{this.render();this.modal.open(trigger);}
  private save():void{
    const saved=saveStories(this.storage,this.memory);
    this.modal.dialog.querySelector('#library-status')!.textContent=saved?'Your reading choices are updated on this browser.':'Your choices last for this visit. This browser could not update its saved copy.';
    this.onRemember(Object.values(this.memory).filter(path=>path.length).length);
  }
  private render():void{
    const path=this.memory[this.selected.id]||[],node=storyNode(this.selected,path);
    this.modal.dialog.querySelectorAll<HTMLButtonElement>('[data-story]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.story===this.selected.id)));
    this.modal.dialog.querySelector('#library-theme')!.textContent=this.selected.theme;
    this.modal.dialog.querySelector('#library-node-title')!.textContent=node.title;
    this.modal.dialog.querySelector('#library-text')!.textContent=node.text;
    const options=this.modal.dialog.querySelector('#library-options')!;options.replaceChildren();
    for(const option of node.options){
      const button=document.createElement('button');button.className='secondary-button';button.textContent=option.label;
      button.onclick=()=>{this.memory[this.selected.id]=[...path,option.next];this.save();this.render();};options.append(button);
    }
  }
}
