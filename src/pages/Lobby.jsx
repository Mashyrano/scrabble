import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Hash, Plus, Sparkles, Users, Volume2, VolumeX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Tile from '@/components/game/Tile';
import { useToast } from '@/components/ui/use-toast';
import { CODE_LENGTH, isValidRoomCode, makeRoomCode, normalizeRoomCode } from '@/lib/roomCode';
import { cn } from '@/lib/utils';

// The room seats at most four, as in the board game.
const PLAYER_COUNTS = [2, 3, 4];
// Lobby track, served from public/music/.
const MUSIC_URL = '/music/lobby.mp3';
const BRAND_TILES = ['S', 'C', 'R', 'A', 'B', 'B', 'L', 'E'];

export default function Lobby() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [playerCount, setPlayerCount] = useState(2);
  const [code, setCode] = useState('');
  const audioRef = useRef(null);
  const [musicOn, setMusicOn] = useState(false);

  const toggleMusic = () => {
    const el = audioRef.current;
    if (!el) return;
    if (musicOn) {
      el.pause();
      setMusicOn(false);
    } else {
      el.volume = 0.3;
      el.play().then(() => setMusicOn(true)).catch(() => setMusicOn(false));
    }
  };

  const handleCreate = async () => {
    navigate(`/play/${makeRoomCode()}?seats=${playerCount}`);
  };

  const handleJoin = () => {
    if (!isValidRoomCode(code)) {
      toast({ variant: 'destructive', title: 'Check the code', description: `A table code is ${CODE_LENGTH} characters.` });
      return;
    }
    navigate(`/play/${normalizeRoomCode(code)}`);
  };

  return (
    <div className="space-y-12">
      <audio ref={audioRef} src={MUSIC_URL} loop preload="none" />
      <button
        type="button"
        onClick={toggleMusic}
        aria-label={musicOn ? 'Turn lobby music off' : 'Turn lobby music on'}
        className={
          'fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border shadow-lg transition-all hover:scale-105 ' +
          (musicOn ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground')
        }
      >
        {musicOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
      </button>

      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Real-time online play
          </span>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Scrabble with friends,
            <br />
            each on their own screen.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            Start a table, share the code, and take turns from any device. Every move is checked against the
            dictionary and scored on the official board multipliers — and each finished game feeds your leaderboard.
          </p>

          <div className="flex flex-wrap gap-2">
            {BRAND_TILES.map((letter, i) => (
              <Tile key={i} letter={letter} showValue={false} className={cn('w-10 text-xl sm:w-12 sm:text-2xl', i % 2 === 1 && 'translate-y-1')} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden border-border/80 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.45)]">
            <CardContent className="space-y-5 p-6 sm:p-7">
              <div className="space-y-1.5">
                <h2 className="font-heading text-xl font-semibold">Start a new table</h2>
                <p className="text-sm text-muted-foreground">You get a code to share with the other players.</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" /> How many players?
                </Label>
                <div className="flex gap-2">
                  {PLAYER_COUNTS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setPlayerCount(count)}
                      className={cn(
                        'flex-1 rounded-xl border px-3 py-2.5 font-heading text-sm font-semibold transition-all',
                        playerCount === count
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                      )}
                    >
                      {count} players
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={handleCreate} size="lg" className="w-full gap-2">
                <Plus className="h-4 w-4" /> Create table
              </Button>

              <div className="flex items-center gap-4">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">or join</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="table-code" className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Hash className="h-4 w-4" /> Table code
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="table-code"
                    value={code}
                    onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    placeholder="ABC2345"
                    className="font-mono text-base uppercase tracking-[0.3em]"
                  />
                  <Button variant="secondary" onClick={handleJoin} className="shrink-0 gap-1.5">
                    Join <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            {[
              { step: '01', title: 'Create', text: 'Pick your table size.' },
              { step: '02', title: 'Share', text: 'Send the code to friends.' },
              { step: '03', title: 'Play', text: 'Turns update live.' },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl border border-border/70 bg-card/70 p-4">
                <span className="font-mono text-xs text-accent">{item.step}</span>
                <p className="mt-2 font-heading text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}