import { ReactNode, useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  FolderKanban,
  LayoutGrid,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Star,
  Users,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import { useRecentlyViewed } from '../../hooks/useRecentlyViewed';
import { useStarredProjects } from '../../contexts/StarredProjectsContext';
import { projectsApi } from '../../api/projects';
import { Project } from '../../api/types';
import { projectColor } from '../../lib/projectColor';
import { cn } from '../../lib/utils';
import { Avatar } from '../Avatar';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

function ProjectSquare({ project, size = 20 }: { project: { key: string; name: string }; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white"
      style={{ width: size, height: size, backgroundColor: projectColor(project.key) }}
    >
      {project.name.charAt(0).toUpperCase()}
    </div>
  );
}

/** Icon + label row with an active-route highlight; collapses to an icon-only tooltip trigger. */
function NavRow({
  to,
  icon,
  label,
  collapsed,
  end,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  collapsed: boolean;
  end?: boolean;
}) {
  // isActive is computed from the current location rather than via NavLink's
  // function-form `className` prop: when this row is wrapped in Radix's
  // TooltipTrigger asChild (the collapsed rail), Slot's prop-merging stringifies
  // a function className instead of calling it, so a plain string className is
  // used here for both the expanded and collapsed cases.
  const { pathname } = useLocation();
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

  const link = (
    <NavLink
      to={to}
      end={end}
      className={cn(
        'flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-foreground/80 hover:bg-muted',
        collapsed && 'justify-center px-0 py-2',
        isActive && 'bg-primary/10 text-primary hover:bg-primary/10'
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center [&_svg]:h-[18px] [&_svg]:w-[18px]">
        {icon}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );

  if (!collapsed) return link;
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/** A row with a chevron that expands to reveal a sub-list (Recent / Starred / Projects). */
function ExpandableSection({
  icon,
  label,
  collapsed,
  expanded,
  onToggle,
  headerAction,
  children,
  emptyLabel,
}: {
  icon: ReactNode;
  label: string;
  collapsed: boolean;
  expanded: boolean;
  onToggle: () => void;
  headerAction?: ReactNode;
  children: ReactNode;
  emptyLabel?: string;
}) {
  const header = (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-foreground/80 hover:bg-muted',
        collapsed && 'justify-center px-0'
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center [&_svg]:h-[18px] [&_svg]:w-[18px]">
        {icon}
      </span>
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-left">{label}</span>
          {headerAction}
          {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        </>
      )}
    </button>
  );

  return (
    <div>
      {collapsed ? (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>{header}</TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      ) : (
        header
      )}
      {!collapsed && expanded && (
        <div className="ml-1 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-3">
          {children ?? null}
          {emptyLabel && <p className="px-2 py-1 text-xs text-muted-foreground">{emptyLabel}</p>}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Called after any in-sidebar navigation; used by the mobile overlay to close itself. */
  onNavigate?: () => void;
}) {
  const { user, logout } = useAuth();
  const { branding } = useTheme();
  const { entries } = useRecentlyViewed();
  const { starredProjects } = useStarredProjects();
  const navigate = useNavigate();

  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [recentOpen, setRecentOpen] = useState(true);
  const [starredOpen, setStarredOpen] = useState(true);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [moreProjectsOpen, setMoreProjectsOpen] = useState(false);

  useEffect(() => {
    projectsApi.list().then(setAllProjects).catch(() => undefined);
  }, []);

  const recentProjectEntries = useMemo(() => entries.filter((e) => e.kind === 'project').slice(0, 5), [entries]);

  const recentProjectIds = useMemo(() => new Set(recentProjectEntries.map((e) => e.id)), [recentProjectEntries]);
  const moreProjects = useMemo(
    () => allProjects.filter((p) => !recentProjectIds.has(p.id)),
    [allProjects, recentProjectIds]
  );

  function expandIfCollapsed() {
    if (collapsed) onToggleCollapsed();
  }

  function handleNavigate() {
    onNavigate?.();
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Top strip: collapse toggle + branding */}
      <div className={cn('flex h-14 shrink-0 items-center gap-2 border-b border-border px-3', collapsed && 'justify-center px-0')}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
        {!collapsed && (
          <NavLink to="/" onClick={handleNavigate} className="flex min-w-0 items-center gap-2">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.productName} className="h-6 w-6 shrink-0 rounded" />
            ) : (
              <div className="h-6 w-6 shrink-0 rounded-md bg-primary" />
            )}
            <span className="truncate font-semibold text-foreground">{branding.productName}</span>
          </NavLink>
        )}
      </div>

      {/* Primary nav */}
      <nav className="flex flex-col gap-0.5 overflow-y-auto px-2 py-3" onClick={(e) => {
        // Only record navigation for actual link clicks (NavLink renders an <a>).
        if ((e.target as HTMLElement).closest('a')) handleNavigate();
      }}>
        <NavRow to="/" end icon={<LayoutGrid />} label="For you" collapsed={collapsed} />

        <ExpandableSection
          icon={<Clock />}
          label="Recent"
          collapsed={collapsed}
          expanded={recentOpen}
          onToggle={() => (collapsed ? expandIfCollapsed() : setRecentOpen((v) => !v))}
          emptyLabel={entries.length === 0 ? 'Nothing viewed yet' : undefined}
        >
          {entries.slice(0, 8).map((entry) => (
            <NavLink
              key={`${entry.kind}-${entry.id}`}
              to={entry.href}
              className="flex items-center gap-2 truncate rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              title={entry.label}
            >
              <span className="truncate">{entry.label}</span>
              {entry.meta && <span className="shrink-0 text-[10px] opacity-70">{entry.meta}</span>}
            </NavLink>
          ))}
        </ExpandableSection>

        <ExpandableSection
          icon={<Star />}
          label="Starred"
          collapsed={collapsed}
          expanded={starredOpen}
          onToggle={() => (collapsed ? expandIfCollapsed() : setStarredOpen((v) => !v))}
          emptyLabel={starredProjects.length === 0 ? 'Star a project to pin it here' : undefined}
        >
          {starredProjects.map((project) => (
            <NavLink
              key={project.id}
              to={`/projects/${project.id}/board`}
              className="flex items-center gap-2 truncate rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ProjectSquare project={project} size={16} />
              <span className="truncate">{project.name}</span>
            </NavLink>
          ))}
        </ExpandableSection>

        <ExpandableSection
          icon={<FolderKanban />}
          label="Projects"
          collapsed={collapsed}
          expanded={projectsOpen}
          onToggle={() => (collapsed ? expandIfCollapsed() : setProjectsOpen((v) => !v))}
          headerAction={
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                navigate('/projects');
                handleNavigate();
              }}
              className="mr-1 flex h-5 w-5 items-center justify-center rounded hover:bg-muted-foreground/10"
              title="New project"
            >
              <Plus className="h-3.5 w-3.5" />
            </span>
          }
        >
          {recentProjectEntries.length > 0 && (
            <div className="mb-1">
              <p className="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                Recent
              </p>
              {recentProjectEntries.map((entry) => (
                <NavLink
                  key={entry.id}
                  to={entry.href}
                  className="flex items-center gap-2 truncate rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ProjectSquare project={{ key: entry.meta ?? '?', name: entry.label }} size={16} />
                  <span className="truncate">{entry.label}</span>
                </NavLink>
              ))}
            </div>
          )}

          {moreProjects.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setMoreProjectsOpen((v) => !v)}
                className="flex w-full items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {moreProjectsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                More projects ({moreProjects.length})
              </button>
              {moreProjectsOpen &&
                moreProjects.map((project) => (
                  <NavLink
                    key={project.id}
                    to={`/projects/${project.id}/board`}
                    className="flex items-center gap-2 truncate rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ProjectSquare project={project} size={16} />
                    <span className="truncate">{project.name}</span>
                  </NavLink>
                ))}
            </div>
          )}

          {recentProjectEntries.length === 0 && moreProjects.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">No projects yet</p>
          )}
        </ExpandableSection>

        <div className="my-2 border-t border-border" />

        <NavRow to="/teams" icon={<Users />} label="Teams" collapsed={collapsed} />

        {user?.role === 'ADMIN' && (
          <NavRow to="/admin/settings" icon={<Settings />} label="Admin Settings" collapsed={collapsed} />
        )}
      </nav>

      <div className="mt-auto border-t border-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted',
                collapsed && 'justify-center px-0'
              )}
            >
              <Avatar user={user ?? null} size={28} />
              {!collapsed && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{user?.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-medium text-foreground">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
