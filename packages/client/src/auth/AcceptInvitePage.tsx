import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTheme } from '../theme/ThemeProvider';
import { ApiError } from '../api/client';
import { publicInvitesApi } from '../api/admin';
import { InvitePublicInfo } from '../api/types';

export function AcceptInvitePage() {
  const { token = '' } = useParams<{ token: string }>();
  const { setSession } = useAuth();
  const { branding } = useTheme();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<InvitePublicInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    publicInvitesApi
      .get(token)
      .then(setInvite)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'This invite could not be found.'));
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await publicInvitesApi.accept(token, name, password);
      setSession(result.token, result.user);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to accept invite');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.productName} className="h-10" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-primary" />
          )}
          <h1 className="text-xl font-semibold">Accept your invite</h1>
        </div>

        {loadError && <p className="text-sm text-red-600">{loadError}</p>}

        {!loadError && !invite && <p className="text-sm text-slate-500">Loading invite...</p>}

        {invite && (
          <>
            <p className="mb-4 text-sm text-slate-600">
              You've been invited as <span className="font-medium">{invite.email}</span> to join as{' '}
              <span className="font-medium">{invite.role}</span>.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Your name
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Password
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {submitting ? 'Joining...' : 'Create account and join'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
