import { FormEvent, useEffect, useState } from 'react';
import { brandingApi, smtpApi } from '../api/admin';
import { Branding, SmtpSettings } from '../api/types';
import { useTheme } from '../theme/ThemeProvider';
import { ApiError } from '../api/client';

export function AdminSettingsPage() {
  const { refresh } = useTheme();
  const [branding, setBranding] = useState<Branding | null>(null);
  const [smtp, setSmtp] = useState<SmtpSettings | null>(null);
  const [smtpPassword, setSmtpPassword] = useState('');
  const [brandingStatus, setBrandingStatus] = useState<string | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    brandingApi.get().then(setBranding);
    smtpApi.get().then(setSmtp);
  }, []);

  async function handleSaveBranding(e: FormEvent) {
    e.preventDefault();
    if (!branding) return;
    setBrandingStatus(null);
    try {
      const updated = await brandingApi.update(branding);
      setBranding(updated);
      await refresh();
      setBrandingStatus('Branding saved.');
    } catch (err) {
      setBrandingStatus(err instanceof ApiError ? err.message : 'Failed to save branding');
    }
  }

  async function handleSaveSmtp(e: FormEvent) {
    e.preventDefault();
    if (!smtp) return;
    setSmtpStatus(null);
    try {
      const updated = await smtpApi.update({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        username: smtp.username,
        fromAddress: smtp.fromAddress,
        ...(smtpPassword ? { password: smtpPassword } : {}),
      });
      setSmtp(updated);
      setSmtpPassword('');
      setSmtpStatus('SMTP settings saved.');
    } catch (err) {
      setSmtpStatus(err instanceof ApiError ? err.message : 'Failed to save SMTP settings');
    }
  }

  async function handleTestEmail() {
    setTesting(true);
    setTestStatus(null);
    try {
      const result = await smtpApi.sendTest();
      setTestStatus({ ok: result.ok, message: result.message ?? result.error ?? 'Unknown result' });
    } catch (err) {
      setTestStatus({ ok: false, message: err instanceof ApiError ? err.message : 'Failed to send test email' });
    } finally {
      setTesting(false);
    }
  }

  if (!branding || !smtp) {
    return <div className="px-4 py-8 text-slate-500">Loading settings...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">Admin Settings</h1>

      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Branding</h2>
        <form onSubmit={handleSaveBranding} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Product name
            <input
              value={branding.productName}
              onChange={(e) => setBranding({ ...branding, productName: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Logo URL
            <input
              value={branding.logoUrl ?? ''}
              onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value || null })}
              placeholder="https://example.com/logo.svg"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Favicon URL
            <input
              value={branding.faviconUrl ?? ''}
              onChange={(e) => setBranding({ ...branding, faviconUrl: e.target.value || null })}
              placeholder="https://example.com/favicon.ico"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Primary color
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                  className="h-9 w-12 rounded border border-slate-300"
                />
                <input
                  value={branding.primaryColor}
                  onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Accent color
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.accentColor}
                  onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
                  className="h-9 w-12 rounded border border-slate-300"
                />
                <input
                  value={branding.accentColor}
                  onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </label>
          </div>

          {brandingStatus && <p className="text-sm text-slate-600">{brandingStatus}</p>}

          <button type="submit" className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Save branding
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">SMTP (email notifications)</h2>
        <form onSubmit={handleSaveSmtp} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Host
              <input
                value={smtp.host}
                onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                placeholder="smtp.example.com"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Port
              <input
                type="number"
                value={smtp.port}
                onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={smtp.secure}
              onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })}
            />
            Use TLS (secure connection)
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Username
            <input
              value={smtp.username}
              onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Password {smtp.passwordSet && <span className="text-xs font-normal text-slate-400">(currently set — leave blank to keep)</span>}
            <input
              type="password"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
              placeholder={smtp.passwordSet ? '••••••••' : ''}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            From address
            <input
              value={smtp.fromAddress}
              onChange={(e) => setSmtp({ ...smtp, fromAddress: e.target.value })}
              placeholder='"Open Issue Tracker" <no-reply@example.com>'
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          {smtpStatus && <p className="text-sm text-slate-600">{smtpStatus}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Save SMTP settings
            </button>
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testing}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              {testing ? 'Sending...' : 'Send test email'}
            </button>
          </div>

          {testStatus && (
            <p className={`text-sm ${testStatus.ok ? 'text-emerald-600' : 'text-red-600'}`}>{testStatus.message}</p>
          )}
        </form>
      </section>
    </div>
  );
}
