import { Prisma, IssuePriority, IssueType, StatusCategory } from '@prisma/client';
import { ExprNode, FieldRef, JqlQuery, ValueLiteral } from './ast';

export class JqlCompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JqlCompileError';
  }
}

/**
 * Everything the compiler needs resolved from the DB *before* it runs, so
 * the AST -> Prisma translation itself stays a pure, synchronous function
 * with no string concatenation into SQL — only Prisma's typed `where`
 * builder. The service layer builds this scoped to whichever project(s)
 * the query is allowed to touch (see filters.service.ts).
 */
export interface ResolutionContext {
  currentUserId: string;
  /** project key (upper-cased) -> project id, restricted to the query's scope. */
  projectsByKey: Map<string, string>;
  /** status name (lower-cased) -> status ids sharing that name within scope. */
  statusIdsByName: Map<string, string[]>;
  /** label name (lower-cased) -> label ids sharing that name within scope. */
  labelIdsByName: Map<string, string[]>;
  /** sprint name (lower-cased) -> sprint ids sharing that name within scope. */
  sprintIdsByName: Map<string, string[]>;
  /** custom field definition name (lower-cased) -> definition ids sharing that name within scope. */
  customFieldIdsByName: Map<string, string[]>;
  /** user email or display name (lower-cased) -> user id. Email takes precedence on collision. */
  userIdByIdentifier: Map<string, string>;
}

function literalToString(v: ValueLiteral, ctx: ResolutionContext, fieldLabel: string): string {
  if (v.kind === 'string' || v.kind === 'ident') return v.value;
  if (v.kind === 'currentUser') throw new JqlCompileError(`currentUser() is not valid for ${fieldLabel}`);
  throw new JqlCompileError(`Expected a text value for ${fieldLabel}, got a number`);
}

function literalToNumber(v: ValueLiteral, fieldLabel: string): number {
  if (v.kind === 'number') return v.value;
  if (v.kind === 'string' && !Number.isNaN(Number(v.value))) return Number(v.value);
  throw new JqlCompileError(`Expected a number for ${fieldLabel}`);
}

function literalToDate(v: ValueLiteral, fieldLabel: string): Date {
  const raw = v.kind === 'string' || v.kind === 'ident' ? v.value : null;
  if (raw === null) throw new JqlCompileError(`Expected a date (YYYY-MM-DD) for ${fieldLabel}`);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new JqlCompileError(`"${raw}" is not a valid date for ${fieldLabel}`);
  return d;
}

function resolveUserId(v: ValueLiteral, ctx: ResolutionContext, fieldLabel: string): string {
  if (v.kind === 'currentUser') return ctx.currentUserId;
  const key = literalToString(v, ctx, fieldLabel).toLowerCase();
  const id = ctx.userIdByIdentifier.get(key);
  if (!id) throw new JqlCompileError(`Unknown user "${key}" for ${fieldLabel} (use an email, exact name, or currentUser())`);
  return id;
}

function lookupIds(map: Map<string, string[]>, name: string, kindLabel: string): string[] {
  const ids = map.get(name.toLowerCase());
  if (!ids || ids.length === 0) throw new JqlCompileError(`Unknown ${kindLabel} "${name}"`);
  return ids;
}

const PRIORITIES = new Set<string>(Object.values(IssuePriority));
const TYPES = new Set<string>(Object.values(IssueType));
const CATEGORIES = new Set<string>(Object.values(StatusCategory));

function normalizeEnum(raw: string, allowed: Set<string>, label: string): string {
  const upper = raw.toUpperCase().replace(/\s+/g, '_');
  if (!allowed.has(upper)) {
    throw new JqlCompileError(`"${raw}" is not a valid ${label} (expected one of: ${[...allowed].join(', ')})`);
  }
  return upper;
}

function compareOpToPrisma<T>(op: string, value: T): Record<string, T> {
  switch (op) {
    case '=':
      return { equals: value } as any;
    case '!=':
      return { not: value } as any;
    case '>':
      return { gt: value } as any;
    case '>=':
      return { gte: value } as any;
    case '<':
      return { lt: value } as any;
    case '<=':
      return { lte: value } as any;
    default:
      throw new JqlCompileError(`Unsupported operator "${op}"`);
  }
}

