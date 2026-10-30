import { Actor } from 'base44:runtime/actors';
import { RACK_SIZE, makeBag, createBoard, shuffle, letterPoints } from '../../shared/scrabbleEngine.ts';

const MAX_PLAYERS = 4;

// One instance per table code. The room owns the board, the bag and every rack,
// so a client can only ever send an attempt — never a result.
export default class ScrabbleRoom extends Actor {
  game = null;
  seats = new Map();

  async handleStart() {
    const savedGame = await this.storage.get('game');
    const savedSeats = await this.storage.get('seats');
    if (savedGame) this.game = savedGame;
    this.seats = savedSeats ? new Map(savedSeats) : new Map();
    if (!this.game) return;
    // A hibernation wake keeps sockets attached without re-running handleConnect.
    const live = new Set(this.getConnections().map((c) => c.id));
    for (const id of [...this.seats.keys()]) if (!live.has(id)) this.seats.delete(id);
    for (const player of this.game.players) {
      player.connected = [...this.seats.values()].some((s) => s.userId === player.userId);
    }
    await this.storage.put('seats', [...this.seats.entries()]);
  }

  async handleConnect(conn) {
    const identity = conn.identity || {};
    const userId = identity.type === 'authenticated' ? identity.userId : null;
    if (!userId) {
      conn.reject(4003, 'Please sign in to play.');
      return;
    }

    const game = this.game || this.initGame();
    this.game = game;

    if (!this.seats.has(conn.id)) {
      const mine = game.players.find((p) => p.userId === userId);
      if (mine && (!mine.connected || game.phase !== 'waiting')) {
        for (const [id, seat] of [...this.seats.entries()]) {
          if (seat.userId === userId) this.seats.delete(id);
        }
        this.seats.set(conn.id, { seat: mine.seat, userId });
      } else if (game.phase === 'waiting' && game.players.length < game.maxPlayers) {
        const seat = game.players.length + 1;
        game.players.push({ seat, userId, name: '', rack: [], score: 0, connected: true, resigned: false });
        this.seats.set(conn.id, { seat, userId });
      } else {
        conn.reject(4004, game.phase === 'waiting' ? 'This table is already full.' : 'This game has already started.');
        return;
      }
      await this.storage.put('seats', [...this.seats.entries()]);
      await this.persist();
    }

    const entry = this.seats.get(conn.id);
    const player = this.playerBySeat(entry.seat);
    if (player) player.connected = true;

    conn.send({ type: 'you', seat: entry.seat, userId });
    conn.send({ type: 'rack', tiles: (player && player.rack) || [] });
    conn.send({ type: 'state', state: this.publicState() });
    this.broadcastState();
    await this.syncRegistry();
  }

  async handleMessage(conn, msg) {
    if (typeof msg !== 'object' || msg === null) return;
    const entry = this.seats.get(conn.id);
    if (!entry) return;
    const game = this.game;
    if (!game) return;
    const player = this.playerBySeat(entry.seat);
    if (!player) return;

    const type = msg.type;
    if (type === 'join') return this.handleJoin(conn, player, msg);
    if (type === 'start') return this.handleStartGame(conn, player);
    if (type === 'commit') return this.handleCommit(conn, player, msg);
    if (type === 'pass') return this.handlePass(conn, player);
    if (type === 'swap') return this.handleSwap(conn, player, msg);
    if (type === 'resign') return this.handleResign(conn, player);
  }

  async handleClose(conn) {
    const entry = this.seats.get(conn.id);
    this.seats.delete(conn.id);
    await this.storage.put('seats', [...this.seats.entries()]);
    if (!entry || !this.game) return;
    const player = this.playerBySeat(entry.seat);
    if (player) {
      player.connected = [...this.seats.values()].some((s) => s.userId === player.userId);
    }
    this.broadcastState();
  }

  // ---------------------------------------------------------------- messages

  async handleJoin(conn, player, msg) {
    const game = this.game;
    const name = String(msg.name || '').trim().slice(0, 40);
    if (name) player.name = name;
    if (!game.code) {
      game.code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    }
    if (game.players.length === 1) {
      const seats = Number(msg.maxPlayers);
      if (seats >= 2 && seats <= MAX_PLAYERS) game.maxPlayers = seats;
    }
    await this.persist();
    this.broadcastState();
    await this.syncRegistry();
  }

