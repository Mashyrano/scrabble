import { RACK_SIZE, makeBag, createBoard, shuffle, letterPoints } from './scrabbleEngine.ts';
import { analyzeMove } from './moveAnalyzer.ts';
import { unknownWords } from './lexicon.ts';

export const MAX_PLAYERS = 4;

// One game per table code. The room owns the board, the bag and every rack, so a
// client can only ever send an attempt — never a result. Every action mutates the
// game in place and returns { error } when it was refused; the caller saves the
// game only when there was no error.

export function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

export function initGame(code) {
  return {
    code,
    phase: 'waiting',
    maxPlayers: 2,
    board: createBoard(),
    bag: [],
    tileSeq: 1,
    players: [],
    turn: 1,
    log: [],
    bests: {},
    lastMove: null,
    result: null,
    scoreless: 0,
    startedAt: null,
    finishedAt: null,
  };
}

// user is { id, name }; msg is what the client sent.
export function applyAction(game, user, msg) {
  if (!msg || typeof msg !== 'object') return { error: 'Unknown action.' };
  if (msg.type === 'join') return join(game, user, msg);

  const player = game.players.find((p) => p.userId === user.id);
  if (!player) return { error: 'You are not seated at this table.' };

  if (msg.type === 'start') return start(game, player);
  if (msg.type === 'commit') return commit(game, player, msg);
  if (msg.type === 'pass') return pass(game, player);
  if (msg.type === 'swap') return swap(game, player, msg);
  if (msg.type === 'resign') return resign(game, player);
  return { error: 'Unknown action.' };
}

// ------------------------------------------------------------------ actions

function join(game, user, msg) {
  let player = game.players.find((p) => p.userId === user.id);
  if (!player) {
    if (game.phase !== 'waiting') return { error: 'This game has already started.' };
    if (game.players.length >= game.maxPlayers) return { error: 'This table is already full.' };
    player = { seat: game.players.length + 1, userId: user.id, name: '', rack: [], score: 0, resigned: false };
    game.players.push(player);
    if (player.seat === 1) {
      const seats = Number(msg.maxPlayers);
      if (seats >= 2 && seats <= MAX_PLAYERS) game.maxPlayers = seats;
    }
  }
  const name = String(user.name || '').trim().slice(0, 40);
  if (name) player.name = name;
  return {};
}

function start(game, player) {
  if (game.phase !== 'waiting') return { error: 'The game has already started.' };
  if (player.seat !== 1) return { error: 'Only the host can start the game.' };
  if (game.players.length < 2) return { error: 'At least two players are needed.' };

  game.bag = makeBag();
  game.tileSeq = 1;
  game.board = createBoard();
  game.log = [];
  game.bests = {};
  game.scoreless = 0;
  game.lastMove = null;
  game.phase = 'playing';
  game.turn = 1;
  game.startedAt = new Date().toISOString();
  for (const p of game.players) {
    p.rack = [];
    p.score = 0;
    p.resigned = false;
    drawTiles(game, p, RACK_SIZE);
  }
  return {};
}

function commit(game, player, msg) {
  if (game.phase !== 'playing') return { error: 'The game is not in play.' };
  if (player.seat !== game.turn) return { error: 'It is not your turn.' };

  const raw = Array.isArray(msg.placements) ? msg.placements.slice(0, RACK_SIZE) : [];
  if (!raw.length) return { error: 'Place at least one tile.' };

  const usedIds = [];
  const placements = [];
  for (const item of raw) {
    const tile = player.rack.find((t) => t.id === item?.tileId);
    if (!tile) return { error: 'That tile is not in your rack.' };
    if (usedIds.includes(tile.id)) return { error: 'The same tile was placed twice.' };
    const chosen = tile.letter || String(item.letter || '').toUpperCase();
    if (!tile.letter && !/^[A-Z]$/.test(chosen)) return { error: 'Choose a letter for the blank tile.' };
    usedIds.push(tile.id);
    placements.push({ x: Number(item.x), y: Number(item.y), letter: tile.letter || chosen, blank: !tile.letter });
  }

  const isFirstMove = !game.board.some((row) => row.some(Boolean));
  const analysis = analyzeMove({ board: game.board, placements, isFirstMove });
  if (!analysis.ok) return { error: analysis.error || 'That move is not valid.' };
  const rejected = unknownWords(analysis.words.map((w) => w.word));
  if (rejected.length) return { error: 'Not in the word list: ' + rejected.join(', ') };

  for (const p of placements) game.board[p.y][p.x] = { letter: p.letter, blank: p.blank };
  player.rack = player.rack.filter((t) => !usedIds.includes(t.id));
  drawTiles(game, player, usedIds.length);
  player.score += analysis.total;

  for (const word of analysis.words) noteWord(game, player, word);

  const move = {
    seat: player.seat,
    name: player.name || `Player ${player.seat}`,
    type: 'word',
    words: analysis.words,
    score: analysis.total,
    bingo: analysis.bingo,
    unchecked: [],
    cells: placements.map((p) => ({ x: p.x, y: p.y })),
    at: new Date().toISOString(),
  };
  game.lastMove = move;
  game.log.push(move);
  game.scoreless = 0;

  if (!game.bag.length && !player.rack.length) return { finished: finish(game, 'out-of-tiles', player.seat) };
  advanceTurn(game);
  return {};
}

