import { analyzeMove } from './engine.ts';
import { checkWords } from './lexicon.ts';

// Pure move checker: board geometry, word formation, dictionary lookup and score.
// It reads and writes no app data, which is why the live room can call it.
export default async function (req) {
  try {
    const body = await req.json().catch(() => null);
    const board = body && body.board;
    const rawPlacements = body && body.placements;

    const boardOk =
      Array.isArray(board) &&
      board.length === 15 &&
      board.every((row) => Array.isArray(row) && row.length === 15);
    if (!boardOk) return Response.json({ error: 'Invalid board.' }, { status: 400 });
    if (!Array.isArray(rawPlacements) || rawPlacements.length === 0 || rawPlacements.length > 7) {
      return Response.json({ error: 'Invalid placements.' }, { status: 400 });
    }

    const placements = rawPlacements.map((p) => ({
      x: Number(p && p.x),
      y: Number(p && p.y),
      letter: String((p && p.letter) || '').toUpperCase().slice(0, 1),
      blank: !!(p && p.blank),
    }));

    const analysis = analyzeMove({ board, placements, isFirstMove: !!body.isFirstMove });
    if (!analysis.ok) return Response.json({ valid: false, error: analysis.error });

    const check = await checkWords(analysis.words.map((w) => w.word));
    const rejected = [...check.unknown, ...check.unchecked];
    if (rejected.length > 0) {
      return Response.json({ valid: false, error: 'Not in the word list: ' + rejected.join(', ') });
    }

    return Response.json({
      valid: true,
      words: analysis.words,
      total: analysis.total,
      bingo: analysis.bingo,
      played: analysis.played,
      unchecked: check.unchecked,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}