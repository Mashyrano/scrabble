import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Trophy, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { playVictory } from '@/lib/sfx';
import { cn } from '@/lib/utils';

const REASONS = {
  'out-of-tiles': 'A player used every tile.',
  'passed-out': 'All players passed in a row.',
  resigned: 'A player resigned.',
};

export default function GameOverPanel({ result, mySeat, code }) {
  const winnerSeats = result?.winnerSeats || [];
  const iWon = winnerSeats.includes(mySeat);

  useEffect(() => {
    playVictory();
    const colors = ['#f0b429', '#166534', '#f8f5ec'];
    const end = Date.now() + 1400;
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors });
      confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  return (
    <Card className={cn('border-2', iWon ? 'border-accent' : 'border-border/80')}>
      <CardContent className="space-y-4 p-5">
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, y: 14, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
        >
          <motion.span
            animate={iWon ? { scale: [1, 1.18, 1] } : undefined}
            transition={iWon ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15"
          >
            <Trophy className="h-5 w-5 text-accent" />
          </motion.span>
          <div>
            <p className="font-display text-xl font-semibold">
              {result?.isDraw ? 'Draw' : iWon ? 'You win' : `${result?.winnerName || 'Winner'} wins`}
            </p>
            <p className="text-xs text-muted-foreground">{REASONS[result?.reason] || 'Game finished.'}</p>
          </div>
        </motion.div>

        <ul className="space-y-2">
          {(result?.scores || []).map((row, index) => (
            <motion.li
              key={row.seat}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + index * 0.08 }}
              className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2.5 text-sm"
            >
              <span className="font-medium">
                {row.name}
                {row.seat === mySeat && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="font-display text-lg font-semibold tabular-nums">{row.score}</span>
                {row.adjustment !== 0 && row.score !== row.adjustment && (
                  <span className={cn('text-xs tabular-nums', row.adjustment > 0 ? 'text-accent' : 'text-muted-foreground')}>
                    {row.adjustment > 0 ? `+${row.adjustment}` : row.adjustment}
                  </span>
                )}
              </span>
            </motion.li>
          ))}
        </ul>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {result?.reason === 'resigned'
            ? 'Unplayed tiles were deducted from each rack.'
            : 'Unplayed tiles were deducted from each rack and added to the player who went out.'}
        </p>

        <div className="flex gap-2">
          <Button asChild variant="secondary" className="flex-1 gap-2">
            <Link to="/stats">
              <BarChart3 className="h-4 w-4" /> View stats
            </Link>
          </Button>
          <Button asChild className="flex-1">
            <Link to="/">New table</Link>
          </Button>
        </div>
        <p className="text-center text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{code}</p>
      </CardContent>
    </Card>
  );
}