import Tile from './Tile';
import { cn } from '@/lib/utils';

export default function Rack({ tiles = [], selectedId, onSelect, onDragStart, disabled, className }) {
  const slots = Array.from({ length: Math.max(7, tiles.length) });

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-2xl border border-border/70 bg-secondary/60 px-3 py-3 shadow-inner sm:gap-2 sm:px-4',
        className,
      )}
    >
      {slots.map((_, i) => {
        const tile = tiles[i];
        if (!tile) {
          return <div key={`empty-${i}`} className="aspect-square w-9 rounded-[5px] border border-dashed border-border/80 sm:w-10" />;
        }
        return (
          <Tile
            key={tile.id}
            letter={tile.letter}
            blank={!tile.letter}
            selected={selectedId === tile.id}
            showValue={false}
            draggable={!disabled}
            onDragStart={(e) => onDragStart?.(e, tile)}
            onClick={disabled ? undefined : () => onSelect?.(tile)}
            className={cn('w-9 text-lg sm:w-10 sm:text-xl', disabled && 'opacity-70')}
          />
        );
      })}
    </div>
  );
}