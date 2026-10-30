// Values the live room needs: dealing tiles and settling the final scores.
// The move analyser lives beside the validator function, which bundles its own
// copy (function deployments cannot reach into this folder).

export const RACK_SIZE = 7;

export const LETTER_VALUES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
};

// Standard 100-tile distribution; blanks are stored as an empty letter.
export const DISTRIBUTION = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2,
  N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1, _: 2,
};

export const BINGO_BONUS = 50;

export function letterPoints(letter) {
  return LETTER_VALUES[String(letter || '').toUpperCase()] || 0;
}

export function createBoard() {
  return Array.from({ length: 15 }, () => Array(15).fill(null));
}

export function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = items[i];
    items[i] = items[j];
    items[j] = swap;
  }
  return items;
}

export function makeBag() {
  const letters = [];
  for (const [letter, count] of Object.entries(DISTRIBUTION)) {
    letters.push(...Array(count).fill(letter === '_' ? '' : letter));
  }
  return shuffle(letters);
}