  async handleStartGame(conn, player) {
    const game = this.game;
    if (game.phase !== 'waiting') return this.fail(conn, 'The game has already started.');
    if (player.seat !== 1) return this.fail(conn, 'Only the host can start the game.');
    if (game.players.length < 2) return this.fail(conn, 'At least two players are needed.');

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
      this.drawTiles(p, RACK_SIZE);
    }
    await this.persist();
    this.broadcastState();
    this.sendRacks();
    await this.syncRegistry();
  }

  async handleCommit(conn, player, msg) {
    const game = this.game;
    if (game.phase !== 'playing') return this.fail(conn, 'The game is not in play.');
    if (player.seat !== game.turn) return this.fail(conn, 'It is not your turn.');

    const raw = Array.isArray(msg.placements) ? msg.placements.slice(0, RACK_SIZE) : [];
    if (!raw.length) return this.fail(conn, 'Place at least one tile.');

    const usedIds = [];
    const placements = [];
    for (const item of raw) {
      const tile = player.rack.find((t) => t.id === item?.tileId);
      if (!tile) return this.fail(conn, 'That tile is not in your rack.');
      if (usedIds.includes(tile.id)) return this.fail(conn, 'The same tile was placed twice.');
      const chosen = tile.letter || String(item.letter || '').toUpperCase();
      if (!tile.letter && !/^[A-Z]$/.test(chosen)) return this.fail(conn, 'Choose a letter for the blank tile.');
      usedIds.push(tile.id);
      placements.push({ x: Number(item.x), y: Number(item.y), letter: tile.letter || chosen, blank: !tile.letter });
    }

    const isFirstMove = !game.board.some((row) => row.some(Boolean));
    let verdict;
    try {
      const res = await this.client.asServiceRole.functions.invoke('validateMove', {
        board: game.board,
        placements,
        isFirstMove,
      });
      verdict = res && res.data ? res.data : res;
    } catch (error) {
      console.error('validateMove failed', error.message);
      return this.fail(conn, 'The word checker could not be reached — please try again.');
    }
    if (!verdict || !verdict.valid) return this.fail(conn, (verdict && verdict.error) || 'That move is not valid.');

    for (const p of placements) game.board[p.y][p.x] = { letter: p.letter, blank: p.blank };
    player.rack = player.rack.filter((t) => !usedIds.includes(t.id));
    this.drawTiles(player, usedIds.length);
    player.score += Number(verdict.total) || 0;

    const words = Array.isArray(verdict.words) ? verdict.words : [];
    for (const word of words) this.noteWord(game, player, word);

    const move = {
      seat: player.seat,
      name: player.name || `Player ${player.seat}`,
      type: 'word',
      words,
      score: Number(verdict.total) || 0,
      bingo: !!verdict.bingo,
      unchecked: Array.isArray(verdict.unchecked) ? verdict.unchecked : [],
      cells: placements.map((p) => ({ x: p.x, y: p.y })),
      at: new Date().toISOString(),
    };
    game.lastMove = move;
    game.log.push(move);
    game.scoreless = 0;
    conn.send({ type: 'rack', tiles: player.rack });

    if (!game.bag.length && !player.rack.length) {
      await this.finish('out-of-tiles', player.seat);
      return;
    }
    this.advanceTurn();
    await this.persist();
    this.broadcastState();
  }

  async handlePass(conn, player) {
    const game = this.game;
    if (game.phase !== 'playing') return this.fail(conn, 'The game is not in play.');
    if (player.seat !== game.turn) return this.fail(conn, 'It is not your turn.');
    game.scoreless += 1;
    const move = { seat: player.seat, name: player.name || `Player ${player.seat}`, type: 'pass', words: [], score: 0, at: new Date().toISOString() };
    game.lastMove = move;
    game.log.push(move);
    if (game.scoreless >= this.scorelessLimit()) {
      await this.finish('passed-out', null);
      return;
    }
    this.advanceTurn();
    await this.persist();
    this.broadcastState();
  }

  async handleSwap(conn, player, msg) {
    const game = this.game;
    if (game.phase !== 'playing') return this.fail(conn, 'The game is not in play.');
    if (player.seat !== game.turn) return this.fail(conn, 'It is not your turn.');
    if (game.bag.length < RACK_SIZE) return this.fail(conn, 'You can only swap while the bag still holds seven tiles.');

    const ids = Array.isArray(msg.tileIds) ? msg.tileIds.slice(0, RACK_SIZE) : [];
    if (!ids.length) return this.fail(conn, 'Select the tiles you want to swap.');
    const returning = player.rack.filter((t) => ids.includes(t.id));
    if (returning.length !== ids.length) return this.fail(conn, 'Those tiles are not all in your rack.');

    player.rack = player.rack.filter((t) => !ids.includes(t.id));
    this.drawTiles(player, returning.length);
    for (const tile of returning) game.bag.push(tile.letter);
    shuffle(game.bag);

    conn.send({ type: 'rack', tiles: player.rack });
    game.scoreless += 1;
    const move = { seat: player.seat, name: player.name || `Player ${player.seat}`, type: 'swap', words: [], score: 0, count: returning.length, at: new Date().toISOString() };
    game.lastMove = move;
    game.log.push(move);
    if (game.scoreless >= this.scorelessLimit()) {
      await this.finish('passed-out', null);
      return;
    }
    this.advanceTurn();
    await this.persist();
    this.broadcastState();
  }

  async handleResign(conn, player) {
    const game = this.game;
    if (game.phase !== 'playing') return this.fail(conn, 'The game is not in play.');
    player.resigned = true;
    await this.finish('resigned', null);
  }

  // ------------------------------------------------------------------ helpers

  initGame() {
    return {
      code: null,
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

  playerBySeat(seat) {
    return this.game ? this.game.players.find((p) => p.seat === seat) : null;
  }

  scorelessLimit() {
    return 3 * (this.game?.players.length || 2);
  }

  drawTiles(player, count) {
    const game = this.game;
    const drawn = game.bag.splice(0, count);
    for (const letter of drawn) player.rack.push({ id: `t${game.tileSeq++}`, letter });
  }

  advanceTurn() {
    const count = this.game.players.length;
    this.game.turn = (this.game.turn % count) + 1;
  }

  noteWord(game, player, word) {
    const key = String(player.userId);
    const best = game.bests[key] || { word: '', score: 0, longest: '' };
    if (word.score > best.score) {
      best.word = word.word;
      best.score = word.score;
    }
    if (word.word.length > best.longest.length) best.longest = word.word;
    game.bests[key] = best;
  }

  fail(conn, message) {
    conn.send({ type: 'error', message });
  }

  sendRacks() {
    for (const conn of this.getConnections()) {
      const entry = this.seats.get(conn.id);
      if (!entry) continue;
      const player = this.playerBySeat(entry.seat);
      conn.send({ type: 'rack', tiles: (player && player.rack) || [] });
    }
  }

  publicState() {
    const game = this.game;
    if (!game) return null;
    return {
      code: game.code,
      phase: game.phase,
      maxPlayers: game.maxPlayers,
      board: game.board,
      bagCount: game.bag.length,
      turn: game.turn,
      players: game.players.map((p) => ({
        seat: p.seat,
        name: p.name || `Player ${p.seat}`,
        score: p.score,
        tiles: p.rack.length,
        connected: !!p.connected,
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

  broadcastState() {
    this.broadcast({ type: 'state', state: this.publicState() });
  }

  persist() {
    return this.storage.put('game', this.game);
  }

  async finish(reason, wentOutSeat) {
    const game = this.game;
    if (game.phase === 'finished') return;

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

    await this.persist();
    this.broadcastState();
    await this.storeResult(adjusted, winners);
    await this.syncRegistry();
  }

  async storeResult(adjusted, winners) {
    const game = this.game;
    const gameKey = `${game.code}:${game.startedAt}`;
    try {
      const existing = await this.client.asServiceRole.entities.Game.filter({ game_key: gameKey });
      if (!existing.length) {
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
        await this.client.asServiceRole.entities.Game.create({
          game_key: gameKey,
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
          winner_id: winners.length === 1 ? winners[0].userId : '',
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
        });
      }
      await this.updateStats(adjusted, winners);
    } catch (error) {
      console.error('storing the result failed', error.message);
    }
  }

  async updateStats(adjusted, winners) {
    const game = this.game;
    const drawn = winners.length > 1;
    const ids = adjusted.map((f) => f.userId).filter(Boolean);
    if (!ids.length) return;
    const rows = await this.client.asServiceRole.entities.PlayerStat.filter({ user_id: { $in: ids } });

    for (const f of adjusted) {
      if (!f.userId) continue;
      const existing = rows.find((r) => r.user_id === f.userId) || null;
      const won = winners.some((w) => w.seat === f.seat);
      const best = game.bests[String(f.userId)] || { word: '', score: 0, longest: '' };
      const games = (existing?.games_played || 0) + 1;
      const wins = (existing?.wins || 0) + (won && !drawn ? 1 : 0);
      const draws = (existing?.draws || 0) + (won && drawn ? 1 : 0);
      const losses = (existing?.losses || 0) + (won ? 0 : 1);
      const totalPoints = (existing?.total_points || 0) + f.finalScore;
      const currentStreak = won && !drawn ? (existing?.current_streak || 0) + 1 : 0;
      const beatsWord = best.score > (existing?.highest_word_score || 0);

      const payload = {
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

      if (existing) await this.client.asServiceRole.entities.PlayerStat.update(existing.id, payload);
      else await this.client.asServiceRole.entities.PlayerStat.create(payload);
    }
  }

  async syncRegistry() {
    const game = this.game;
    if (!game || !game.code) return;
    const winner = game.result && !game.result.isDraw ? game.result.winnerSeats[0] : null;
    const winnerPlayer = winner ? game.players.find((p) => p.seat === winner) : null;
    const payload = {
      code: game.code,
      room_id: game.code,
      status: game.phase,
      host_id: game.players[0]?.userId || '',
      host_name: game.players[0]?.name || '',
      player_ids: game.players.map((p) => p.userId).filter(Boolean),
      player_names: game.players.map((p) => p.name || `Player ${p.seat}`),
      max_players: game.maxPlayers,
      turn_name: game.phase === 'playing' ? this.playerBySeat(game.turn)?.name || '' : '',
      scores: game.players.map((p) => ({ name: p.name || `Player ${p.seat}`, score: p.score })),
      winner_id: winnerPlayer?.userId || '',
      winner_name: winnerPlayer?.name || '',
      started_at: game.startedAt || '',
      finished_at: game.finishedAt || '',
    };
    try {
      const existing = await this.client.asServiceRole.entities.GameRoom.filter({ room_id: game.code });
      if (existing.length) await this.client.asServiceRole.entities.GameRoom.update(existing[0].id, payload);
      else await this.client.asServiceRole.entities.GameRoom.create(payload);
    } catch (error) {
      console.error('registry sync failed', error.message);
    }
  }
}