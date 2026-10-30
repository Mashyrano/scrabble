// Move analyser: shape checks, word formation and scoring with board multipliers.
// Bundled with the validator (function deployments cannot import across folders).

const BOARD_SIZE = 15;
const RACK_SIZE = 7;
const BINGO_BONUS = 50;

// T = triple word, D = double word, t = triple letter, d = double letter, C = centre
const LAYOUT = [
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

const LETTER_VALUES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
};

const isInside = (value) => Number.isInteger(value) && value >= 0 && value <= BOARD_SIZE - 1;

function letterPoints(letter) {
  return LETTER_VALUES[String(letter || '').toUpperCase()] || 0;
}

function scoreCells(cells) {
  let sum = 0;
  let multiplier = 1;
  for (const cell of cells) {
    let value = cell.blank ? 0 : letterPoints(cell.letter);
    if (cell.isNew) {
      const tier = LAYOUT[cell.y][cell.x];
      if (tier === 'd') value *= 2;
      else if (tier === 't') value *= 3;
      else if (tier === 'D') multiplier *= 2;
      else if (tier === 'T') multiplier *= 3;
      else if (tier === 'C') multiplier *= 2;
    }
    sum += value;
  }
  return sum * multiplier;
}

function walk(work, startX, startY, dx, dy) {
  const cells = [];
  let x = startX;
  let y = startY;
  while (isInside(x) && isInside(y) && work[y][x]) {
    const cell = work[y][x];
    cells.push({ x, y, letter: cell.letter, blank: !!cell.blank, isNew: !!cell.isNew });
    x += dx;
    y += dy;
  }
  return cells;
}

export function analyzeMove(options) {
  const board = options.board;
  const placements = options.placements;
  const isFirstMove = !!options.isFirstMove;

  if (!Array.isArray(placements) || placements.length === 0) {
    return { ok: false, error: 'Place at least one tile before playing.' };
  }
  if (placements.length > RACK_SIZE) {
    return { ok: false, error: 'A move can use at most seven tiles.' };
  }

  const seen = [];
  for (const placement of placements) {
    const x = Number(placement.x);
    const y = Number(placement.y);
    if (!isInside(x) || !isInside(y)) return { ok: false, error: 'That square is off the board.' };
    const key = `${x},${y}`;
    if (seen.includes(key)) return { ok: false, error: 'Two tiles were placed on the same square.' };
    seen.push(key);
    if (board[y][x]) return { ok: false, error: 'That square is already taken.' };
    if (!/^[A-Z]$/.test(String(placement.letter || ''))) {
      return { ok: false, error: 'A placed tile is missing its letter.' };
    }
  }

  const firstY = Number(placements[0].y);
  const firstX = Number(placements[0].x);
  const sameRow = placements.every((p) => Number(p.y) === firstY);
  const sameColumn = placements.every((p) => Number(p.x) === firstX);
  if (!sameRow && !sameColumn) {
    return { ok: false, error: 'Tiles must all be placed in one straight line.' };
  }

  const work = board.map((row) => row.slice());
  for (const placement of placements) {
    work[Number(placement.y)][Number(placement.x)] = {
      letter: String(placement.letter).toUpperCase(),
      blank: !!placement.blank,
      isNew: true,
    };
  }

  let horizontal = true;
  if (!sameRow && sameColumn) horizontal = false;
  if (placements.length === 1) {
    const above = firstY > 0 && work[firstY - 1][firstX];
    const below = firstY < BOARD_SIZE - 1 && work[firstY + 1][firstX];
    const left = firstX > 0 && work[firstY][firstX - 1];
    const right = firstX < BOARD_SIZE - 1 && work[firstY][firstX + 1];
    horizontal = !!(left || right) || !(above || below);
  }

  const fixed = horizontal ? firstY : firstX;
  const positions = placements.map((p) => (horizontal ? Number(p.x) : Number(p.y)));
  const low = Math.min(...positions);
  const high = Math.max(...positions);
  const cellAt = (position) => (horizontal ? work[fixed][position] : work[position][fixed]);

  // The word runs through any tiles already sitting beside the new ones.
  let from = low;
  while (from - 1 >= 0 && cellAt(from - 1)) from -= 1;
  let to = high;
  while (to + 1 <= BOARD_SIZE - 1 && cellAt(to + 1)) to += 1;

  const mainCells = [];
  let step = from;
  while (step <= to) {
    const x = horizontal ? step : fixed;
    const y = horizontal ? fixed : step;
    const cell = work[y][x];
    if (!cell) return { ok: false, error: 'Your tiles must join together without gaps.' };
    mainCells.push({ x, y, letter: cell.letter, blank: !!cell.blank, isNew: !!cell.isNew });
    step += 1;
  }
  if (mainCells.length < 2) return { ok: false, error: 'A word must be at least two letters long.' };

  if (isFirstMove) {
    const coversCentre = mainCells.some((c) => c.x === 7 && c.y === 7);
    if (!coversCentre) return { ok: false, error: 'The first word must cover the centre square.' };
  } else {
    const attached = placements.some((p) => {
      const x = Number(p.x);
      const y = Number(p.y);
      const up = y > 0 && board[y - 1][x];
      const down = y < BOARD_SIZE - 1 && board[y + 1][x];
      const left = x > 0 && board[y][x - 1];
      const right = x < BOARD_SIZE - 1 && board[y][x + 1];
      return !!(up || down || left || right);
    });
    if (!attached) return { ok: false, error: 'Your word must connect to tiles already on the board.' };
  }

  const groups = [mainCells];
  for (const placement of placements) {
    const x = Number(placement.x);
    const y = Number(placement.y);
    let cells;
    if (horizontal) {
      cells = walk(work, x, y, 0, -1).reverse().concat(walk(work, x, y + 1, 0, 1));
    } else {
      cells = walk(work, x, y, -1, 0).reverse().concat(walk(work, x + 1, y, 1, 0));
    }
    if (cells.length > 1) groups.push(cells);
  }

  const words = groups.map((cells) => ({
    word: cells.map((c) => c.letter).join(''),
    score: scoreCells(cells),
  }));

  const bingo = placements.length === RACK_SIZE;
  const total = words.reduce((sum, word) => sum + word.score, 0) + (bingo ? BINGO_BONUS : 0);

  return {
    ok: true,
    error: null,
    words,
    total,
    bingo,
    played: placements.map((p) => ({ x: Number(p.x), y: Number(p.y) })),
  };
}