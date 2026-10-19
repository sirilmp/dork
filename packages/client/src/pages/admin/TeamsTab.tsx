import { FormEvent, useEffect, useState } from 'react';
import { adminTeamsApi, adminUsersApi } from '../../api/admin';
import { AdminUser, Team } from '../../api/types';
import { ApiError } from '../../api/client';

export function TeamsTab() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<AdminUser[] | null>(null);
  const [allUsers, setAllUsers] = useState<AdminUser[] | null>(null);
  const [addUserId, setAddUserId] = useState('');

  async function loadTeams() {
    try {
      setTeams(await adminTeamsApi.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load teams');
    }
  }

  useEffect(() => {
    loadTeams();
    adminUsersApi.list().then(setAllUsers).catch(() => {});
  }, []);

  async function loadMembers(teamId: string) {
    try {
      setMembers(await adminTeamsApi.members(teamId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load team members');
    }
  }

  function openTeam(teamId: string) {
    setSelectedTeamId(teamId);
    loadMembers(teamId);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await adminTeamsApi.create(name, description || undefined);
      setName('');
      setDescription('');
      await loadTeams();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create team');
    }
  }

  async function handleDeleteTeam(teamId: string) {
    if (!window.confirm('Delete this team? Members keep their accounts; only team membership is removed.')) return;
    setError(null);
    try {
      await adminTeamsApi.remove(teamId);
      if (selectedTeamId === teamId) {
        setSelectedTeamId(null);
        setMembers(null);
      }
      await loadTeams();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete team');
    }
  }

  async function handleAddMember(e: FormEvent) {
    e.preventDefault();
    if (!selectedTeamId || !addUserId) return;
    setError(null);
    try {
      await adminTeamsApi.addMember(selectedTeamId, addUserId);
      setAddUserId('');
      await loadMembers(selectedTeamId);
      await loadTeams();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add member');
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!selectedTeamId) return;
    setError(null);
    try {
      await adminTeamsApi.removeMember(selectedTeamId, userId);
      await loadMembers(selectedTeamId);
      await loadTeams();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove member');
    }
  }

  const memberIds = new Set(members?.map((m) => m.id));
  const pickableUsers = (allUsers ?? []).filter((u) => !memberIds.has(u.id));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Teams</h2>

      <form onSubmit={handleCreate} className="mb-6 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Description
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Create team
        </button>
      </form>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-600">All teams</h3>
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {teams?.map((t) => (
              <li key={t.id} className={`flex items-center justify-between px-3 py-2 ${selectedTeamId === t.id ? 'bg-slate-50' : ''}`}>
                <button type="button" onClick={() => openTeam(t.id)} className="flex-1 text-left">
                  <span className="font-medium text-slate-800">{t.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{t._count?.members ?? 0} members</span>
                  {t.description && <p className="text-xs text-slate-500">{t.description}</p>}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTeam(t.id)}
                  className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          {teams && teams.length === 0 && <p className="mt-2 text-sm text-slate-500">No teams yet.</p>}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-600">Members</h3>
          {!selectedTeamId && <p className="text-sm text-slate-500">Select a team to manage its members.</p>}
          {selectedTeamId && (
            <>
              <form onSubmit={handleAddMember} className="mb-3 flex gap-2">
                <select
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                >
                  <option value="">Select a user...</option>
                  {pickableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!addUserId}
                  className="whitespace-nowrap rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                >
                  Add
                </button>
              </form>

              <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                {members?.map((m) => (
                  <li key={m.id} className="flex items-center justify-between px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{m.name}</p>
                      <p className="text-xs text-slate-500">{m.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.id)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              {members && members.length === 0 && <p className="mt-2 text-sm text-slate-500">No members yet.</p>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
