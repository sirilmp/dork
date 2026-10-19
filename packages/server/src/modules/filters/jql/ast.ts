export type ComparisonOp = '=' | '!=' | '>' | '>=' | '<' | '<=';

/**
 * `cf.<name>` is the chosen syntax for referencing a per-project custom
 * field by its (dynamic, admin-defined) name — dot notation mirrors how
 * Jira itself exposes custom fields as `cf[12345]`, but since this app's
 * custom fields are named rather than numbered, `cf.Severity` (or
 * `cf."Story Estimate"` when the name has spaces) keeps the reference
 * both human-readable and unambiguous against the fixed built-in fields.
 */
export interface FieldRef {
  name: string;
  customFieldName?: string;
}

export type ValueLiteral =
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'ident'; value: string }
  | { kind: 'currentUser' };

export interface ComparisonNode {
  type: 'comparison';
  field: FieldRef;
  op: ComparisonOp;
  value: ValueLiteral;
}

export interface InNode {
  type: 'in';
  field: FieldRef;
  negated: boolean;
  values: ValueLiteral[];
}

export interface EmptyNode {
  type: 'empty';
  field: FieldRef;
  negated: boolean;
}

export type ConditionNode = ComparisonNode | InNode | EmptyNode;

export interface NotNode {
  type: 'not';
  expr: ExprNode;
}
export interface AndNode {
  type: 'and';
  left: ExprNode;
  right: ExprNode;
}
export interface OrNode {
  type: 'or';
  left: ExprNode;
  right: ExprNode;
}

export type ExprNode = ConditionNode | NotNode | AndNode | OrNode;

export interface OrderBy {
  field: string;
  dir: 'ASC' | 'DESC';
}

export interface JqlQuery {
  where: ExprNode | null;
  orderBy: OrderBy | null;
}