function pass(game, player) {
  if (game.phase !== 'playing') return { error: 'The game is not in play.' };
  if (player.seat !== game.turn) return { error: 'It is not your turn.' };
  game.scoreless += 1;
  const move = { seat: player.seat, name: player.name || `Player ${player.seat}`, type: 'pass', words: [], score: 0, at: new Date().toISOString() };
  game.lastMove = move;
  game.log.push(move);
  if (game.scoreless >= scorelessLimit(game)) return { finished: finish(game, 'passed-out', null) };
  advanceTurn(game);
  return {};
}

function swap(game, player, msg) {
  if (game.phase !== 'playing') return { error: 'The game is not in play.' };
  if (player.seat !== game.turn) return { error: 'It is not your turn.' };
  if (game.bag.length < RACK_SIZE) return { error: 'You can only swap while the bag still holds seven tiles.' };

  const ids = Array.isArray(msg.tileIds) ? msg.tileIds.slice(0, RACK_SIZE) : [];
  if (!ids.length) return { error: 'Select the tiles you want to swap.' };
  const returning = player.rack.filter((t) => ids.includes(t.id));
  if (returning.length !== ids.length) return { error: 'Those tiles are not all in your rack.' };

  player.rack = player.rack.filter((t) => !ids.includes(t.id));
  drawTiles(game, player, returning.length);
  for (const tile of returning) game.bag.push(tile.letter);
  shuffle(game.bag);

  game.scoreless += 1;
  const move = { seat: player.seat, name: player.name || `Player ${player.seat}`, type: 'swap', words: [], score: 0, count: returning.length, at: new Date().toISOString() };
  game.lastMove = move;
  game.log.push(move);
  if (game.scoreless >= scorelessLimit(game)) return { finished: finish(game, 'passed-out', null) };
  advanceTurn(game);
  return {};
}

function resign(game, player) {
  if (game.phase !== 'playing') return { error: 'The game is not in play.' };
  player.resigned = true;
  return { finished: finish(game, 'resigned', null) };
}

// ------------------------------------------------------------------ helpers

function scorelessLimit(game) {
  return 3 * (game.players.length || 2);
}

function drawTiles(game, player, count) {
  const drawn = game.bag.splice(0, count);
  for (const letter of drawn) player.rack.push({ id: `t${game.tileSeq++}`, letter });
}

function advanceTurn(game) {
  const count = game.players.length;
  game.turn = (game.turn % count) + 1;
}

function noteWord(game, player, word) {
  const key = String(player.userId);
  const best = game.bests[key] || { word: '', score: 0, longest: '' };
  if (word.score > best.score) {
    best.word = word.word;
    best.score = word.score;
  }
  if (word.word.length > best.longest.length) best.longest = word.word;
  game.bests[key] = best;
}

// What every player may see. Racks and the bag stay private.
export function publicState(game, version) {
  return {
    version,
    code: game.code,
    phase: game.phase,
    maxPlayers: game.maxPlayers,
    board: game.board,
    bagCount: game.bag.length,
    turn: game.turn,
    players: game.players.map((p) => ({
      seat: p.seat,
      userId: p.userId,
      name: p.name || `Player ${p.seat}`,
      score: p.score,
      tiles: p.rack.length,
      resigned: !!p.resigned,
      isHost: p.seat === 1,
    })),
    lastMove: game.lastMove,
    log: game.log.map((m) => ({
      seat: m.seat,
      name: m.name,
      type: m.type,
      words: m.words,
      score: m.score,
      bingo: m.bingo,
      unchecked: m.unchecked || [],
      at: m.at,
    })),
    result: game.result,
  };
}

