import { Copy, Check, Trophy, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function TableCode({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="flex items-center gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Table code</p>
        <p className="font-mono text-2xl font-semibold tracking-[0.22em] sm:text-3xl">{code}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={copy} aria-label="Copy table code">
        {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export default function PlayersPanel({ players, turn, bagCount, phase, mySeat }) {
  const leader = Math.max(...players.map((p) => p.score));

  return (
    <Card className="border-border/80">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Players</h2>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
            {bagCount} in the bag
          </span>
        </div>

        <ul className="space-y-2">
          {players.map((player) => {
            const isTurn = phase === 'playing' && player.seat === turn;
            const diff = player.score - leader;
            return (
              <li
                key={player.seat}
                className={cn(
                  'rounded-xl border px-3 py-3 transition-colors',
                  isTurn ? 'border-accent bg-accent/10' : 'border-border/70 bg-card',
                  player.resigned && 'opacity-60',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {player.connected ? (
                      <Wifi className="h-3.5 w-3.5 shrink-0 text-accent" />
                    ) : (
                      <WifiOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate font-medium">
                      {player.name}
                      {player.seat === mySeat && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                    </span>
                  </div>
                  <span className="font-display text-xl font-semibold tabular-nums">{player.score}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {isTurn && <span className="font-semibold text-accent">On the move</span>}
                  {!isTurn && diff < 0 && <span>{diff}</span>}
                  {!isTurn && diff === 0 && player.seat !== mySeat && phase === 'playing' && (
                    <span className="inline-flex items-center gap-1">
                      <Trophy className="h-3 w-3" /> Leading
                    </span>
                  )}
                  {player.resigned && <span>Resigned</span>}
                  {phase === 'playing' && <span>· {player.tiles} tiles left</span>}
                </div>
              </li>
            );
          })}
          {phase === 'waiting' && players.length < 2 && (
            <li className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
              Waiting for another player to join with this code…
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}