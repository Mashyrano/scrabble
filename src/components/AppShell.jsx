import { Link, NavLink, Outlet } from 'react-router-dom';
import { BarChart3, LogOut, Grid3x3 } from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

const links = [
  { to: '/', label: 'Play', icon: Grid3x3, end: true },
  { to: '/stats', label: 'Stats & History', icon: BarChart3 },
];

export default function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-tile font-display text-lg font-semibold text-tile-ink shadow-[0_2px_0_rgba(0,0,0,0.2)]">
              S
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">Scrabble</span>
          </Link>

          <nav className="ml-2 flex items-center gap-1">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user?.full_name || ''}</span>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}