import { BOARD_SIZE, tilePoints, layoutAt } from './scrabbleBoard';

// Live preview of the word(s) a draft move would form. Display only — the room
// is authoritative and re-scores every move.
function scoreCells(cells) {
  let sum = 0;
  let multiplier = 1;
  for (const cell of cells) {
    let value = cell.blank ? 0 : tilePoints(cell.letter);
    if (cell.isNew) {
      const tier = layoutAt(cell.x, cell.y);
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

function walk(board, startX, startY, dx, dy) {
  const cells = [];
  let x = startX;
  let y = startY;
  while (x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE && board[y][x]) {
    const cell = board[y][x];
    cells.push({ x, y, letter: cell.letter, blank: !!cell.blank, isNew: !!cell.isNew });
    x += dx;
    y += dy;
  }
  return cells;
}

export function analyzeDraft(board, draft) {
  const empty = { ok: false, words: [], total: 0, bingo: false, error: null };
  const entries = Object.entries(draft || {});
  if (!board || !entries.length) return empty;

  const placements = entries.map(([key, tile]) => {
    const [x, y] = key.split(',').map(Number);
    return { x, y, letter: tile.letter, blank: !!tile.blank, isNew: true };
  });

  const sameRow = placements.every((p) => p.y === placements[0].y);
  const sameColumn = placements.every((p) => p.x === placements[0].x);
  if (!sameRow && !sameColumn) return { ...empty, error: 'Tiles must be in one straight line.' };

  const work = board.map((row) => row.slice());
  for (const p of placements) work[p.y][p.x] = p;

  let horizontal = true;
  if (placements.length === 1) {
    const { x, y } = placements[0];
    const hasVertical = (y > 0 && work[y - 1][x]) || (y < BOARD_SIZE - 1 && work[y + 1][x]);
    const hasHorizontal = (x > 0 && work[y][x - 1]) || (x < BOARD_SIZE - 1 && work[y][x + 1]);
    horizontal = hasHorizontal || !hasVertical;
  } else horizontal = sameRow;

  const fixed = horizontal ? placements[0].y : placements[0].x;
  const positions = placements.map((p) => (horizontal ? p.x : p.y));
  const low = Math.min(...positions);
  const high = Math.max(...positions);
  const cellAt = (position) => (horizontal ? work[fixed][position] : work[position][fixed]);

  let from = low;
  while (from - 1 >= 0 && cellAt(from - 1)) from -= 1;
  let to = high;
  while (to + 1 <= BOARD_SIZE - 1 && cellAt(to + 1)) to += 1;

  const mainCells = [];
  for (let i = from; i <= to; i += 1) {
    const x = horizontal ? i : fixed;
    const y = horizontal ? fixed : i;
    const cell = work[y][x];
    if (!cell) return { ...empty, error: 'Tiles must join together with no gaps.' };
    mainCells.push({ x, y, letter: cell.letter, blank: !!cell.blank, isNew: !!cell.isNew });
  }
  if (mainCells.length < 2) return { ...empty, error: 'A word needs at least two letters.' };

  const isFirstMove = !board.some((row) => row.some(Boolean));
  if (isFirstMove && !mainCells.some((c) => c.x === 7 && c.y === 7)) {
    return { ...empty, error: 'The first word must cover the centre square.' };
  }
  if (!isFirstMove) {
    const attached = placements.some((p) => {
      const x = p.x;
      const y = p.y;
      return (
        (y > 0 && board[y - 1][x]) ||
        (y < BOARD_SIZE - 1 && board[y + 1][x]) ||
        (x > 0 && board[y][x - 1]) ||
        (x < BOARD_SIZE - 1 && board[y][x + 1])
      );
    });
    if (!attached) return { ...empty, error: 'Your word must connect to the board.' };
  }

  const groups = [mainCells];
  for (const p of placements) {
    const cells = horizontal
      ? walk(work, p.x, p.y, 0, -1).reverse().concat(walk(work, p.x, p.y + 1, 0, 1))
      : walk(work, p.x, p.y, -1, 0).reverse().concat(walk(work, p.x + 1, p.y, 1, 0));
    if (cells.length > 1) groups.push(cells);
  }

  const words = groups.map((cells) => ({
    word: cells.map((c) => c.letter).join(''),
    score: scoreCells(cells),
  }));
  const bingo = placements.length === 7;
  const total = words.reduce((sum, w) => sum + w.score, 0) + (bingo ? 50 : 0);

  return { ok: true, words, total, bingo, error: null };
}