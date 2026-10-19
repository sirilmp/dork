import { MouseEvent } from 'react';
import { Star } from 'lucide-react';
import { Project } from '../api/types';
import { useStarredProjects } from '../contexts/StarredProjectsContext';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

export function StarButton({ project, className }: { project: Project; className?: string }) {
  const { starredIds, toggle } = useStarredProjects();
  const starred = starredIds.has(project.id);

  async function handleClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await toggle(project);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className={cn('h-7 w-7 text-muted-foreground hover:text-foreground', className)}
      title={starred ? 'Unstar project' : 'Star project'}
      aria-label={starred ? 'Unstar project' : 'Star project'}
    >
      <Star className={cn('h-4 w-4', starred && 'fill-amber-400 text-amber-400')} />
    </Button>
  );
}
