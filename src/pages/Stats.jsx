import { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';

import { supabase } from '@/api/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import LeaderboardTable from '@/components/stats/LeaderboardTable';
import RecordsGrid from '@/components/stats/RecordsGrid';
import GameHistory from '@/components/stats/GameHistory';

export default function Stats() {
  const [stats, setStats] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('player_stats').select('*').order('wins', { ascending: false }).limit(100),
      supabase.from('games').select('*').order('played_at', { ascending: false }).limit(25),
    ]).then(([statsPage, gamesPage]) => {
      setStats(statsPage.data ?? []);
      setGames(gamesPage.data ?? []);
      setLoading(false);
    });
  }, []);

  const records = useMemo(() => {
    const bestWord = stats.reduce((best, s) => ((s.highest_word_score || 0) > (best?.highest_word_score || 0) ? s : best), null);
    const bestGame = stats.reduce((best, s) => ((s.highest_game_score || 0) > (best?.highest_game_score || 0) ? s : best), null);
    const longest = stats.reduce((best, s) => ((s.longest_word || '').length > (best?.longest_word || '').length ? s : best), null);
    return { bestWord, bestGame, longest };
  }, [stats]);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Dashboard</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Stats &amp; History</h1>
        <p className="max-w-2xl text-muted-foreground">
          Leaderboards, all-time records, winning streaks and a full log of every finished game.
        </p>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <Card className="border-dashed border-border/80 bg-card/60">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </span>
            <p className="font-heading font-semibold">No finished games yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Play a table to the end and the results, records and streaks will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold">All-time records</h2>
            <RecordsGrid records={records} />
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold">Leaderboard</h2>
            <LeaderboardTable stats={stats} />
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold">Game history</h2>
            <GameHistory games={games} />
          </section>
        </>
      )}
    </div>
  );
}