function customFieldCondition(
  field: FieldRef,
  ctx: ResolutionContext,
  build: (ids: string[]) => Prisma.IssueWhereInput
): Prisma.IssueWhereInput {
  const name = field.customFieldName!;
  const ids = lookupIds(ctx.customFieldIdsByName, name, `custom field "cf.${name}"`);
  return build(ids);
}

function compileComparison(
  field: FieldRef,
  op: string,
  value: ValueLiteral,
  ctx: ResolutionContext
): Prisma.IssueWhereInput {
  const ORDER_OPS = new Set(['>', '>=', '<', '<=']);

  if (field.name === 'cf') {
    const name = field.customFieldName!;
    return customFieldCondition(field, ctx, (ids) => {
      const jsonValue = value.kind === 'number' ? value.value : literalToString(value, ctx, `cf.${name}`);
      const filter = compareOpToPrisma(op, jsonValue as any);
      return op === '!='
        ? { customFieldValues: { none: { fieldDefinitionId: { in: ids }, value: filter as any } } }
        : { customFieldValues: { some: { fieldDefinitionId: { in: ids }, value: filter as any } } };
    });
  }

  switch (field.name) {
    case 'project': {
      const key = literalToString(value, ctx, 'project').toUpperCase();
      const id = ctx.projectsByKey.get(key);
      if (!id) throw new JqlCompileError(`Unknown or inaccessible project "${key}"`);
      if (op !== '=' && op !== '!=') throw new JqlCompileError(`Operator "${op}" is not valid for project`);
      return { projectId: op === '=' ? id : { not: id } };
    }
    case 'status': {
      const name = literalToString(value, ctx, 'status');
      const ids = lookupIds(ctx.statusIdsByName, name, 'status');
      if (op !== '=' && op !== '!=') throw new JqlCompileError(`Operator "${op}" is not valid for status`);
      return { statusId: op === '=' ? { in: ids } : { notIn: ids } };
    }
    case 'statuscategory': {
      const cat = normalizeEnum(literalToString(value, ctx, 'statusCategory'), CATEGORIES, 'statusCategory');
      if (op !== '=' && op !== '!=') throw new JqlCompileError(`Operator "${op}" is not valid for statusCategory`);
      return { status: { category: op === '=' ? (cat as StatusCategory) : { not: cat as StatusCategory } } };
    }
    case 'assignee': {
      if (op !== '=' && op !== '!=') throw new JqlCompileError(`Operator "${op}" is not valid for assignee`);
      const userId = resolveUserId(value, ctx, 'assignee');
      return { assigneeId: op === '=' ? userId : { not: userId } };
    }
    case 'reporter': {
      if (op !== '=' && op !== '!=') throw new JqlCompileError(`Operator "${op}" is not valid for reporter`);
      const userId = resolveUserId(value, ctx, 'reporter');
      return { reporterId: op === '=' ? userId : { not: userId } };
    }
    case 'priority': {
      const p = normalizeEnum(literalToString(value, ctx, 'priority'), PRIORITIES, 'priority');
      if (op !== '=' && op !== '!=') throw new JqlCompileError(`Operator "${op}" is not valid for priority`);
      return { priority: op === '=' ? (p as IssuePriority) : { not: p as IssuePriority } };
    }
    case 'type': {
      const t = normalizeEnum(literalToString(value, ctx, 'type'), TYPES, 'type');
      if (op !== '=' && op !== '!=') throw new JqlCompileError(`Operator "${op}" is not valid for type`);
      return { type: op === '=' ? (t as IssueType) : { not: t as IssueType } };
    }
    case 'label': {
      const name = literalToString(value, ctx, 'label');
      const ids = lookupIds(ctx.labelIdsByName, name, 'label');
      if (op !== '=' && op !== '!=') throw new JqlCompileError(`Operator "${op}" is not valid for label`);
      return op === '='
        ? { labels: { some: { labelId: { in: ids } } } }
        : { labels: { none: { labelId: { in: ids } } } };
    }
    case 'sprint': {
      const name = literalToString(value, ctx, 'sprint');
      const ids = lookupIds(ctx.sprintIdsByName, name, 'sprint');
      if (op !== '=' && op !== '!=') throw new JqlCompileError(`Operator "${op}" is not valid for sprint`);
      return { sprintId: op === '=' ? { in: ids } : { notIn: ids } };
    }
    case 'duedate': {
      const d = literalToDate(value, 'dueDate');
      return { dueDate: compareOpToPrisma(op, d) as any };
    }
    case 'storypoints': {
      const num = literalToNumber(value, 'storyPoints');
      return { storyPoints: compareOpToPrisma(op, num) as any };
    }
    case 'text': {
      if (op !== '=') throw new JqlCompileError(`Operator "${op}" is not valid for text — only "=" (contains) is supported`);
      const needle = literalToString(value, ctx, 'text');
      return {
        OR: [
          { title: { contains: needle, mode: 'insensitive' } },
          { description: { contains: needle, mode: 'insensitive' } },
        ],
      };
    }
    default:
      if (ORDER_OPS.has(op)) {
        throw new JqlCompileError(`Unknown field "${field.name}"`);
      }
      throw new JqlCompileError(`Unknown field "${field.name}"`);
  }
}

