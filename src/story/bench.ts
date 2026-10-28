export type BenchMood = 'company' | 'quiet' | 'story';
export type StoryChoice = 'pause' | 'reply';
export type FlowerColor = 'peach' | 'lilac' | 'mint';

export const FLOWERS: Record<FlowerColor, { label: string; color: string }> = {
  peach: { label: 'Peach', color: '#efa58b' },
  lilac: { label: 'Lilac', color: '#b4a1df' },
  mint: { label: 'Mint', color: '#86c6ad' },
};

export const BENCH_SCENES = {
  company: {
    title: 'There is room beside me.',
    text: 'Pip moves their cup to make a little space. “A long commute? A full day? Or just a day? You don’t have to explain it to stay.”',
  },
  quiet: {
    title: 'We can just sit.',
    text: 'Pip settles beside you and watches a butterfly pass. No questions, no timer. You can leave whenever you like.',
  },
  story: {
    title: 'The message still unsent',
    text: 'Mira has opened the group-project chat three times. Everyone seems to have a plan. Her message still says “typing…” She closes her laptop for a moment. What might this little pause hold?',
  },
  pause: {
    title: 'A moment can stay unfinished.',
    text: 'Mira puts the kettle on. The message can wait until she has found her words. Pip turns the page without asking for an ending.',
  },
  reply: {
    title: 'One honest line.',
    text: '“I’m not sure where to start. Could we work out the first step together?” Mira saves the draft. Sending it can be a choice for later.',
  },
};

export interface BenchMemory {
  version: 1;
  mood: BenchMood;
  storyChoice: StoryChoice | null;
  flower: FlowerColor;
  note: string;
}

export const BENCH_STORAGE_KEY = 'little-elsewhere-bench-v1';
export const NOTE_LIMIT = 280;
export type MemoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readBenchMemory(storage: MemoryStorage): BenchMemory | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(BENCH_STORAGE_KEY) || 'null');
    if (!value || typeof value !== 'object') return null;
    const m = value as Record<string, unknown>;
    if (m.version !== 1 || typeof m.mood !== 'string' || !['company', 'quiet', 'story'].includes(m.mood) ||
        typeof m.flower !== 'string' || !Object.hasOwn(FLOWERS, m.flower) ||
        ![null, 'pause', 'reply'].includes(m.storyChoice as null | string) ||
        typeof m.note !== 'string' || m.note.length > NOTE_LIMIT) return null;
    return m as unknown as BenchMemory;
  } catch { return null; }
}

export function saveBenchMemory(storage: MemoryStorage, memory: BenchMemory): boolean {
  try {
    storage.setItem(BENCH_STORAGE_KEY, JSON.stringify(memory));
    return true;
  } catch { return false; }
}

export function clearBenchMemory(storage: MemoryStorage): boolean {
  try { storage.removeItem(BENCH_STORAGE_KEY); return true; }
  catch { return false; }
}
