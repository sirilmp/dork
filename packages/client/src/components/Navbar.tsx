import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeProvider';
import { Avatar } from './Avatar';
import { Button } from './ui/button';

export function Navbar() {
  const { user, logout } = useAuth();
  const { branding } = useTheme();

  return (
    <nav className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
      <Link to="/" className="flex items-center gap-2">
        {branding.logoUrl ? (
          <img src={branding.logoUrl} alt={branding.productName} className="h-7" />
        ) : (
          <div className="h-7 w-7 rounded-md bg-primary" />
        )}
        <span className="font-semibold text-foreground">{branding.productName}</span>
      </Link>

      {user && (
        <div className="flex items-center gap-4">
          {user.role === 'ADMIN' && (
            <Link to="/admin/settings" className="text-sm font-medium text-muted-foreground hover:text-primary">
              Admin Settings
            </Link>
          )}
          <div className="flex items-center gap-2">
            <Avatar user={user} size={28} />
            <span className="text-sm text-muted-foreground">{user.name}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-destructive">
            <LogOut />
            Sign out
          </Button>
        </div>
      )}
    </nav>
  );
}
