import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { meApi } from '../api/me';
import { projectsApi } from '../api/projects';
import { Project } from '../api/types';
import { useAuth } from '../auth/AuthContext';

// Starred, unlike Recent, is backend-persisted (StarredProject model) so it
// follows the account across devices like Jira's own Starred list. This
// context fetches it once and shares it between the sidebar (which lists
// starred projects) and the star-toggle buttons on the Projects list /
// project header (which need to read+flip the same state).
interface StarredProjectsContextValue {
  starredProjects: Project[];
  starredIds: Set<string>;
  loading: boolean;
  toggle: (project: Project) => Promise<void>;
}

const StarredProjectsContext = createContext<StarredProjectsContextValue>({
  starredProjects: [],
  starredIds: new Set(),
  loading: true,
  toggle: async () => {},
});

export function StarredProjectsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [starredProjects, setStarredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setStarredProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await meApi.starred();
      setStarredProjects(result);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (project: Project) => {
      const isStarred = starredProjects.some((p) => p.id === project.id);
      if (isStarred) {
        setStarredProjects((prev) => prev.filter((p) => p.id !== project.id));
        await projectsApi.unstar(project.id);
      } else {
        setStarredProjects((prev) => [project, ...prev]);
        await projectsApi.star(project.id);
      }
    },
    [starredProjects]
  );

  return (
    <StarredProjectsContext.Provider
      value={{
        starredProjects,
        starredIds: new Set(starredProjects.map((p) => p.id)),
        loading,
        toggle,
      }}
    >
      {children}
    </StarredProjectsContext.Provider>
  );
}

export function useStarredProjects() {
  return useContext(StarredProjectsContext);
}
