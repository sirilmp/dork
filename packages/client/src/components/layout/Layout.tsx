import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { TooltipProvider } from '../ui/tooltip';
import { Button } from '../ui/button';
import { useTheme } from '../../theme/ThemeProvider';
import { useSidebarCollapsed } from '../../hooks/useSidebarState';
import { StarredProjectsProvider } from '../../contexts/StarredProjectsContext';
import { cn } from '../../lib/utils';

const EXPANDED_WIDTH = 'md:w-[280px]';
const COLLAPSED_WIDTH = 'md:w-14';
const EXPANDED_PAD = 'md:pl-[280px]';
const COLLAPSED_PAD = 'md:pl-14';

export function Layout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { branding } = useTheme();

  return (
    <StarredProjectsProvider>
      <TooltipProvider>
        <div className="min-h-screen bg-muted/30">
          {/* Slim mobile-only top bar: below md the sidebar is an overlay
              drawer (closed by default), so primary navigation still needs
              a persistent, always-visible entry point on narrow viewports. */}
          <div className="flex h-12 items-center gap-2 border-b border-border bg-background px-3 md:hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link to="/" className="flex min-w-0 items-center gap-2">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.productName} className="h-5 w-5 shrink-0 rounded" />
              ) : (
                <div className="h-5 w-5 shrink-0 rounded bg-primary" />
              )}
              <span className="truncate text-sm font-semibold text-foreground">{branding.productName}</span>
            </Link>
          </div>

          {/* Desktop/tablet: fixed persistent sidebar column. */}
          <aside
            className={cn(
              'fixed inset-y-0 left-0 z-30 hidden border-r border-border transition-[width] duration-150 md:block',
              collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH
            )}
          >
            <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((v) => !v)} />
          </aside>

          {/* Mobile: overlay drawer + backdrop. */}
          {mobileOpen && (
            <div className="fixed inset-0 z-40 md:hidden">
              <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
              <aside className="absolute inset-y-0 left-0 w-[280px] border-r border-border bg-background shadow-xl">
                <Sidebar collapsed={false} onToggleCollapsed={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} />
              </aside>
            </div>
          )}

          <main className={cn('min-h-screen', collapsed ? COLLAPSED_PAD : EXPANDED_PAD)}>{children}</main>
        </div>
      </TooltipProvider>
    </StarredProjectsProvider>
  );
}
