'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AdminDataProvider } from './AdminDataProvider';
import { AdminNavbar } from './AdminNavbar';
import { AdminSidebar } from './AdminSidebar';

const COLLAPSE_STORAGE_KEY = 'tr-admin-sidebar-collapsed';

// The collapse preference lives in localStorage; read it as an external store so the
// server render (expanded) and the client's stored value reconcile without an effect.
const collapseListeners = new Set<() => void>();
const subscribeCollapsed = (listener: () => void) => {
  collapseListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    collapseListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
};
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1';
  } catch {
    return false; // Storage unavailable (private mode etc.); default to expanded.
  }
};
const writeCollapsed = (value: boolean) => {
  try {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Ignore; the preference just won't persist.
  }
  collapseListeners.forEach((listener) => listener());
};

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navPath, setNavPath] = useState(pathname);

  // Close the mobile drawer after navigating (adjusting state during render).
  if (pathname !== navPath) {
    setNavPath(pathname);
    setMobileNavOpen(false);
  }

  // Dialogs, sheets and tooltips portal into <body>, outside the themed wrapper,
  // so apply the admin theme there too while the admin is mounted.
  useEffect(() => {
    document.body.classList.add('theme-tr', 'theme-admin');
    return () => document.body.classList.remove('theme-tr', 'theme-admin');
  }, []);

  const toggleCollapsed = () => writeCollapsed(!collapsed);

  return (
    <AdminDataProvider>
      <TooltipProvider>
        <div className="theme-tr theme-admin min-h-screen w-full bg-surface-page text-foreground">
          <a
            href="#admin-main"
            className="sr-only z-[100] rounded-md bg-card px-4 py-2 text-sm font-medium text-primary shadow focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            Skip to content
          </a>

          <aside
            className={cn(
              'surface-shadow sidebar-gradient fixed inset-y-4 left-4 z-40 hidden overflow-hidden rounded-[24px] bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:block',
              collapsed ? 'w-[72px]' : 'w-64'
            )}
            aria-label="Admin sidebar"
          >
            <AdminSidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
          </aside>

          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent
              side="left"
              className="theme-tr theme-admin sidebar-gradient border-sidebar-border bg-sidebar text-sidebar-foreground lg:hidden"
            >
              <SheetTitle className="sr-only">Admin navigation</SheetTitle>
              <AdminSidebar collapsed={false} />
            </SheetContent>
          </Sheet>

          <div
            className={cn(
              'flex min-h-screen flex-col transition-[padding] duration-200',
              collapsed ? 'lg:pl-[104px]' : 'lg:pl-[288px]'
            )}
          >
            <AdminNavbar onOpenMenu={() => setMobileNavOpen(true)} />
            <main id="admin-main" tabIndex={-1} className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
              {children}
            </main>
          </div>
        </div>
      </TooltipProvider>
    </AdminDataProvider>
  );
}
