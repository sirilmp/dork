import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Clipboard } from 'lucide-react';
import { adminInvitesApi } from '../../api/admin';
import { Invite, SystemRole } from '../../api/types';
import { ApiError } from '../../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';

export function InvitesTab() {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<SystemRole>('MEMBER');
  const [submitting, setSubmitting] = useState(false);
  const [lastLink, setLastLink] = useState<{ email: string; link: string; emailSent: boolean } | null>(null);

  async function load() {
    try {
      setInvites(await adminInvitesApi.list());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load invites');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await adminInvitesApi.create(email, role);
      setLastLink({ email: result.invite.email, link: result.inviteLink, emailSent: result.emailSent });
      setEmail('');
      setShowInviteForm(false);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create invite');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend(id: string) {
    try {
      const result = await adminInvitesApi.resend(id);
      setLastLink({ email: result.invite.email, link: result.inviteLink, emailSent: result.emailSent });
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to resend invite');
    }
  }

  async function handleRevoke(id: string) {
    try {
      await adminInvitesApi.revoke(id);
      await load();
      toast.success('Invite revoked.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to revoke invite');
    }
  }

  function copy(link: string) {
    navigator.clipboard
      ?.writeText(link)
      .then(() => toast.success('Invite link copied.'))
      .catch(() => toast.error('Could not copy link.'));
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Invites</CardTitle>
        <Dialog open={showInviteForm} onOpenChange={setShowInviteForm}>
          <DialogTrigger asChild>
            <Button>Invite user</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Invite a user</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="person@example.com"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as SystemRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">MEMBER</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setShowInviteForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Inviting...' : 'Send invite'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {lastLink && (
          <Alert className="mb-4">
            <AlertDescription>
              <p className="mb-2">
                Invite for <span className="font-medium text-foreground">{lastLink.email}</span>
                {lastLink.emailSent ? ' was emailed.' : ' could not be emailed (SMTP not configured) — share this link manually:'}
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={lastLink.link} className="text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={() => copy(lastLink.link)}>
                  <Clipboard className="h-4 w-4" />
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites?.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>{inv.email}</TableCell>
                <TableCell>{inv.role}</TableCell>
                <TableCell>
                  <Badge variant={inv.status === 'PENDING' ? 'secondary' : 'outline'}>{inv.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(inv.expiresAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  {inv.status === 'PENDING' && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleResend(inv.id)}>
                        Resend
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRevoke(inv.id)}
                      >
                        Revoke
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {invites && invites.length === 0 && <p className="py-4 text-sm text-muted-foreground">No invites yet.</p>}
      </CardContent>
    </Card>
  );
}
