import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { signAuthToken, requireAuth } from '../../middleware/auth';
import { asyncHandler, HttpError } from '../../middleware/errorHandler';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(100),
});

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, name } = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, 'An account with that email already exists');

    // First registered user becomes an ADMIN so a fresh self-hosted instance
    // always has at least one admin even without the seed script.
    const userCount = await prisma.user.count();
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: userCount === 0 ? 'ADMIN' : 'MEMBER',
      },
    });

    const token = signAuthToken({ sub: user.id, email: user.email, role: user.role });
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl },
    });
  })
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new HttpError(401, 'Invalid email or password');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new HttpError(401, 'Invalid email or password');

    const token = signAuthToken({ sub: user.id, email: user.email, role: user.role });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl },
    });
  })
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) throw new HttpError(404, 'User not found');
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl });
  })
);
