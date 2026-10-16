import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'primary' | 'secondary';
};

const toneClasses = {
  default: 'text-foreground',
  primary: 'text-primary',
  secondary: 'text-secondary',
} as const;

export function StatCard({ label, value, hint, icon, tone = 'default' }: StatCardProps) {
  return (
    <div className="admin-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground [&_svg]:size-4" aria-hidden="true">{icon}</span>}
      </div>
      <p className={cn('mt-2 text-3xl font-bold tracking-tight tabular-nums', toneClasses[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
