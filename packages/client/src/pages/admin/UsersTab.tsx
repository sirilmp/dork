import { useEffect, useState } from 'react';
import { adminUsersApi } from '../../api/admin';
import { AdminUser, SystemRole } from '../../api/types';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';

export function UsersTab() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load(query?: string) {
    try {
      setUsers(await adminUsersApi.list(query));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load users');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await load(search || undefined);
  }

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await load(search || undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed');
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Users</h2>

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">
          Search
        </button>
      </form>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Role</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Joined</th>
              <th className="py-2 pr-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="py-2 pr-4">{u.name}</td>
                <td className="py-2 pr-4">{u.email}</td>
                <td className="py-2 pr-4">
                  <select
                    value={u.role}
                    onChange={(e) => act(() => adminUsersApi.updateRole(u.id, e.target.value as SystemRole))}
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                  >
                    <option value="MEMBER">MEMBER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td className="py-2 pr-4">
                  {u.deactivatedAt ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Deactivated</span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Active</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="py-2 pr-4">
                  <div className="flex flex-wrap gap-2">
                    {u.deactivatedAt ? (
                      <button
                        onClick={() => act(() => adminUsersApi.reactivate(u.id))}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                      >
                        Reactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => act(() => adminUsersApi.deactivate(u.id))}
                        disabled={u.id === me?.id}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
                      >
                        Deactivate
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (window.confirm(`Permanently delete ${u.email}? This cannot be undone.`)) {
                          act(() => adminUsersApi.remove(u.id));
                        }
                      }}
                      disabled={u.id === me?.id}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users && users.length === 0 && <p className="py-4 text-sm text-slate-500">No users found.</p>}
      </div>
    </section>
  );
}
