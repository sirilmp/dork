import { CustomFieldType, Issue, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

/** Plain-text extraction from a Tiptap document JSON, used as the derived
 * `description` fallback for search/preview — see Issue.descriptionJson. */
export function extractPlainText(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return '';
  const node = doc as { type?: string; text?: string; content?: unknown[] };
  let out = node.text ?? '';
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      out += extractPlainText(child);
      if ((child as { type?: string })?.type && out.length > 0 && !out.endsWith('\n')) {
        // Separate block-level nodes with a space so words from adjacent
        // paragraphs/list items don't run together in the plain-text fallback.
        out += ' ';
      }
    }
  }
  return out;
}

/** Validates a raw custom-field value against its definition's type/options,
 * returning the normalized JSON value to store (or throws). */
export function validateCustomFieldValue(
  fieldType: CustomFieldType,
  options: unknown,
  value: unknown
): string | number | boolean {
  switch (fieldType) {
    case 'TEXT':
      if (typeof value !== 'string') throw new Error('Value must be a string for a TEXT field');
      return value;
    case 'NUMBER':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error('Value must be a number for a NUMBER field');
      }
      return value;
    case 'DATE':
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
        throw new Error('Value must be an ISO date string for a DATE field');
      }
      return value;
    case 'CHECKBOX':
      if (typeof value !== 'boolean') throw new Error('Value must be a boolean for a CHECKBOX field');
      return value;
    case 'SELECT': {
      if (typeof value !== 'string') throw new Error('Value must be a string for a SELECT field');
      const choices = Array.isArray(options) ? (options as unknown[]) : [];
      if (!choices.includes(value)) throw new Error(`Value must be one of: ${choices.join(', ')}`);
      return value;
    }
    default:
      throw new Error(`Unknown field type: ${fieldType}`);
  }
}

/** Records a diff entry in the issue's activity log. No-op if values are equal. */
export async function logActivity(
  issueId: string,
  actorId: string,
  field: string,
  oldValue: string | null,
  newValue: string | null
) {
  if (oldValue === newValue) return;
  await prisma.activityLog.create({
    data: { issueId, actorId, field, oldValue, newValue },
  });
}

/** Atomically allocates the next sequential issue number for a project. */
export async function nextIssueNumber(projectId: string): Promise<number> {
  const project = await prisma.project.update({
    where: { id: projectId },
    data: { issueCounter: { increment: 1 } },
    select: { issueCounter: true },
  });
  return project.issueCounter;
}

export function issueKey(projectKey: string, number: number): string {
  return `${projectKey}-${number}`;
}

/**
 * Validates and upserts a set of { fieldDefinitionId, value } pairs for an
 * issue inside the given transaction. `value: null` clears the field. Throws
 * HttpError-free plain Error on any invalid field id / type mismatch /
 * missing required value so the route can wrap it into a 400.
 *
 * Required-field enforcement: applied to whatever set of definitions this
 * call is given (`enforceRequiredFor`), not to every definition in the
 * project — the create-issue form doesn't yet expose custom fields, so
 * requiring them unconditionally at creation would block issue creation for
 * projects with a required custom field. Required is enforced whenever the
 * caller does pass customFieldValues (i.e. the client is custom-field-aware).
 */
export async function applyCustomFieldValues(
  tx: Prisma.TransactionClient,
  projectId: string,
  issueId: string,
  entries: Array<{ fieldDefinitionId: string; value: unknown }>,
  enforceRequired: boolean
) {
  const definitions = await tx.customFieldDefinition.findMany({ where: { projectId } });
  const byId = new Map(definitions.map((d) => [d.id, d]));

  for (const entry of entries) {
    const def = byId.get(entry.fieldDefinitionId);
    if (!def) throw new Error(`Unknown custom field: ${entry.fieldDefinitionId}`);
    if (entry.value === null) {
      await tx.customFieldValue.deleteMany({ where: { issueId, fieldDefinitionId: def.id } });
      continue;
    }
    const normalized = validateCustomFieldValue(def.fieldType, def.options, entry.value);
    await tx.customFieldValue.upsert({
      where: { issueId_fieldDefinitionId: { issueId, fieldDefinitionId: def.id } },
      create: { issueId, fieldDefinitionId: def.id, value: normalized as any },
      update: { value: normalized as any },
    });
  }

  if (enforceRequired) {
    const providedIds = new Set(entries.map((e) => e.fieldDefinitionId));
    const existingValues = await tx.customFieldValue.findMany({ where: { issueId } });
    const hasValueIds = new Set(existingValues.map((v) => v.fieldDefinitionId));
    for (const def of definitions) {
      if (!def.required) continue;
      const willHaveValue = providedIds.has(def.id)
        ? entries.find((e) => e.fieldDefinitionId === def.id)!.value !== null
        : hasValueIds.has(def.id);
      if (!willHaveValue) throw new Error(`"${def.name}" is required`);
    }
  }
}

export const issueInclude = {
  assignee: { select: { id: true, name: true, avatarUrl: true, email: true } },
  reporter: { select: { id: true, name: true, avatarUrl: true, email: true } },
  labels: { include: { label: true } },
  project: {
    select: {
      id: true,
      key: true,
      name: true,
      // Joined so the client can render every custom field (including unset
      // ones), not just ones with a value row for this issue.
      customFieldDefinitions: { orderBy: { order: 'asc' as const } },
    },
  },
  // Full workflow status (not just the id) so board/backlog/etc. can render
  // name/category/color without a second round-trip.
  status: { select: { id: true, name: true, category: true, color: true, order: true } },
  // Minimal parent summary so the client can bucket issues into epic
  // swimlanes (an issue belongs to its parent's epic only when that parent
  // is itself type EPIC) without a second round-trip per issue.
  parent: { select: { id: true, type: true, title: true } },
  customFieldValues: true,
  attachments: {
    include: { uploadedBy: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  _count: { select: { comments: true, children: true } },
} as const;

export function serializeIssue(
  issue: Issue & { project: { id: string; key: string; name: string; customFieldDefinitions?: any[] } } & Record<string, any>
) {
  const definitions: Array<{ id: string }> = issue.project?.customFieldDefinitions ?? [];
  const valueByFieldId = new Map<string, any>((issue.customFieldValues ?? []).map((v: any) => [v.fieldDefinitionId, v.value]));

  return {
    ...issue,
    key: issueKey(issue.project.key, issue.number),
    labels: issue.labels?.map((l: any) => l.label) ?? undefined,
    // Always the full set of the project's field definitions, each paired
    // with this issue's value (or null if unset).
    customFields: definitions.map((def: any) => ({
      id: def.id,
      name: def.name,
      fieldType: def.fieldType,
      options: def.options,
      required: def.required,
      order: def.order,
      value: valueByFieldId.has(def.id) ? valueByFieldId.get(def.id) : null,
    })),
    customFieldValues: undefined,
    project: { id: issue.project.id, key: issue.project.key, name: issue.project.name },
  };
}
