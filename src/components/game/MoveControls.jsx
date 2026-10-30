import { Play, Repeat, Shuffle, SkipForward, Flag, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function MoveControls({
  preview,
  isMyTurn,
  phase,
  tilesPlaced,
  onRecall,
  onShuffle,
  onPlay,
  onPass,
  onSwap,
  onResign,
  busy,
}) {
  const canPlay = isMyTurn && tilesPlaced > 0 && !preview.error && !busy;

  return (
    <div className="space-y-3">
      <div className="min-h-[52px] rounded-2xl border border-border/70 bg-card px-4 py-3">
        {preview.words.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {preview.words.map((word) => (
              <span key={word.word} className="font-display text-lg">
                {word.word} <span className="text-sm text-muted-foreground">+{word.score}</span>
              </span>
            ))}
            <span className="ml-auto font-display text-xl font-semibold text-accent">
              {preview.total}
              {preview.bingo && <span className="ml-2 text-xs uppercase tracking-wider">bingo +50</span>}
            </span>
          </div>
        ) : (
          <p className={cn('text-sm', preview.error ? 'text-destructive' : 'text-muted-foreground')}>
            {!isMyTurn && phase === 'playing'
              ? 'Waiting for the other player…'
              : preview.error || 'Tap a tile, then tap a square to build your word.'}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onPlay} disabled={!canPlay} className="gap-2">
          <Play className="h-4 w-4" /> Play word
        </Button>
        <Button variant="secondary" onClick={onRecall} disabled={!tilesPlaced || busy} className="gap-2">
          <Undo2 className="h-4 w-4" /> Recall
        </Button>
        <Button variant="secondary" onClick={onShuffle} className="gap-2">
          <Shuffle className="h-4 w-4" /> Shuffle
        </Button>
        <Button variant="ghost" onClick={onSwap} disabled={!isMyTurn || busy} className="gap-2">
          <Repeat className="h-4 w-4" /> Swap
        </Button>
        <Button variant="ghost" onClick={onPass} disabled={!isMyTurn || busy} className="gap-2">
          <SkipForward className="h-4 w-4" /> Pass
        </Button>
        <Button variant="ghost" onClick={onResign} disabled={!isMyTurn || busy} className="ml-auto gap-2 text-muted-foreground">
          <Flag className="h-4 w-4" /> Resign
        </Button>
      </div>
    </div>
  );
}