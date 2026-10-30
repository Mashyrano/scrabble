import { cn } from '@/lib/utils';
import { tilePoints } from '@/lib/scrabbleBoard';

export default function Tile({ letter, blank, selected, highlight, showValue = true, className, ...rest }) {
  const points = tilePoints(letter);

  return (
    <div
      {...rest}
      className={cn(
        'relative flex aspect-square select-none items-center justify-center rounded-[5px] font-display font-semibold leading-none',
        'bg-tile text-tile-ink shadow-[0_2px_0_rgba(0,0,0,0.22),0_4px_8px_-3px_rgba(0,0,0,0.35)]',
        'border border-black/10 transition-all duration-200',
        rest.onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_4px_0_rgba(0,0,0,0.22),0_8px_14px_-4px_rgba(0,0,0,0.4)]',
        selected && '-translate-y-1.5 ring-2 ring-accent ring-offset-1 ring-offset-board/0',
        highlight && 'ring-2 ring-accent/80',
        className,
      )}
    >
      <span className="translate-y-[2%]">{letter || ''}</span>
      {showValue && points > 0 && (
        <span className="absolute bottom-[6%] right-[8%] text-[0.42em] font-medium opacity-55">{points}</span>
      )}
      {blank && <span className="absolute bottom-[6%] right-[8%] text-[0.42em] font-medium opacity-45">0</span>}
    </div>
  );
}