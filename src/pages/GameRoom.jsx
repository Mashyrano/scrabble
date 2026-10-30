const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Play, Dices } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import Board from '@/components/game/Board';
import Rack from '@/components/game/Rack';
import PlayersPanel, { TableCode } from '@/components/game/PlayersPanel';
import MoveControls from '@/components/game/MoveControls';
import SwapDialog from '@/components/game/SwapDialog';
import GameOverPanel from '@/components/game/GameOverPanel';
import useScrabbleRoom from '@/hooks/useScrabbleRoom';
import { analyzeDraft } from '@/lib/movePreview';
import { playTileClick, playTilesLaid } from '@/lib/sfx';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function GameRoomPage() {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const maxPlayers = Number(searchParams.get('seats')) || 2;
  const { toast } = useToast();

  const [user, setUser] = useState(null);
  const [draft, setDraft] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [blankTile, setBlankTile] = useState(null);
  const [blankLetter, setBlankLetter] = useState('');
  const [swapOpen, setSwapOpen] = useState(false);
  const [rackOrder, setRackOrder] = useState([]);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef(null);

  useEffect(() => {
    db.auth.me().then(setUser);
  }, []);

  const { state, rack, me, error, clearError, send } = useScrabbleRoom(code, {
    name: user?.full_name,
    maxPlayers,
  });

  useEffect(() => {
    if (!error) return;
    toast({ variant: 'destructive', title: 'Move not played', description: error.message });
    clearError();
    setBusy(false);
  }, [error, clearError, toast]);

  const logLength = state?.log?.length ?? 0;
  const logRef = useRef(0);
  useEffect(() => {
    if (logLength !== logRef.current) {
      if (logLength > logRef.current && state?.log?.[logLength - 1]?.type === 'word') {
        playTilesLaid(state.lastMove?.cells?.length || 3);
      }
      logRef.current = logLength;
      setDraft({});
      setSelectedId(null);
      setSwapOpen(false);
      setBusy(false);
    }
  }, [logLength]);

  useEffect(() => {
    setRackOrder((current) => {
      const ids = rack.map((t) => t.id);
      const kept = current.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !current.includes(id));
      return [...kept, ...added];
    });
  }, [rack]);

  const orderedRack = useMemo(() => {
    const map = new Map(rack.map((t) => [t.id, t]));
    return rackOrder.map((id) => map.get(id)).filter(Boolean);
  }, [rack, rackOrder]);

  const board = state?.board || null;
  const mySeat = me?.seat || null;
  const isMyTurn = state?.phase === 'playing' && state.turn === mySeat;
  const usedIds = Object.values(draft).map((t) => t.tileId);
  const preview = useMemo(() => analyzeDraft(board, draft), [board, draft]);

  const placeAt = (x, y) => {
    if (!isMyTurn) {
      toast({ description: 'It is not your turn yet.' });
      return;
    }
    if (draft[`${x},${y}`]) {
      removeAt(x, y);
      return;
    }
    const tile = orderedRack.find((t) => t.id === selectedId) || (blankTile && orderedRack.find((t) => t.id === blankTile));
    if (!tile) {
      toast({ description: 'Pick a tile from your rack first.' });
      return;
    }
    if (board?.[y]?.[x]) return;
    const letter = tile.letter || blankLetter;
    if (!tile.letter && !letter) {
      setBlankTile(tile.id);
      return;
    }
    setDraft((current) => ({ ...current, [`${x},${y}`]: { letter, blank: !tile.letter, tileId: tile.id } }));
    playTileClick();
    setSelectedId(null);
    setBlankTile(null);
  };

  const removeAt = (x, y) => {
    setDraft((current) => {
      const next = { ...current };
      delete next[`${x},${y}`];
      return next;
    });
  };

  const handleSelect = (tile) => {
    if (!isMyTurn) {
      toast({ description: 'It is not your turn yet.' });
      return;
    }
    if (!tile.letter) {
      setBlankTile(tile.id);
      setSelectedId(null);
      return;
    }
    setSelectedId(selectedId === tile.id ? null : tile.id);
    setBlankTile(null);
  };

  const play = () => {
    const placements = Object.entries(draft).map(([key, tile]) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y, tileId: tile.tileId, letter: tile.letter };
    });
    setBusy(true);
    send({ type: 'commit', placements });
  };

  const players = state?.players || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" aria-label="Back to lobby">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          {state?.code ? <TableCode code={state.code} /> : <div className="h-12 w-40 animate-pulse rounded-lg bg-secondary" />}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {state?.phase === 'playing' && <span>{state.bagCount} tiles left in the bag</span>}
        </div>
      </div>

      {!state ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-20">
            <Dices className="h-6 w-6 animate-pulse text-accent" />
            <p className="text-sm text-muted-foreground">Opening the table…</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-4">
            <Board board={board} draft={draft} lastMove={state.lastMove?.cells || []} onCellPlace={placeAt} />

            {state.phase === 'playing' && swapOpen ? (
              <SwapDialog
                tiles={orderedRack}
                onCancel={() => setSwapOpen(false)}
                onConfirm={(ids) => {
                  setBusy(true);
                  send({ type: 'swap', tileIds: ids });
                }}
              />
            ) : (
              <>
                <Rack
                  tiles={orderedRack}
                  selectedId={blankTile || selectedId}
                  onSelect={handleSelect}
                  disabled={state.phase !== 'playing'}
                />
                {blankTile && (
                  <div className="rounded-2xl border border-accent/40 bg-accent/5 p-4">
                    <p className="text-sm font-medium">Choose the letter for your blank tile</p>
                    <div className="mt-2 grid grid-cols-9 gap-1">
                      {LETTERS.map((letter) => (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => setBlankLetter(letter)}
                          className={
                            blankLetter === letter
                              ? 'rounded-md bg-primary py-1.5 text-xs font-semibold text-primary-foreground'
                              : 'rounded-md bg-card py-1.5 text-xs font-semibold hover:bg-secondary'
                          }
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {state.phase === 'playing' && (
                  <MoveControls
                    preview={preview}
                    isMyTurn={isMyTurn}
                    phase={state.phase}
                    tilesPlaced={Object.keys(draft).length}
                    busy={busy}
                    onPlay={play}
                    onRecall={() => setDraft({})}
                    onShuffle={() => setRackOrder((order) => [...order].sort(() => Math.random() - 0.5))}
                    onSwap={() => setSwapOpen(true)}
                    onPass={() => {
                      setBusy(true);
                      send({ type: 'pass' });
                    }}
                    onResign={() => {
                      setBusy(true);
                      send({ type: 'resign' });
                    }}
                  />
                )}
                {state.phase === 'waiting' && (
                  <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">
                    <span>Tiles are dealt when the host starts the game.</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-4">
            {state.phase === 'finished' ? (
              <GameOverPanel result={state.result} mySeat={mySeat} code={state.code} />
            ) : (
              <PlayersPanel players={players} turn={state.turn} bagCount={state.bagCount} phase={state.phase} mySeat={mySeat} />
            )}

            {state.phase === 'waiting' && (
              <Card className="border-border/80">
                <CardContent className="space-y-3 p-5">
                  <p className="text-sm text-muted-foreground">
                    Share the code <span className="font-mono font-semibold text-foreground">{state.code}</span> so the
                    other players can join from their own device.
                  </p>
                  {mySeat === 1 ? (
                    <Button
                      className="w-full gap-2"
                      disabled={players.length < 2}
                      onClick={() => send({ type: 'start' })}
                    >
                      <Play className="h-4 w-4" />
                      {players.length < 2 ? 'Waiting for players' : 'Start game'}
                    </Button>
                  ) : (
                    <p className="rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">
                      Waiting for the host to start the game…
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {state.phase === 'playing' && state.log.length > 0 && (
              <Card className="border-border/80">
                <CardContent className="space-y-3 p-5">
                  <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Recent turns
                  </h2>
                  <ul className="space-y-2 text-sm">
                    {[...state.log].reverse().slice(0, 6).map((move, index) => (
                      <li key={`${move.at}-${index}`} className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-0">
                        <div className="min-w-0">
                          <p className="truncate text-xs text-muted-foreground">{move.name}</p>
                          <p className="font-display">
                            {move.type === 'word' ? move.words.map((w) => w.word).join(', ') : move.type === 'pass' ? 'Passed' : 'Swapped tiles'}
                          </p>
                          {move.unchecked?.length > 0 && (
                            <p className="text-[11px] text-muted-foreground">Could not be checked online</p>
                          )}
                        </div>
                        {move.score > 0 && <span className="font-display text-lg tabular-nums text-accent">+{move.score}</span>}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}