import moment from 'moment';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Medal, Award } from 'lucide-react';

const RANK_ICON = [Trophy, Medal, Award];

export default function LeaderboardTable({ stats }) {
  const rows = [...stats].sort((a, b) => b.wins - a.wins || b.win_percentage - a.win_percentage || b.total_points - a.total_points);

  return (
    <Card className="border-border/80">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <th className="px-5 py-3 font-medium">#</th>
                <th className="px-3 py-3 font-medium">Player</th>
                <th className="px-3 py-3 text-right font-medium">Games</th>
                <th className="px-3 py-3 text-right font-medium">Wins</th>
                <th className="px-3 py-3 text-right font-medium">Win %</th>
                <th className="px-3 py-3 text-right font-medium">Best game</th>
                <th className="px-3 py-3 text-right font-medium">Streak</th>
                <th className="px-5 py-3 text-right font-medium">Longest</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const Icon = RANK_ICON[index];
                return (
                  <tr key={row.id} className="border-b border-border/40 last:border-0">
                    <td className="px-5 py-3">
                      {Icon ? <Icon className={cn('h-4 w-4', index === 0 ? 'text-accent' : 'text-muted-foreground')} /> : index + 1}
                    </td>
                    <td className="px-3 py-3 font-medium">
                      {row.player_name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {moment(row.last_played_at).fromNow?.() || ''}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.games_played}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{row.wins}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.win_percentage}%</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.highest_game_score}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {row.current_streak > 0 ? <span className="text-accent">🔥 {row.current_streak}</span> : '—'}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{row.longest_streak || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}