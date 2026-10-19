import { Router } from 'express';
import { z } from 'zod';
import { CustomFieldType, ProjectRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireProjectRole } from '../../middleware/projectAccess';
import { asyncHandler, HttpError } from '../../middleware/errorHandler';

// Mounted at /api/projects/:projectId/custom-fields
export const customFieldsRouter = Router({ mergeParams: true });
customFieldsRouter.use(requireAuth);

customFieldsRouter.get(
  '/',
  requireProjectRole(ProjectRole.VIEWER),
  asyncHandler(async (req, res) => {
    const definitions = await prisma.customFieldDefinition.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { order: 'asc' },
    });
    res.json(definitions);
  })
);

const optionsSchema = z.array(z.string().min(1).max(100)).max(50).optional();

const createSchema = z
  .object({
    name: z.string().min(1).max(100),
    fieldType: z.nativeEnum(CustomFieldType),
    options: optionsSchema,
    required: z.boolean().optional(),
  })
  .refine((v) => v.fieldType !== 'SELECT' || (v.options && v.options.length > 0), {
    message: 'SELECT fields require at least one option',
    path: ['options'],
  });

customFieldsRouter.post(
  '/',
  requireProjectRole(ProjectRole.ADMIN),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const input = createSchema.parse(req.body);

    const maxOrder = await prisma.customFieldDefinition.aggregate({ where: { projectId }, _max: { order: true } });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    const definition = await prisma.customFieldDefinition.create({
      data: {
        projectId,
        name: input.name,
        fieldType: input.fieldType,
        options: input.fieldType === 'SELECT' ? input.options : undefined,
        required: input.required ?? false,
        order: nextOrder,
      },
    });
    res.status(201).json(definition);
  })
);

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  options: optionsSchema,
  required: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

async function loadDefinitionInProject(projectId: string, id: string) {
  const definition = await prisma.customFieldDefinition.findUnique({ where: { id } });
  if (!definition || definition.projectId !== projectId) {
    throw new HttpError(404, 'Custom field not found');
  }
  return definition;
}

customFieldsRouter.patch(
  '/:id',
  requireProjectRole(ProjectRole.ADMIN),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const existing = await loadDefinitionInProject(projectId, req.params.id);
    const input = updateSchema.parse(req.body);

    if (existing.fieldType === 'SELECT' && input.options !== undefined && input.options.length === 0) {
      throw new HttpError(400, 'SELECT fields require at least one option');
    }

    const updated = await prisma.customFieldDefinition.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        options: existing.fieldType === 'SELECT' ? input.options : undefined,
        required: input.required,
        order: input.order,
      },
    });
    res.json(updated);
  })
);

customFieldsRouter.delete(
  '/:id',
  requireProjectRole(ProjectRole.ADMIN),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const existing = await loadDefinitionInProject(projectId, req.params.id);
    // Cascade-removes this field's CustomFieldValue rows — fine here since
    // it's just field data, unlike WorkflowStatus's referential-integrity-
    // sensitive delete (see workflow module).
    await prisma.customFieldDefinition.delete({ where: { id: existing.id } });
    res.status(204).send();
  })
);