// Settles the final scores. Returns what the result records need.
function finish(game, reason, wentOutSeat) {
  const finals = game.players.map((p) => {
    const unused = p.rack.reduce((sum, t) => sum + letterPoints(t.letter), 0);
    return { ...p, unused, finalScore: p.score };
  });

  const outPlayer = wentOutSeat ? finals.find((f) => f.seat === wentOutSeat) : null;
  const bonus = outPlayer ? finals.filter((f) => f.seat !== wentOutSeat).reduce((sum, f) => sum + f.unused, 0) : 0;
  const adjusted = finals.map((f) => {
    const adjustment = f.seat === wentOutSeat ? bonus : -f.unused;
    return { ...f, adjustment, finalScore: f.score + adjustment };
  });

  const eligible = reason === 'resigned' ? adjusted.filter((f) => !f.resigned) : adjusted;
  const pool = eligible.length ? eligible : adjusted;
  const best = Math.max(...pool.map((f) => f.finalScore));
  const winners = pool.filter((f) => f.finalScore === best);

  game.phase = 'finished';
  game.finishedAt = new Date().toISOString();
  game.result = {
    reason,
    isDraw: winners.length > 1,
    winnerName: winners.length === 1 ? winners[0].name || `Player ${winners[0].seat}` : null,
    winnerSeats: winners.map((w) => w.seat),
    scores: adjusted.map((f) => ({
      seat: f.seat,
      name: f.name || `Player ${f.seat}`,
      score: f.finalScore,
      adjustment: f.adjustment,
      tilesLeft: f.rack.length,
      resigned: !!f.resigned,
    })),
  };
  return { adjusted, winners };
}

// ------------------------------------------------------------ result records

// The `games` row for a finished game.
export function gameRecord(game, { adjusted, winners }) {
  const allWords = [];
  let topWord = null;
  for (const move of game.log) {
    for (const word of move.words || []) {
      allWords.push(word.word);
      if (!topWord || word.score > topWord.score) {
        topWord = { word: word.word, score: word.score, player_name: move.name };
      }
    }
  }
  return {
    game_key: `${game.code}:${game.startedAt}`,
    room_code: game.code,
    played_at: game.startedAt || new Date().toISOString(),
    finished_at: game.finishedAt,
    turn_count: game.log.length,
    highest_score: Math.max(...adjusted.map((f) => f.finalScore)),
    players: adjusted.map((f) => ({
      user_id: f.userId,
      name: f.name || `Player ${f.seat}`,
      seat: f.seat,
      score: f.finalScore,
      tiles_left: f.rack.length,
      is_winner: winners.some((w) => w.seat === f.seat),
      resigned: !!f.resigned,
    })),
    winner_id: winners.length === 1 ? winners[0].userId : null,
    winner_name: winners.length === 1 ? winners[0].name || '' : '',
    is_draw: winners.length > 1,
    end_reason: game.result.reason,
    moves: game.log.map((m) => ({
      seat: m.seat,
      player_name: m.name,
      type: m.type,
      words: m.words || [],
      score: m.score || 0,
      at: m.at,
    })),
    words_played: [...new Set(allWords)],
    top_word: topWord || {},
  };
}

// The updated `player_stats` rows, given each player's existing row (if any).
export function statRows(game, { adjusted, winners }, existingRows) {
  const drawn = winners.length > 1;
  return adjusted.filter((f) => f.userId).map((f) => {
    const existing = existingRows.find((r) => r.user_id === f.userId) || null;
    const won = winners.some((w) => w.seat === f.seat);
    const best = game.bests[String(f.userId)] || { word: '', score: 0, longest: '' };
    const games = (existing?.games_played || 0) + 1;
    const wins = (existing?.wins || 0) + (won && !drawn ? 1 : 0);
    const draws = (existing?.draws || 0) + (won && drawn ? 1 : 0);
    const losses = (existing?.losses || 0) + (won ? 0 : 1);
    const totalPoints = (existing?.total_points || 0) + f.finalScore;
    const currentStreak = won && !drawn ? (existing?.current_streak || 0) + 1 : 0;
    const beatsWord = best.score > (existing?.highest_word_score || 0);

    return {
      user_id: f.userId,
      player_name: f.name || existing?.player_name || 'Player',
      games_played: games,
      wins,
      losses,
      draws,
      win_percentage: Math.round((wins / games) * 1000) / 10,
      total_points: totalPoints,
      average_score: Math.round(totalPoints / games),
      highest_game_score: Math.max(existing?.highest_game_score || 0, f.finalScore),
      highest_word_score: Math.max(existing?.highest_word_score || 0, best.score || 0),
      highest_word: beatsWord ? best.word || '' : existing?.highest_word || '',
      longest_word: best.longest.length > (existing?.longest_word || '').length ? best.longest : existing?.longest_word || '',
      current_streak: currentStreak,
      longest_streak: Math.max(existing?.longest_streak || 0, currentStreak),
      last_played_at: game.finishedAt,
    };
  });
}
