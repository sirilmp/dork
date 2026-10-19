import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { adminTeamsApi, adminUsersApi } from '../../api/admin';
import { AdminUser, Team } from '../../api/types';
import { ApiError } from '../../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Table, TableBody, TableCell, TableRow } from '../../components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../components/ui/command';
import { cn } from '../../lib/utils';

function MemberPicker({
  users,
  value,
  onSelect,
}: {
  users: AdminUser[];
  value: string;
  onSelect: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = users.find((u) => u.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? `${selected.name} (${selected.email})` : 'Select a user...'}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search users..." />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              {users.map((u) => (
                <CommandItem
                  key={u.id}
                  value={`${u.name} ${u.email}`}
                  onSelect={() => {
                    onSelect(u.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('h-4 w-4', value === u.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="ml-2">
                    {u.name} <span className="text-muted-foreground">({u.email})</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function TeamsTab() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<AdminUser[] | null>(null);
  const [allUsers, setAllUsers] = useState<AdminUser[] | null>(null);
  const [addUserId, setAddUserId] = useState('');

  async function loadTeams() {
    try {
      setTeams(await adminTeamsApi.list());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load teams');
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
      toast.error(err instanceof ApiError ? err.message : 'Failed to load team members');
    }
  }

  function openTeam(teamId: string) {
    setSelectedTeamId(teamId);
    setAddUserId('');
    loadMembers(teamId);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await adminTeamsApi.create(name, description || undefined);
      setName('');
      setDescription('');
      setShowCreate(false);
      await loadTeams();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create team');
    }
  }

  async function handleDeleteTeam(teamId: string) {
    if (!window.confirm('Delete this team? Members keep their accounts; only team membership is removed.')) return;
    try {
      await adminTeamsApi.remove(teamId);
      if (selectedTeamId === teamId) {
        setSelectedTeamId(null);
        setMembers(null);
      }
      await loadTeams();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete team');
    }
  }

  async function handleAddMember() {
    if (!selectedTeamId || !addUserId) return;
    try {
      await adminTeamsApi.addMember(selectedTeamId, addUserId);
      setAddUserId('');
      await loadMembers(selectedTeamId);
      await loadTeams();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add member');
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!selectedTeamId) return;
    try {
      await adminTeamsApi.removeMember(selectedTeamId, userId);
      await loadMembers(selectedTeamId);
      await loadTeams();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to remove member');
    }
  }

  const memberIds = new Set(members?.map((m) => m.id));
  const pickableUsers = (allUsers ?? []).filter((u) => !memberIds.has(u.id));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Teams</CardTitle>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button>Create team</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Create team</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="team-name">Name</Label>
                <Input id="team-name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="team-description">Description</Label>
                <Input id="team-description" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">All teams</h3>
            <Table>
              <TableBody>
                {teams?.map((t) => (
                  <TableRow
                    key={t.id}
                    className={cn('cursor-pointer', selectedTeamId === t.id && 'bg-muted/50')}
                    onClick={() => openTeam(t.id)}
                  >
                    <TableCell>
                      <span className="font-medium text-foreground">{t.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{t._count?.members ?? 0} members</span>
                      {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTeam(t.id);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {teams && teams.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No teams yet.</p>}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Members</h3>
            {!selectedTeamId && <p className="text-sm text-muted-foreground">Select a team to manage its members.</p>}
            {selectedTeamId && (
              <>
                <div className="mb-3 flex gap-2">
                  <div className="flex-1">
                    <MemberPicker users={pickableUsers} value={addUserId} onSelect={setAddUserId} />
                  </div>
                  <Button type="button" disabled={!addUserId} onClick={handleAddMember}>
                    Add
                  </Button>
                </div>

                <Table>
                  <TableBody>
                    {members?.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <p className="text-sm font-medium text-foreground">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => handleRemoveMember(m.id)}>
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {members && members.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No members yet.</p>}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