function compileIn(field: FieldRef, negated: boolean, values: ValueLiteral[], ctx: ResolutionContext): Prisma.IssueWhereInput {
  if (field.name === 'cf') {
    const name = field.customFieldName!;
    return customFieldCondition(field, ctx, (ids) => {
      const conditions: Prisma.IssueWhereInput[] = values.map((v) => {
        const jsonValue = v.kind === 'number' ? v.value : literalToString(v, ctx, `cf.${name}`);
        return { customFieldValues: { some: { fieldDefinitionId: { in: ids }, value: { equals: jsonValue as any } } } };
      });
      return negated ? { NOT: { OR: conditions } } : { OR: conditions };
    });
  }

  switch (field.name) {
    case 'project': {
      const ids = values.map((v) => {
        const key = literalToString(v, ctx, 'project').toUpperCase();
        const id = ctx.projectsByKey.get(key);
        if (!id) throw new JqlCompileError(`Unknown or inaccessible project "${key}"`);
        return id;
      });
      return { projectId: negated ? { notIn: ids } : { in: ids } };
    }
    case 'status': {
      const ids = values.flatMap((v) => lookupIds(ctx.statusIdsByName, literalToString(v, ctx, 'status'), 'status'));
      return { statusId: negated ? { notIn: ids } : { in: ids } };
    }
    case 'statuscategory': {
      const cats = values.map((v) => normalizeEnum(literalToString(v, ctx, 'statusCategory'), CATEGORIES, 'statusCategory') as StatusCategory);
      return { status: { category: negated ? { notIn: cats } : { in: cats } } };
    }
    case 'assignee': {
      const ids = values.map((v) => resolveUserId(v, ctx, 'assignee'));
      return { assigneeId: negated ? { notIn: ids } : { in: ids } };
    }
    case 'reporter': {
      const ids = values.map((v) => resolveUserId(v, ctx, 'reporter'));
      return { reporterId: negated ? { notIn: ids } : { in: ids } };
    }
    case 'priority': {
      const ps = values.map((v) => normalizeEnum(literalToString(v, ctx, 'priority'), PRIORITIES, 'priority') as IssuePriority);
      return { priority: negated ? { notIn: ps } : { in: ps } };
    }
    case 'type': {
      const ts = values.map((v) => normalizeEnum(literalToString(v, ctx, 'type'), TYPES, 'type') as IssueType);
      return { type: negated ? { notIn: ts } : { in: ts } };
    }
    case 'label': {
      const ids = values.flatMap((v) => lookupIds(ctx.labelIdsByName, literalToString(v, ctx, 'label'), 'label'));
      return negated ? { labels: { none: { labelId: { in: ids } } } } : { labels: { some: { labelId: { in: ids } } } };
    }
    case 'sprint': {
      const ids = values.flatMap((v) => lookupIds(ctx.sprintIdsByName, literalToString(v, ctx, 'sprint'), 'sprint'));
      return { sprintId: negated ? { notIn: ids } : { in: ids } };
    }
    default:
      throw new JqlCompileError(`"${field.name}" does not support IN(...)`);
  }
}

