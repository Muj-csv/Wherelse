import { BENCH_SCENES, FLOWERS, NOTE_LIMIT, clearBenchMemory, readBenchMemory, saveBenchMemory,
  type BenchMemory, type BenchMood, type FlowerColor, type MemoryStorage, type StoryChoice } from '../story/bench';

export class Bench {
  private dialog = document.querySelector<HTMLDialogElement>('#bench')!;
  private memory: BenchMemory | null = null;
  private mood: BenchMood = 'company';
  private storyChoice: StoryChoice | null = null;
  private flower: FlowerColor = 'peach';
  private note = document.querySelector<HTMLTextAreaElement>('#bench-note')!;
  private remember = document.querySelector<HTMLInputElement>('#remember-note')!;
  private status = document.querySelector<HTMLElement>('#bench-status')!;
  private returnFocus: HTMLElement | null = null;
  private storage: MemoryStorage;

  constructor(private actions: {
    mood: (mood: BenchMood) => void;
    flower: (flower: FlowerColor | null) => void;
  }) {
    // Access to localStorage itself can throw in restricted browsing contexts.
    try { this.storage = window.localStorage; }
    catch { this.storage = { getItem: () => null, setItem: () => { throw new Error('Storage unavailable'); }, removeItem: () => { throw new Error('Storage unavailable'); } }; }
    this.memory = readBenchMemory(this.storage);
    this.actions.flower(this.memory?.flower ?? null);
    this.dialog.querySelector<HTMLButtonElement>('#bench-close')!.onclick = () => this.dialog.close();
    this.dialog.querySelector<HTMLButtonElement>('#bench-leave')!.onclick = () => this.dialog.close();
    this.dialog.addEventListener('close', () => {
      document.body.classList.remove('bench-open');
      window.dispatchEvent(new Event('resize'));
      this.note.value = '';
      this.returnFocus?.focus();
    });
    this.dialog.addEventListener('keydown', event => {
      if(event.key==='Escape'){
        event.preventDefault();event.stopPropagation();this.dialog.close();return;
      }
      if(event.key!=='Tab')return;
      const controls=[...this.dialog.querySelectorAll<HTMLElement>('button,input,textarea,summary')]
        .filter(control=>control.getClientRects().length>0);
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    });
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-mood]').forEach(button => {
      button.onclick = () => this.chooseMood(button.dataset.mood as BenchMood);
    });
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-story-choice]').forEach(button => {
      button.onclick = () => {
        this.storyChoice = button.dataset.storyChoice as StoryChoice;
        this.showScene(this.storyChoice);
        this.setPressed('[data-story-choice]', 'storyChoice', this.storyChoice);
      };
    });
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-flower]').forEach(button => {
      button.onclick = () => {
        this.flower = button.dataset.flower as FlowerColor;
        this.setPressed('[data-flower]', 'flower', this.flower);
      };
    });
    this.note.maxLength = NOTE_LIMIT;
    this.note.oninput = () => {
      document.querySelector('#note-count')!.textContent = `${this.note.value.length} / ${NOTE_LIMIT}`;
      this.status.textContent = '';
    };
    document.querySelector<HTMLButtonElement>('#bench-save')!.onclick = () => this.save();
    document.querySelector<HTMLButtonElement>('#bench-forget')!.onclick = () => this.forget();
  }

  open(returnFocus: HTMLElement): void {
    if (this.dialog.open) return;
    this.returnFocus = returnFocus;
    this.note.value = this.memory?.note ?? '';
    this.remember.checked = !!this.memory?.note;
    this.flower = this.memory?.flower ?? 'peach';
    this.setPressed('[data-flower]', 'flower', this.flower);
    document.querySelector('#note-count')!.textContent = `${this.note.value.length} / ${NOTE_LIMIT}`;
    this.status.textContent = '';
    this.updateMemoryLabel();
    this.chooseMood(this.memory?.mood ?? 'company');
    if(this.memory?.mood==='story'&&this.memory.storyChoice){
      this.storyChoice=this.memory.storyChoice;
      this.showScene(this.storyChoice);
      this.setPressed('[data-story-choice]','storyChoice',this.storyChoice);
    }
    document.body.classList.add('bench-open');
    window.dispatchEvent(new Event('resize'));
    this.dialog.showModal();
  }

  private chooseMood(mood: BenchMood): void {
    this.mood = mood;
    this.storyChoice = null;
    this.setPressed('[data-mood]', 'mood', mood);
    this.setPressed('[data-story-choice]', 'storyChoice', '');
    document.querySelector<HTMLElement>('#bench-story-choices')!.hidden = mood !== 'story';
    this.showScene(mood);
    this.actions.mood(mood);
    this.status.textContent = '';
  }

  private showScene(id: keyof typeof BENCH_SCENES): void {
    const scene = BENCH_SCENES[id];
    document.querySelector('#bench-scene-title')!.textContent = scene.title;
    document.querySelector('#bench-scene-text')!.textContent = scene.text;
  }

  private setPressed(selector: string, key: string, value: string): void {
    this.dialog.querySelectorAll<HTMLButtonElement>(selector).forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset[key] === value));
    });
  }

  private save(): void {
    this.memory = { version: 1, mood: this.mood, storyChoice: this.storyChoice, flower: this.flower,
      note: this.remember.checked ? this.note.value.trim().slice(0, NOTE_LIMIT) : '' };
    const saved = saveBenchMemory(this.storage, this.memory);
    this.actions.flower(this.flower);
    this.updateMemoryLabel();
    this.status.textContent = saved
      ? `Your ${FLOWERS[this.flower].label.toLowerCase()} flower will be here next time on this browser.${this.memory.note ? ' Your note was saved here too.' : ' Your words were not saved.'}`
      : 'Your flower is here for this visit. This browser could not save your changes. An older saved flower or note may still be here when you return.';
  }

  private forget(): void {
    const cleared = clearBenchMemory(this.storage);
    this.memory = null;
    this.note.value = '';
    this.remember.checked = false;
    document.querySelector('#note-count')!.textContent = `0 / ${NOTE_LIMIT}`;
    this.actions.flower(null);
    this.updateMemoryLabel();
    this.status.textContent = cleared ? 'Your saved flower and note have been removed from this browser.'
      : 'Cleared for this visit, but this browser could not delete its saved copy. Clear this site’s browser data to remove it.';
  }

  private updateMemoryLabel(): void {
    document.querySelector('#bench-memory')!.textContent = this.memory
      ? `A ${FLOWERS[this.memory.flower].label.toLowerCase()} flower from your last pause is beside the bench.`
      : 'A seat is waiting. Nothing to catch up on.';
  }
}
