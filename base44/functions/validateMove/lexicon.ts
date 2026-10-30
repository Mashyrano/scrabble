// Word checking. Words of 2–4 letters are bundled, so the plays that make up most
// of a game are checked instantly with no network call. Longer words go to an
// online dictionary. Strict mode: anything the dictionaries cannot verify is
// refused, and abbreviations and acronyms are never playable.

import { SHORT_WORDS } from './words.ts';

// Abbreviations and acronyms are not playable words, even if a dictionary lists them.
const NOT_WORDS = new Set([
  'PG', 'RPG', 'KNI', 'VI', 'DJ', 'TV', 'PC', 'CD', 'AC', 'DC', 'HQ', 'FBI', 'CIA',
  'ATM', 'GPS', 'USB', 'URL', 'ASAP', 'LOL', 'BBQ', 'UFO', 'DIY', 'GPA', 'NY', 'UK',
  'USA', 'MR', 'MRS', 'DR', 'ST', 'RD', 'AVE', 'EG', 'IE', 'NB', 'PS', 'VS',
]);

const cache = new Map();

// Wiktionary-backed dictionary: 404 means the word does not exist.
async function fromDictionaryApi(word) {
  const res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word), {
    signal: AbortSignal.timeout(7000),
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error('dictionary ' + res.status);
  const data = await res.json();
  return Array.isArray(data) && data.length > 0;
}

// Corpus-based fallback; it also returns near matches, so the spelling must match exactly.
async function fromDatamuse(word) {
  const res = await fetch('https://api.datamuse.com/words?max=1&sp=' + encodeURIComponent(word), {
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) throw new Error('datamuse ' + res.status);
  const data = await res.json();
  if (!Array.isArray(data)) return false;
  const target = String(word).toLowerCase();
  return data.some((entry) => String((entry && entry.word) || '').toLowerCase() === target);
}

// true, false, or null when no dictionary could be reached.
async function lookup(word) {
  const cached = cache.get(word);
  if (cached !== undefined) return cached;
  if (NOT_WORDS.has(word)) {
    cache.set(word, false);
    return false;
  }
  if (SHORT_WORDS.has(word)) {
    cache.set(word, true);
    return true;
  }
  try {
    const found = await fromDictionaryApi(word);
    cache.set(word, found);
    return found;
  } catch (error) {
    console.error('dictionary failed', error.message);
  }
  try {
    const found = await fromDatamuse(word);
    cache.set(word, found);
    return found;
  } catch (error) {
    console.error('datamuse failed', error.message);
  }
  return null;
}

// Returns { unknown, unchecked } for a turn's words.
export async function checkWords(words) {
  const unique = Array.from(new Set(words.map((word) => String(word || '').toUpperCase()))).filter((word) => word.length > 1);
  const results = await Promise.all(unique.map((word) => lookup(word)));
  const unknown = [];
  const unchecked = [];
  unique.forEach((word, index) => {
    // Strict: a word no dictionary could reach is refused, not waved through.
    if (results[index] === false || results[index] === null) unknown.push(word);
  });
  return { unknown, unchecked: [] };
}