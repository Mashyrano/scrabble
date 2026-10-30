import { cn } from '@/lib/utils';
import Tile from './Tile';
import { BOARD_SIZE, MULTIPLIER_LABEL, MULTIPLIER_STYLE, layoutAt } from '@/lib/scrabbleBoard';

function Cell({ x, y, placed, isLast, onCellPlace }) {
  const code = layoutAt(x, y);
  const label = code === 'C' ? '★' : { d: 'DL', t: 'TL', D: 'DW', T: 'TW' }[code];

  return (
    <div
      onClick={onCellPlace ? () => onCellPlace(x, y) : undefined}
      onDragOver={onCellPlace ? (event) => event.preventDefault() : undefined}
      onDrop={
        onCellPlace
          ? (event) => {
              event.preventDefault();
              onCellPlace(x, y);
            }
          : undefined
      }
      title={placed ? undefined : code === 'C' ? 'Starting square' : MULTIPLIER_LABEL[label]}
      className={cn(
        'relative flex aspect-square items-center justify-center rounded-[3px] transition-colors',
        placed ? 'bg-board-line' : code === '.' ? 'bg-board-line/45' : MULTIPLIER_STYLE[label],
        onCellPlace && 'cursor-pointer hover:bg-accent/40',
        isLast && 'ring-2 ring-inset ring-accent',
      )}
    >
      {placed ? (
        <Tile letter={placed.letter} blank={placed.blank} showValue={false} className="h-full w-full text-[0.6rem] sm:text-sm" />
      ) : (
        <span className="pointer-events-none select-none text-[0.5rem] font-semibold leading-none opacity-70 sm:text-[0.6rem]">
          {label}
        </span>
      )}
    </div>
  );
}

export default function Board({ board, draft = {}, lastMove = [], onCellPlace, className }) {
  return (
    <div className={cn('rounded-2xl bg-board p-2 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.6)] sm:p-3', className)}>
      <div className="grid gap-[2px] sm:gap-[3px]" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}>
        {Array.from({ length: BOARD_SIZE }).map((_, y) =>
          Array.from({ length: BOARD_SIZE }).map((__, x) => {
            const key = `${x},${y}`;
            const placed = draft[key] || board?.[y]?.[x] || null;
            return (
              <Cell
                key={key}
                x={x}
                y={y}
                placed={placed}
                isLast={lastMove.some((c) => c.x === x && c.y === y)}
                onCellPlace={onCellPlace}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}