import type { ReactNode } from 'react';

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div
        className="flex size-12 items-center justify-center rounded-full bg-accent-blue-soft text-accent-blue-strong [&_svg]:size-6"
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-[15px] font-medium text-ink">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
