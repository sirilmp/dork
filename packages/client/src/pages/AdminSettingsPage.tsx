import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { brandingApi, smtpApi } from '../api/admin';
import { Branding, SmtpSettings } from '../api/types';
import { useTheme } from '../theme/ThemeProvider';
import { ApiError } from '../api/client';
import { UsersTab } from './admin/UsersTab';
import { InvitesTab } from './admin/InvitesTab';
import { TeamsTab } from './admin/TeamsTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';

type AdminTab = 'general' | 'users' | 'invites' | 'teams';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'general', label: 'Branding & SMTP' },
  { id: 'users', label: 'Users' },
  { id: 'invites', label: 'Invites' },
  { id: 'teams', label: 'Teams' },
];

export function AdminSettingsPage() {
  const { refresh } = useTheme();
  const [tab, setTab] = useState<AdminTab>('general');
  const [branding, setBranding] = useState<Branding | null>(null);
  const [smtp, setSmtp] = useState<SmtpSettings | null>(null);
  const [smtpPassword, setSmtpPassword] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    brandingApi.get().then(setBranding);
    smtpApi.get().then(setSmtp);
  }, []);

  async function handleSaveBranding(e: FormEvent) {
    e.preventDefault();
    if (!branding) return;
    try {
      const updated = await brandingApi.update(branding);
      setBranding(updated);
      await refresh();
      toast.success('Branding saved.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save branding');
    }
  }

  async function handleSaveSmtp(e: FormEvent) {
    e.preventDefault();
    if (!smtp) return;
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
      toast.success('SMTP settings saved.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save SMTP settings');
    }
  }

  async function handleTestEmail() {
    setTesting(true);
    try {
      const result = await smtpApi.sendTest();
      if (result.ok) toast.success(result.message ?? 'Test email sent.');
      else toast.error(result.error ?? 'Failed to send test email');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to send test email');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Admin Settings</h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as AdminTab)}>
        <TabsList className="mb-6">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="invites">
          <InvitesTab />
        </TabsContent>
        <TabsContent value="teams">
          <TeamsTab />
        </TabsContent>

        <TabsContent value="general">
          {!branding || !smtp ? (
            <div className="py-8 text-muted-foreground">Loading settings...</div>
          ) : (
            <div className="flex flex-col gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Branding</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveBranding} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="product-name">Product name</Label>
                      <Input
                        id="product-name"
                        value={branding.productName}
                        onChange={(e) => setBranding({ ...branding, productName: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="logo-url">Logo URL</Label>
                      <Input
                        id="logo-url"
                        value={branding.logoUrl ?? ''}
                        onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value || null })}
                        placeholder="https://example.com/logo.svg"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="favicon-url">Favicon URL</Label>
                      <Input
                        id="favicon-url"
                        value={branding.faviconUrl ?? ''}
                        onChange={(e) => setBranding({ ...branding, faviconUrl: e.target.value || null })}
                        placeholder="https://example.com/favicon.ico"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="primary-color">Primary color</Label>
                        <div className="flex items-center gap-2">
                          {/* A native color input is the simplest reliable swatch picker here — a
                              shadcn Popover+canvas picker would be more "custom" but adds real
                              complexity for no behavior this app needs yet. */}
                          <input
                            id="primary-color"
                            type="color"
                            value={branding.primaryColor}
                            onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                            className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background"
                          />
                          <Input
                            value={branding.primaryColor}
                            onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="accent-color">Accent color</Label>
                        <div className="flex items-center gap-2">
                          <input
                            id="accent-color"
                            type="color"
                            value={branding.accentColor}
                            onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
                            className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background"
                          />
                          <Input
                            value={branding.accentColor}
                            onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>

                    <Button type="submit" className="self-start">
                      Save branding
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>SMTP (email notifications)</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveSmtp} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="smtp-host">Host</Label>
                        <Input
                          id="smtp-host"
                          value={smtp.host}
                          onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                          placeholder="smtp.example.com"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="smtp-port">Port</Label>
                        <Input
                          id="smtp-port"
                          type="number"
                          value={smtp.port}
                          onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="smtp-secure"
                        checked={smtp.secure}
                        onCheckedChange={(checked) => setSmtp({ ...smtp, secure: checked })}
                      />
                      <Label htmlFor="smtp-secure">Use TLS (secure connection)</Label>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="smtp-username">Username</Label>
                      <Input
                        id="smtp-username"
                        value={smtp.username}
                        onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="smtp-password">
                        Password{' '}
                        {smtp.passwordSet && (
                          <span className="text-xs font-normal text-muted-foreground">(currently set — leave blank to keep)</span>
                        )}
                      </Label>
                      <Input
                        id="smtp-password"
                        type="password"
                        value={smtpPassword}
                        onChange={(e) => setSmtpPassword(e.target.value)}
                        placeholder={smtp.passwordSet ? '••••••••' : ''}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="smtp-from">From address</Label>
                      <Input
                        id="smtp-from"
                        value={smtp.fromAddress}
                        onChange={(e) => setSmtp({ ...smtp, fromAddress: e.target.value })}
                        placeholder='"Open Issue Tracker" <no-reply@example.com>'
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <Button type="submit">Save SMTP settings</Button>
                      <Button type="button" variant="outline" onClick={handleTestEmail} disabled={testing}>
                        {testing ? 'Sending...' : 'Send test email'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