function compileEmpty(field: FieldRef, negated: boolean, ctx: ResolutionContext): Prisma.IssueWhereInput {
  if (field.name === 'cf') {
    return customFieldCondition(field, ctx, (ids) =>
      negated
        ? { customFieldValues: { some: { fieldDefinitionId: { in: ids } } } }
        : { customFieldValues: { none: { fieldDefinitionId: { in: ids } } } }
    );
  }
  switch (field.name) {
    case 'assignee':
      return { assigneeId: negated ? { not: null } : null };
    case 'label':
      return negated ? { labels: { some: {} } } : { labels: { none: {} } };
    case 'sprint':
      return { sprintId: negated ? { not: null } : null };
    case 'duedate':
      return { dueDate: negated ? { not: null } : null };
    case 'storypoints':
      return { storyPoints: negated ? { not: null } : null };
    case 'reporter':
      // reporterId is NOT NULL in the schema: "IS EMPTY" can never match, "IS NOT EMPTY" always does.
      return negated ? {} : { reporterId: { in: [] } };
    default:
      throw new JqlCompileError(`"${field.name}" does not support IS EMPTY`);
  }
}

function compileExpr(node: ExprNode, ctx: ResolutionContext): Prisma.IssueWhereInput {
  switch (node.type) {
    case 'and':
      return { AND: [compileExpr(node.left, ctx), compileExpr(node.right, ctx)] };
    case 'or':
      return { OR: [compileExpr(node.left, ctx), compileExpr(node.right, ctx)] };
    case 'not':
      return { NOT: compileExpr(node.expr, ctx) };
    case 'comparison':
      return compileComparison(node.field, node.op, node.value, ctx);
    case 'in':
      return compileIn(node.field, node.negated, node.values, ctx);
    case 'empty':
      return compileEmpty(node.field, node.negated, ctx);
    default:
      throw new JqlCompileError('Unknown expression node');
  }
}

const ORDERABLE_FIELDS = new Set([
  'project',
  'status',
  'statuscategory',
  'assignee',
  'reporter',
  'priority',
  'type',
  'duedate',
  'storypoints',
  'createdat',
  'updatedat',
]);

export function compileOrderBy(query: JqlQuery): Prisma.IssueOrderByWithRelationInput | undefined {
  if (!query.orderBy) return undefined;
  const { field, dir } = query.orderBy;
  const sortDir = dir === 'ASC' ? 'asc' : 'desc';
  if (!ORDERABLE_FIELDS.has(field)) {
    throw new JqlCompileError(
      `"${query.orderBy.field}" cannot be used in ORDER BY (supported: ${[...ORDERABLE_FIELDS].join(', ')})`
    );
  }
  switch (field) {
    case 'project':
      return { projectId: sortDir };
    case 'status':
      return { status: { order: sortDir } };
    case 'statuscategory':
      return { status: { category: sortDir } };
    case 'assignee':
      return { assignee: { name: sortDir } };
    case 'reporter':
      return { reporter: { name: sortDir } };
    case 'priority':
      return { priority: sortDir };
    case 'type':
      return { type: sortDir };
    case 'duedate':
      return { dueDate: sortDir };
    case 'storypoints':
      return { storyPoints: sortDir };
    case 'createdat':
      return { createdAt: sortDir };
    case 'updatedat':
      return { updatedAt: sortDir };
    default:
      return undefined;
  }
}

export function compileWhere(query: JqlQuery, ctx: ResolutionContext): Prisma.IssueWhereInput {
  if (!query.where) return {};
  return compileExpr(query.where, ctx);
}
