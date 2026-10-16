import {
  Clapperboard,
  LayoutDashboard,
  MessageSquareQuote,
  MonitorPlay,
  QrCode,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Single source for admin navigation: the desktop sidebar, mobile drawer and breadcrumb all read this. */
export const adminNavItems = [
  { href: '/admin/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/testimonials', label: 'Testimonials', icon: MessageSquareQuote },
  { href: '/admin/videos', label: 'Videos', icon: Clapperboard },
  { href: '/admin/control', label: 'Display control', icon: SlidersHorizontal },
] as const satisfies readonly AdminNavItem[];

export const adminExternalLinks = [
  { href: '/display', label: 'Big screen', icon: MonitorPlay },
  { href: '/certificate', label: 'Participant portal', icon: QrCode },
] as const satisfies readonly AdminNavItem[];

export function findAdminNavItem(pathname: string): AdminNavItem | undefined {
  return adminNavItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
