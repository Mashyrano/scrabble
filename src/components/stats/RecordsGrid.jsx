import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, TrendingUp, Ruler } from 'lucide-react';

export default function RecordsGrid({ records }) {
  const items = [
    {
      icon: Sparkles,
      label: 'Highest single word',
      value: records.bestWord?.highest_word || '—',
      meta: records.bestWord?.highest_word_score
        ? `${records.bestWord.highest_word_score} pts · ${records.bestWord.player_name}`
        : 'Not recorded yet',
    },
    {
      icon: TrendingUp,
      label: 'Highest game score',
      value: records.bestGame?.highest_game_score ?? '—',
      meta: records.bestGame?.highest_game_score > 0 ? records.bestGame.player_name : 'Not recorded yet',
    },
    {
      icon: Ruler,
      label: 'Longest word played',
      value: records.longest?.longest_word || '—',
      meta: records.longest?.longest_word
        ? `${records.longest.longest_word.length} letters · ${records.longest.player_name}`
        : 'Not recorded yet',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map(({ icon: Icon, label, value, meta }) => (
        <Card key={label} className="border-border/80">
          <CardContent className="space-y-2 p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15">
              <Icon className="h-4 w-4 text-accent" />
            </span>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            <p className="font-display text-2xl font-semibold">{value}</p>
            <p className="text-xs text-muted-foreground">{meta}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}