import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeProvider';
import { Avatar } from './Avatar';

export function Navbar() {
  const { user, logout } = useAuth();
  const { branding } = useTheme();

  return (
    <nav className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      <Link to="/" className="flex items-center gap-2">
        {branding.logoUrl ? (
          <img src={branding.logoUrl} alt={branding.productName} className="h-7" />
        ) : (
          <div className="h-7 w-7 rounded-md bg-primary" />
        )}
        <span className="font-semibold text-slate-800">{branding.productName}</span>
      </Link>

      {user && (
        <div className="flex items-center gap-4">
          {user.role === 'ADMIN' && (
            <Link to="/admin/settings" className="text-sm font-medium text-slate-600 hover:text-primary">
              Admin Settings
            </Link>
          )}
          <div className="flex items-center gap-2">
            <Avatar user={user} size={28} />
            <span className="text-sm text-slate-600">{user.name}</span>
          </div>
          <button onClick={logout} className="text-sm font-medium text-slate-500 hover:text-red-600">
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}
