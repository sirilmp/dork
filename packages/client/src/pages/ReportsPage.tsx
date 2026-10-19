import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { reportsApi } from '../api/reports';
import { projectsApi } from '../api/projects';
import { ApiError } from '../api/client';
import { CFDPoint, Project, VelocityPoint } from '../api/types';
import { Card } from '../components/ui/card';
import { DatePicker } from '../components/ui/date-picker';
import { VelocityChart } from '../components/VelocityChart';
import { CFDChart } from '../components/CFDChart';
import { StarButton } from '../components/StarButton';
import { ProjectViewTabs } from '../components/ProjectViewTabs';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

export function ReportsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project>();
  const [velocity, setVelocity] = useState<VelocityPoint[]>();
  const [velocityError, setVelocityError] = useState<string | null>(null);
  const [cfd, setCfd] = useState<CFDPoint[]>();
  const [cfdError, setCfdError] = useState<string | null>(null);
  const [from, setFrom] = useState<string>(daysAgo(29));
  const [to, setTo] = useState<string>(isoToday());
  const { recordView } = useRecentlyViewed();

  useEffect(() => {
    if (!projectId) return;
    projectsApi.get(projectId).then((p) => {
      setProject(p);
      recordView({ kind: 'project', id: p.id, label: p.name, meta: p.key, href: `/projects/${p.id}/board` });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    reportsApi
      .velocity(projectId)
      .then(setVelocity)
      .catch((err) => setVelocityError(err instanceof ApiError ? err.message : 'Failed to load velocity'));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    reportsApi
      .cfd(projectId, { from, to })
      .then(setCfd)
      .catch((err) => setCfdError(err instanceof ApiError ? err.message : 'Failed to load cumulative flow diagram'));
  }, [projectId, from, to]);

  if (!project) {
    return <div className="px-4 py-8 text-muted-foreground">Loading reports...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4">
        <h1 className="flex items-center gap-1 text-xl font-semibold text-foreground">
          {project.name} <span className="text-muted-foreground">({project.key})</span>
          <StarButton project={project} />
        </h1>
        <ProjectViewTabs projectId={project.id} active="reports" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Velocity</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Committed vs. completed story points for each completed sprint, oldest first.
          </p>
          {velocityError ? (
            <p className="text-sm text-destructive">{velocityError}</p>
          ) : !velocity ? (
            <p className="text-sm text-muted-foreground">Loading velocity...</p>
          ) : (
            <VelocityChart points={velocity} />
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Cumulative flow</h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Issue counts by status category over time. The Done band growing at the bottom is work completed.
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="w-40">
              <DatePicker value={from} onChange={(v) => v && setFrom(v)} placeholder="From" />
            </div>
            <span className="text-xs text-muted-foreground">to</span>
            <div className="w-40">
              <DatePicker value={to} onChange={(v) => v && setTo(v)} placeholder="To" />
            </div>
          </div>
          {cfdError ? (
            <p className="text-sm text-destructive">{cfdError}</p>
          ) : !cfd ? (
            <p className="text-sm text-muted-foreground">Loading cumulative flow diagram...</p>
          ) : (
            <CFDChart points={cfd} />
          )}
        </Card>
      </div>
    </div>
  );
}
