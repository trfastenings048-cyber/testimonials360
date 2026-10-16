'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Menu, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { findAdminNavItem } from './nav-items';
import { useAdminData } from './AdminDataProvider';
import { StatusPill } from './StatusPill';

export function AdminNavbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const { refresh, isRefreshing } = useAdminData();
  const current = findAdminNavItem(pathname);
  const isOnControl = pathname.startsWith('/admin/control');

  return (
    <header className="surface-shadow navbar-gradient sticky top-4 z-30 mx-4 mt-4 flex h-14 shrink-0 items-center gap-2 rounded-[20px] px-4 sm:mx-6 sm:gap-3 lg:mx-8">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="-ml-2 lg:hidden"
        onClick={onOpenMenu}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 text-sm">
          <li className="hidden sm:block">
            <Link href="/admin/overview" className="rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              Admin
            </Link>
          </li>
          <li className="hidden text-muted-foreground/60 sm:block" aria-hidden="true">
            <ChevronRight className="size-4" />
          </li>
          <li className="min-w-0">
            <span aria-current="page" className="block truncate font-medium text-foreground">
              {current?.label ?? 'Admin'}
            </span>
          </li>
        </ol>
      </nav>

      <StatusPill />

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              className="surface-shadow rounded-full border-0 bg-white hover:bg-slate-50"
              onClick={() => void refresh()}
              disabled={isRefreshing}
              aria-label="Refresh data"
            />
          }
        >
          <RefreshCw className={cn('size-4', isRefreshing && 'animate-spin')} />
        </TooltipTrigger>
        <TooltipContent side="bottom">Refresh data</TooltipContent>
      </Tooltip>

      {!isOnControl && (
        <Link
          href="/admin/control"
          className={cn(buttonVariants({ size: 'icon-lg' }), 'rounded-full lg:hidden')}
          aria-label="Open display control"
        >
          <SlidersHorizontal className="size-4" />
        </Link>
      )}
    </header>
  );
}
