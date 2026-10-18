import { NextFunction, Request, Response } from 'express';
import { ProjectRole, SystemRole } from '@prisma/client';
import { prisma } from '../lib/prisma';

const ROLE_RANK: Record<ProjectRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
};

/**
 * Loads the caller's membership for req.params.projectId and attaches it as
 * req.projectRole. System ADMINs are granted implicit ADMIN project access
 * even without an explicit ProjectMember row.
 */
export function requireProjectRole(minRole: ProjectRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const projectId = req.params.projectId ?? req.body?.projectId;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    if (req.user.role === SystemRole.ADMIN) {
      req.projectRole = ProjectRole.ADMIN;
      return next();
    }

    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: req.user.sub } },
    });

    if (!membership || ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
      return res.status(403).json({ error: 'Insufficient project permissions' });
    }

    req.projectRole = membership.role;
    return next();
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      projectRole?: ProjectRole;
    }
  }
}
