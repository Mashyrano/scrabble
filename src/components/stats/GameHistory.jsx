import { useState } from 'react';
import moment from 'moment';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function GameRow({ game }) {
  const [open, setOpen] = useState(false);
  const players = game.players || [];
  const moves = game.moves || [];

  return (
    <Card className="border-border/80">
      <CardContent className="p-5">
        <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start justify-between gap-4 text-left">
          <div className="min-w-0 space-y-1">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {moment(game.played_at).format('D MMM YYYY · HH:mm')} · {game.turn_count} turns
            </p>
            <p className="font-display text-lg font-semibold">
              {game.is_draw ? 'Draw' : `${game.winner_name || 'Winner'} won`}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {players.map((p) => `${p.name} ${p.score}`).join('  ·  ')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {game.top_word?.word && (
              <span className="hidden rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent sm:inline">
                Best word: {game.top_word.word} +{game.top_word.score}
              </span>
            )}
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
          </div>
        </button>

        {open && (
          <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {players.map((p) => (
                <div key={p.seat} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 text-sm">
                  <span className="font-medium">
                    {p.name}
                    {p.is_winner && <span className="ml-2 text-xs text-accent">winner</span>}
                  </span>
                  <span className="font-display tabular-nums">{p.score}</span>
                </div>
              ))}
            </div>

            {game.words_played?.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Words played</p>
                <p className="mt-1 text-sm leading-relaxed">{game.words_played.join(' · ')}</p>
              </div>
            )}

            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Move log</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {moves.map((move, index) => (
                  <li key={index} className="flex items-center justify-between gap-3 border-b border-border/40 pb-1.5 last:border-0">
                    <span className="text-muted-foreground">{move.player_name}</span>
                    <span className="font-display">
                      {move.type === 'word' ? move.words.map((w) => w.word).join(', ') : move.type === 'pass' ? 'Passed' : 'Swapped'}
                    </span>
                    <span className="w-12 text-right tabular-nums text-accent">{move.score > 0 ? `+${move.score}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GameHistory({ games }) {
  return (
    <div className="space-y-3">
      {games.map((game) => (
        <GameRow key={game.id} game={game} />
      ))}
    </div>
  );
}