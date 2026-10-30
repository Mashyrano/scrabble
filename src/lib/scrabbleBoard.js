// Presentation-only board constants (the authoritative engine lives on the server).

export const BOARD_SIZE = 15;

export const LETTER_VALUES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
};

// T = triple word, D = double word, t = triple letter, d = double letter, C = center
export const BOARD_LAYOUT = [
  'T..d...T...d..T',
  '.D...t...t...D.',
  '..D...d.d...D..',
  'd..D...d...D..d',
  '....D.....D....',
  '.t...t...t...t.',
  '..d...d.d...d..',
  'T..d...C...d..T',
  '..d...d.d...d..',
  '.t...t...t...t.',
  '....D.....D....',
  'd..D...d...D..d',
  '..D...d.d...D..',
  '.D...t...t...D.',
  'T..d...T...d..T',
];

export const MULTIPLIER_LABEL = {
  DL: 'Double letter',
  TL: 'Triple letter',
  DW: 'Double word',
  TW: 'Triple word',
};

export const MULTIPLIER_STYLE = {
  DL: 'bg-mult-dl/25 text-mult-dl',
  TL: 'bg-mult-tl/25 text-mult-tl',
  DW: 'bg-mult-dw/30 text-mult-dw',
  TW: 'bg-mult-tw/30 text-mult-tw',
  C: 'bg-mult-dw/30 text-mult-dw',
};

export const MULTIPLIER_CODE = { DL: 'd', TL: 't', DW: 'D', TW: 'T', C: 'C' };

export function layoutAt(x, y) {
  return BOARD_LAYOUT[y][x];
}

export function tierAt(x, y) {
  const code = layoutAt(x, y);
  if (code === '.') return null;
  return code === 'C' ? 'DW' : { d: 'DL', t: 'TL', D: 'DW', T: 'TW' }[code];
}

export function tilePoints(letter) {
  return LETTER_VALUES[String(letter || '').toUpperCase()] || 0;
}