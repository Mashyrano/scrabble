import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Tile from './Tile';
import { cn } from '@/lib/utils';

export default function SwapDialog({ tiles, onConfirm, onCancel }) {
  const [selected, setSelected] = useState([]);

  const toggle = (id) => {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  return (
    <div className="space-y-3 rounded-2xl border border-accent/40 bg-accent/5 p-4">
      <div>
        <p className="font-heading text-sm font-semibold">Swap tiles</p>
        <p className="text-xs text-muted-foreground">
          Pick the tiles to put back in the bag. Your turn passes and the new tiles are drawn at random.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tiles.map((tile) => (
          <button key={tile.id} type="button" onClick={() => toggle(tile.id)} className="focus:outline-none">
            <Tile
              letter={tile.letter}
              blank={!tile.letter}
              selected={selected.includes(tile.id)}
              showValue={false}
              className={cn('w-10 text-lg', !selected.includes(tile.id) && 'opacity-70')}
            />
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={!selected.length} onClick={() => onConfirm(selected)}>
          Swap {selected.length || ''} {selected.length === 1 ? 'tile' : 'tiles'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}