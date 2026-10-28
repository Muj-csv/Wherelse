import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BENCH_STORAGE_KEY, NOTE_LIMIT, readBenchMemory, saveBenchMemory, clearBenchMemory } from '../src/story/bench.ts';

function storage(initial = null) {
  const values = new Map(initial === null ? [] : [[BENCH_STORAGE_KEY, initial]]);
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

const memory = { version: 1, mood: 'story', storyChoice: 'pause', flower: 'lilac', note: 'One thing at a time.' };

test('a flower, story direction and explicitly saved note survive a new read', () => {
  const local = storage();
  assert.equal(readBenchMemory(local), null);
  assert.equal(saveBenchMemory(local, memory), true);
  assert.deepEqual(readBenchMemory(local), memory);
});

test('removing a keepsake deletes its saved words as well as the flower', () => {
  const local = storage(JSON.stringify(memory));
  assert.equal(clearBenchMemory(local), true);
  assert.equal(local.getItem(BENCH_STORAGE_KEY), null);
  assert.equal(readBenchMemory(local), null);
});

test('malformed, unsupported and structurally invalid saves are ignored', () => {
  const invalid = ['not json', 'null', '[]', JSON.stringify({ ...memory, version: 2 }),
    JSON.stringify({ ...memory, mood: ['quiet'] }), JSON.stringify({ ...memory, mood: 'sad' }),
    JSON.stringify({ ...memory, flower: '__proto__' }), JSON.stringify({ ...memory, flower: 'red' }),
    JSON.stringify({ ...memory, storyChoice: 'unknown' }), JSON.stringify({ ...memory, note: 42 }),
    JSON.stringify({ ...memory, note: 'x'.repeat(NOTE_LIMIT + 1) })];
  for (const value of invalid) assert.equal(readBenchMemory(storage(value)), null, value);
});

test('unavailable storage does not crash the visit and never reports a successful write or deletion', () => {
  const blocked = {
    getItem() { throw new Error('Unavailable'); },
    setItem() { throw new Error('Quota exceeded'); },
    removeItem() { throw new Error('Unavailable'); },
  };
  assert.equal(readBenchMemory(blocked), null);
  assert.equal(saveBenchMemory(blocked, memory), false);
  assert.equal(clearBenchMemory(blocked), false);
});

test('saving a flower without words replaces a previously saved note', () => {
  const local = storage(JSON.stringify(memory));
  saveBenchMemory(local, { ...memory, mood: 'quiet', storyChoice: null, note: '' });
  assert.equal(readBenchMemory(local).note, '');
  assert.equal(readBenchMemory(local).mood, 'quiet');
});
