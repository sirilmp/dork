import { useEffect, useState } from 'react';
import { teamsApi } from '../api/teams';
import { Team } from '../api/types';
import { Card } from '../components/ui/card';

/**
 * Read-only team roster for non-admin users (GET /api/teams). Admins manage
 * teams — rename, delete, add/remove members — under Admin Settings' Teams
 * tab instead, which is kept as the one place that mutates teams.
 */
export function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    teamsApi
      .list()
      .then(setTeams)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold text-foreground">Teams</h1>
      <p className="mb-6 text-sm text-muted-foreground">Teams across your organization.</p>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : teams.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No teams have been created yet.</Card>
      ) : (
        <div className="flex flex-col gap-2">
          {teams.map((team) => (
            <Card key={team.id} className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-card-foreground">{team.name}</p>
                {team.description && <p className="truncate text-sm text-muted-foreground">{team.description}</p>}
              </div>
              <span className="shrink-0 text-sm text-muted-foreground">
                {team._count?.members ?? 0} member{team._count?.members === 1 ? '' : 's'}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
