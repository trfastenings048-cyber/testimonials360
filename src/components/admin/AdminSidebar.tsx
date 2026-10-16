'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowUpRight, Film, LogOut, MessageSquareQuote, PanelLeftClose, PanelLeftOpen, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { adminExternalLinks, adminNavItems, type AdminNavItem } from './nav-items';
import { isTestimonial, useAdminData } from './AdminDataProvider';
import { getLiveStatus, toneDotClasses } from './StatusPill';

type AdminSidebarProps = {
  collapsed: boolean;
  /** Only the desktop sidebar can collapse; the mobile drawer omits this. */
  onToggleCollapse?: () => void;
};

const itemBaseClasses =
  'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring';

/** Wraps an item in a right-side tooltip when the rail is collapsed and labels are hidden. */
function RailTooltip({ collapsed, label, children }: { collapsed: boolean; label: string; children: React.ReactElement }) {
  if (!collapsed) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function SectionLabel({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  if (collapsed) return <div className="mx-3 my-3 h-px bg-sidebar-border" aria-hidden="true" />;
  return <p className="px-3 pt-5 pb-2 text-eyebrow text-white/45">{children}</p>;
}

export function AdminSidebar({ collapsed, onToggleCollapse }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { certificates, settings, connection, screens } = useAdminData();

  const testimonials = certificates.filter(isTestimonial);
  const liveTestimonials = testimonials.filter((item) => item.showOnDisplay).length;
  const notOnScreen = testimonials.length - liveTestimonials;
  const status = getLiveStatus(connection, screens.length);
  const primaryScreen = screens[0];

  const signOut = async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/admin/login');
    router.refresh();
  };

  const renderBadge = (item: AdminNavItem) => {
    if (item.href === '/admin/testimonials' && notOnScreen > 0) {
      return collapsed ? (
        <span className="absolute top-1.5 right-2 size-2 rounded-full bg-sidebar-primary ring-2 ring-sidebar" aria-hidden="true" />
      ) : (
        <span className="ml-auto rounded-full bg-sidebar-primary px-2 py-0.5 text-xs font-semibold text-sidebar-primary-foreground tabular-nums">
          {notOnScreen}
        </span>
      );
    }
    if (item.href === '/admin/control') {
      return (
        <span
          className={cn(
            'size-2 rounded-full ring-2 ring-sidebar',
            toneDotClasses[status.tone],
            collapsed ? 'absolute top-1.5 right-2' : 'ml-auto'
          )}
          aria-hidden="true"
        />
      );
    }
    return null;
  };

  const srBadge = (item: AdminNavItem) => {
    if (item.href === '/admin/testimonials' && notOnScreen > 0) return `, ${notOnScreen} not on screen`;
    if (item.href === '/admin/control') return `, ${status.label}`;
    return '';
  };

  // Prefer what the screen itself reports; fall back to the saved setting.
  const screenMode = primaryScreen?.mode ?? settings.mode;
  const modeLabel = screenMode === 'video' ? 'Video' : 'Testimonials';
  const ModeIcon = screenMode === 'video' ? Film : MessageSquareQuote;
  const isPausedOnScreen = primaryScreen
    ? screenMode === 'video'
      ? !primaryScreen.video.playing
      : primaryScreen.testimonials.paused
    : false;
  const playback = !primaryScreen
    ? 'No screen connected'
    : screenMode === 'video'
      ? primaryScreen.video.playing
        ? 'Video playing'
        : 'Video paused'
      : primaryScreen.testimonials.paused
        ? `Paused on ${Math.min(primaryScreen.testimonials.index + 1, primaryScreen.testimonials.count)} of ${primaryScreen.testimonials.count}`
        : `Auto-rotating ${primaryScreen.testimonials.count} testimonials`;
  const PlaybackIcon = isPausedOnScreen ? Pause : Play;
  const contentSummary =
    screenMode === 'video'
      ? (primaryScreen?.video.title ?? settings.video?.title ?? 'No video set')
      : `${liveTestimonials} live · ${notOnScreen} not on screen`;

  return (
    // nowrap + the aside's overflow-hidden keep labels from reflowing while the width animates.
    <div className="flex h-full flex-col whitespace-nowrap">
      {/* Brand */}
      <Link
        href="/admin/overview"
        className={cn(
          'flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset',
          collapsed ? 'justify-center px-2' : 'px-4',
          // The mobile drawer's close button sits in this corner.
          !onToggleCollapse && 'pr-14'
        )}
        aria-label="TR Fastenings admin, go to overview"
      >
        <span className="shrink-0 rounded-md bg-white p-1 shadow-sm">
          <Image src="/tr-fastenings-logo.jpg" alt="" width={140} height={134} priority className="h-8 w-auto" />
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block text-eyebrow text-brand-teal-bright">TR Fastenings</span>
            <span className="block truncate text-sm font-semibold text-white">360 Camera Admin</span>
          </span>
        )}
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Admin sections">
        <SectionLabel collapsed={collapsed}>Manage</SectionLabel>
        <ul className="space-y-1">
          {adminNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <RailTooltip collapsed={collapsed} label={item.label}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      itemBaseClasses,
                      collapsed && 'justify-center px-0',
                      isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
                    )}
                  >
                    {isActive && (
                      <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-sidebar-primary" aria-hidden="true" />
                    )}
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
                    {renderBadge(item)}
                    <span className="sr-only">{srBadge(item)}</span>
                  </Link>
                </RailTooltip>
              </li>
            );
          })}
        </ul>

        <SectionLabel collapsed={collapsed}>Open</SectionLabel>
        <ul className="space-y-1">
          {adminExternalLinks.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <RailTooltip collapsed={collapsed} label={`${item.label} (new tab)`}>
                  <Link
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(itemBaseClasses, collapsed && 'justify-center px-0')}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
                    {!collapsed && (
                      <ArrowUpRight className="ml-auto size-4 opacity-50 group-hover:opacity-100" aria-hidden="true" />
                    )}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </Link>
                </RailTooltip>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Now showing */}
      <div className="shrink-0 space-y-2 border-t border-sidebar-border p-3">
        <RailTooltip collapsed={collapsed} label={`Now showing: ${modeLabel} · ${playback}`}>
          <Link
            href="/admin/control"
            className={cn(
              'block rounded-xl border border-sidebar-border bg-white/5 text-left outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sidebar-ring',
              collapsed ? 'flex h-11 items-center justify-center' : 'p-3'
            )}
          >
            {collapsed ? (
              <span className="relative">
                <ModeIcon className="size-5 text-white" aria-hidden="true" />
                <span
                  className={cn('absolute -top-1 -right-1 size-2 rounded-full ring-2 ring-sidebar', toneDotClasses[status.tone])}
                  aria-hidden="true"
                />
                <span className="sr-only">
                  Now showing: {modeLabel}, {playback}
                </span>
              </span>
            ) : (
              <>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-eyebrow text-brand-teal-bright">Now showing</span>
                  <span className={cn('size-2 rounded-full', toneDotClasses[status.tone])} aria-hidden="true" />
                </span>
                <span className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <ModeIcon className="size-4 shrink-0" aria-hidden="true" />
                  {modeLabel}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-xs text-sidebar-foreground">
                  {primaryScreen && <PlaybackIcon className="size-3 shrink-0" aria-hidden="true" />}
                  <span className="truncate">{playback}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-white/50">{contentSummary}</span>
              </>
            )}
          </Link>
        </RailTooltip>

        <RailTooltip collapsed={collapsed} label="Sign out">
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Sign out"
            className={cn(itemBaseClasses, 'w-full', collapsed && 'justify-center px-0')}
          >
            <LogOut className="size-5" aria-hidden="true" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </RailTooltip>

        {onToggleCollapse && (
          <RailTooltip collapsed={collapsed} label="Expand sidebar">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={cn(itemBaseClasses, 'w-full', collapsed && 'justify-center px-0')}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-5" aria-hidden="true" />
              ) : (
                <>
                  <PanelLeftClose className="size-5" aria-hidden="true" />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </RailTooltip>
        )}
      </div>
    </div>
  );
}
