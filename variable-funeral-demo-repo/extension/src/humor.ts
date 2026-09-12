import { DeclKind } from './types';

const GENERIC_CAUSES = [
  'Declared with great expectations, then quietly ignored.',
  'Never used. Not even once. Not even in a comment.',
  'Created during a debugging session and never removed.',
  'Imported but never actually needed.',
  'Built for a feature that was abandoned before launch.',
  'Outlived the code that once relied on it.',
  'A victim of a refactor that forgot to clean up after itself.'
];

const KIND_CAUSES: Partial<Record<DeclKind, string[]>> = {
  import: [
    'Imported "just in case." The case never came.',
    'Pulled in for one function call that got deleted later.'
  ],
  parameter: [
    'Accepted into the function signature but never invited to the body.',
    'Passed in dutifully, referenced never.'
  ],
  function: [
    'Written for a use case that got cut in review.',
    'Called exactly zero times since the day it was born.'
  ],
  class: [
    'Designed with a full inheritance hierarchy in mind. Instantiated: never.'
  ],
  const: ['Declared const — permanent, unchanging, and completely unused.'],
  let: ['Given room to change. Never called upon to do so.'],
  var: ['Old-school, function-scoped, and forgotten in equal measure.']
};

const EPITAPHS = [
  'Here lies {name}. It meant well.',
  '{name} — declared 2024, used never.',
  'In loving memory of {name}, who took up a whole line for nothing.',
  '{name}: gone, but still technically in the source tree.',
  'RIP {name}. The linter warned us.'
];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

/** Deterministic "random" pick based on name + offset, so the same variable
 * always gets the same joke within a session instead of flickering on rescans. */
function seedFor(name: string, offset: number): number {
  let h = offset;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return h;
}

export function causeOfDeath(name: string, kind: DeclKind, offset: number): string {
  const seed = seedFor(name, offset);
  const pool = [...(KIND_CAUSES[kind] ?? []), ...GENERIC_CAUSES];
  return pick(pool, seed);
}

export function epitaph(name: string, offset: number): string {
  const seed = seedFor(name, offset + 1);
  return pick(EPITAPHS, seed).replace(/\{name\}/g, name);
}
