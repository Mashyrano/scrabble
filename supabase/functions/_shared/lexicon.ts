// Word checking. The whole ENABLE list is bundled, so every word of every move is
// checked instantly, offline and the same way each time. Abbreviations, acronyms
// and proper nouns are not in it, so they are never playable.

import { WORDS } from './words.ts';

const DICTIONARY = new Set(WORDS.split('\n'));

export function isWord(word) {
  return DICTIONARY.has(String(word || '').toLowerCase());
}

// The words of a turn that are not in the list, upper-cased and without repeats.
export function unknownWords(words) {
  const unique = Array.from(new Set(words.map((word) => String(word || '').toUpperCase()))).filter((word) => word.length > 1);
  return unique.filter((word) => !isWord(word));
}
