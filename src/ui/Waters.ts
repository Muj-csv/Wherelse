import { activityDialog, localStorageOrUnavailable } from './dialog';
import { keepThought, readThought, releaseThought } from '../story/waters';

export class Waters {
  private modal = activityDialog('waters', 'Whispering Waters', `
    <p class="activity-lead">Some thoughts need a place to rest. Some are ready to drift.</p>
    <div class="water-illustration" aria-hidden="true"><span class="paper-boat"><svg viewBox="0 0 74 52" width="74" height="52"><path d="M6 29H68L51 46H23Z" fill="#fff7dc" stroke="#7ca5a4" stroke-width="1.5"/><path d="M34 4V27H61Z" fill="#fffdf1" stroke="#7ca5a4" stroke-width="1.5"/><path d="M6 29L37 38L68 29M37 38V46" fill="none" stroke="#a6bbb0" stroke-width="1.5"/></svg></span><i></i><i></i></div>
    <label for="water-thought">What are you carrying today? <span class="optional">optional · 280 characters</span></label>
    <textarea id="water-thought" maxlength="280" rows="4" placeholder="A worry, a little win, something unfinished…" aria-describedby="water-privacy"></textarea>
    <p id="water-privacy" class="privacy-note">Nothing here is shared or sent to a server. Keep saves only on this browser, without encryption or sync. Anyone using this browser profile may be able to read it.</p>
    <div class="activity-actions"><button id="water-keep" class="primary-button">Keep privately on this browser</button><button id="water-release" class="secondary-button">Release a paper boat</button></div>
    <label class="check-label"><input type="checkbox" id="water-sound"> Gentle water sound <span class="optional">off by default</span></label>
    <p id="water-status" class="activity-status" role="status"></p>
    <button id="water-forget" class="forget-button">Delete saved thought</button>`,true);
  private storage = localStorageOrUnavailable();
  private note = this.modal.dialog.querySelector<HTMLTextAreaElement>('#water-thought')!;
  private status = this.modal.dialog.querySelector<HTMLElement>('#water-status')!;
  private audio: AudioContext | null = null;

  constructor(private launch: () => void) {
    const q = (id: string) => this.modal.dialog.querySelector<HTMLButtonElement>(id)!;
    q('#water-keep').onclick = () => {
      this.status.textContent = !this.note.value.trim() ? 'You can keep this moment without writing anything.'
        : keepThought(this.storage, this.note.value) ? 'Kept on this browser. You can delete it or release it whenever you like.'
        : 'This browser could not save your thought. Your words are still here for this visit.';
    };
    q('#water-release').onclick = () => {
      const removed = releaseThought(this.storage);
      this.note.value = '';
      this.launch();
      this.sound();
      this.status.textContent = removed ? 'The boat carries no saved words. Your thought has been cleared from this browser.'
        : 'The boat carries no words. This browser could not delete an older save; clear this site’s browser data to remove it.';
      this.modal.dialog.classList.remove('boat-released');
      requestAnimationFrame(() => this.modal.dialog.classList.add('boat-released'));
    };
    q('#water-forget').onclick = () => {
      this.note.value = '';
      this.status.textContent = releaseThought(this.storage) ? 'Saved thought deleted from this browser.'
        : 'Could not delete the saved copy. Clear this site’s browser data to remove it.';
    };
    this.modal.dialog.addEventListener('close', () => { this.note.value = ''; this.audio?.suspend().catch(() => {}); });
    this.note.oninput = () => { this.status.textContent = ''; };
  }

  open(trigger: HTMLElement): void {
    this.note.value = readThought(this.storage);
    this.status.textContent = this.note.value ? 'Your privately kept thought is here. It has not been shared.' : 'Writing and saving are both optional.';
    this.modal.dialog.classList.remove('boat-released');
    this.modal.open(trigger);
  }

  private sound(): void {
    if (!this.modal.dialog.querySelector<HTMLInputElement>('#water-sound')!.checked) return;
    try {
      this.audio ??= new AudioContext();
      const audio = this.audio;
      void audio.resume().then(() => {
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(540, audio.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(190, audio.currentTime + .8);
        gain.gain.setValueAtTime(.0001, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(.035, audio.currentTime + .03);
        gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + 1);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(); oscillator.stop(audio.currentTime + 1);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      }).catch(() => { this.status.textContent += ' Sound is unavailable in this browser.'; });
    } catch { this.status.textContent += ' Sound is unavailable in this browser.'; }
  }
}
