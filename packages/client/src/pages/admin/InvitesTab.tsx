import { FormEvent, useEffect, useState } from 'react';
import { adminInvitesApi } from '../../api/admin';
import { Invite, SystemRole } from '../../api/types';
import { ApiError } from '../../api/client';

export function InvitesTab() {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<SystemRole>('MEMBER');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastLink, setLastLink] = useState<{ email: string; link: string; emailSent: boolean } | null>(null);

  async function load() {
    try {
      setInvites(await adminInvitesApi.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load invites');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await adminInvitesApi.create(email, role);
      setLastLink({ email: result.invite.email, link: result.inviteLink, emailSent: result.emailSent });
      setEmail('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create invite');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend(id: string) {
    setError(null);
    try {
      const result = await adminInvitesApi.resend(id);
      setLastLink({ email: result.invite.email, link: result.inviteLink, emailSent: result.emailSent });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to resend invite');
    }
  }

  async function handleRevoke(id: string) {
    setError(null);
    try {
      await adminInvitesApi.revoke(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke invite');
    }
  }

  function copy(link: string) {
    navigator.clipboard?.writeText(link).catch(() => {});
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Invites</h2>

      <form onSubmit={handleInvite} className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as SystemRole)} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
            <option value="MEMBER">MEMBER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {submitting ? 'Inviting...' : 'Invite user'}
        </button>
      </form>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {lastLink && (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="mb-1 text-slate-700">
            Invite for <span className="font-medium">{lastLink.email}</span>
            {lastLink.emailSent ? ' was emailed.' : ' could not be emailed (SMTP not configured) — share this link manually:'}
          </p>
          <div className="flex items-center gap-2">
            <input readOnly value={lastLink.link} className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs" />
            <button
              type="button"
              onClick={() => copy(lastLink.link)}
              className="whitespace-nowrap rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Role</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Sent</th>
              <th className="py-2 pr-4 font-medium">Expires</th>
              <th className="py-2 pr-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invites?.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-100">
                <td className="py-2 pr-4">{inv.email}</td>
                <td className="py-2 pr-4">{inv.role}</td>
                <td className="py-2 pr-4">{inv.status}</td>
                <td className="py-2 pr-4 text-slate-500">{new Date(inv.createdAt).toLocaleDateString()}</td>
                <td className="py-2 pr-4 text-slate-500">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                <td className="py-2 pr-4">
                  {inv.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleResend(inv.id)} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700">
                        Resend
                      </button>
                      <button onClick={() => handleRevoke(inv.id)} className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600">
                        Revoke
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {invites && invites.length === 0 && <p className="py-4 text-sm text-slate-500">No invites yet.</p>}
      </div>
    </section>
  );
}
