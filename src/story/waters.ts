import type { MemoryStorage } from './bench';
export const WATERS_KEY = 'little-elsewhere-waters-v1';
export function readThought(storage: MemoryStorage | null): string {
  try {
    const data: unknown = JSON.parse(storage?.getItem(WATERS_KEY) || 'null');
    if (data && typeof data === 'object' && 'version' in data && data.version === 1 && 'note' in data && typeof data.note === 'string' && data.note.length <= 280) return data.note;
  } catch { /* Optional local storage. */ }
  return '';
}
export function keepThought(storage: MemoryStorage | null, note: string): boolean {
  try {
    if (!storage || !note.trim() || note.length > 280) return false;
    storage.setItem(WATERS_KEY, JSON.stringify({ version: 1, note: note.trim() }));
    return true;
  } catch { return false; }
}
export function releaseThought(storage: MemoryStorage | null): boolean {
  try { if (!storage) return false; storage.removeItem(WATERS_KEY); return true; }
  catch { return false; }
}
