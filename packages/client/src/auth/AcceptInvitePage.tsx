import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useTheme } from '../theme/ThemeProvider';
import { ApiError } from '../api/client';
import { publicInvitesApi } from '../api/admin';
import { InvitePublicInfo } from '../api/types';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';

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
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-2 text-center">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.productName} className="h-10" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-primary" />
          )}
          <h1 className="text-xl font-semibold">Accept your invite</h1>
        </CardHeader>
        <CardContent>
          {loadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          {!loadError && !invite && <p className="text-sm text-muted-foreground">Loading invite...</p>}

          {invite && (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                You've been invited as <span className="font-medium text-foreground">{invite.email}</span> to join
                as <span className="font-medium text-foreground">{invite.role}</span>.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Joining...' : 'Create account and join'}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
