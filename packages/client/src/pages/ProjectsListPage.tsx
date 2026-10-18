import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '../api/projects';
import { Project } from '../api/types';
import { ApiError } from '../api/client';

export function ProjectsListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const result = await projectsApi.list();
    setProjects(result);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await projectsApi.create({ name, key: key || undefined });
      setName('');
      setKey('');
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create project');
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Projects</h1>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {showCreate ? 'Cancel' : 'New project'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Project name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Key (optional)
            <input
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="e.g. PROJ"
              className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Create
          </button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </form>
      )}

      {loading ? (
        <p className="text-slate-500">Loading projects...</p>
      ) : projects.length === 0 ? (
        <p className="text-slate-500">No projects yet. Create one to get started.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}/board`}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-primary"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {project.key}
                </span>
                <span className="text-xs text-slate-400">{project._count?.issues ?? 0} issues</span>
              </div>
              <h2 className="font-semibold text-slate-800">{project.name}</h2>
              {project.description && <p className="mt-1 text-sm text-slate-500 line-clamp-2">{project.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
