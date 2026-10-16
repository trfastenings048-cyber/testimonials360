import { CounterChip } from '@/components/shared/CounterChip';
import { Pill } from '@/components/shared/Pill';

/** Top-right pill: the current group's name and its position in the slideshow. */
export function GroupChip({ name, index, count }: { name: string; index: number; count: number }) {
  return (
    <Pill className="max-w-[40vw] gap-[0.75em] py-[0.35em] pr-[0.35em] pl-[1.1em] text-[clamp(11px,0.85vw,16px)]">
      <span className="truncate">{name}</span>
      <CounterChip index={index} count={count} className="text-[1.05em]" />
    </Pill>
  );
}
