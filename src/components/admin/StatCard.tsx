import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Arches } from '@/components/shared/Arches';

type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  /** `signature` is the big screen's blue gradient card; use it for one headline stat per page. */
  tone?: 'default' | 'primary' | 'secondary' | 'signature';
};

const toneClasses = {
  default: 'text-ink',
  primary: 'text-ink',
  secondary: 'text-accent-blue-strong',
  signature: 'text-ink',
} as const;

export function StatCard({ label, value, hint, icon, tone = 'default' }: StatCardProps) {
  const signature = tone === 'signature';
  return (
    <div className={cn('admin-card relative overflow-hidden p-4 sm:p-5', signature && 'bg-signature')}>
      {signature && <Arches className="text-white/60" />}
      <div className="relative flex items-center justify-between gap-2">
        <p className={cn('text-[13px] font-medium', signature ? 'text-ink/75' : 'text-muted-foreground')}>{label}</p>
        {icon && (
          <span className={cn('[&_svg]:size-4', signature ? 'text-ink/70' : 'text-muted-foreground')} aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <p className={cn('relative mt-2 text-4xl font-light tracking-tight tabular-nums', toneClasses[tone])}>{value}</p>
      {hint && (
        <p className={cn('relative mt-1 text-xs', signature ? 'text-ink/70' : 'text-muted-foreground')}>{hint}</p>
      )}
    </div>
  );
}
