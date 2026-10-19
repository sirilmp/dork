import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseJql } from './parser';
import { JqlSyntaxError } from './tokenizer';

describe('JQL parser', () => {
  it('parses a single equality comparison', () => {
    const q = parseJql('status = "Done"');
    assert.deepEqual(q.where, {
      type: 'comparison',
      field: { name: 'status' },
      op: '=',
      value: { kind: 'string', value: 'Done' },
    });
    assert.equal(q.orderBy, null);
  });

  it('parses a bare-word (unquoted) value', () => {
    const q = parseJql('priority = High');
    assert.deepEqual(q.where, {
      type: 'comparison',
      field: { name: 'priority' },
      op: '=',
      value: { kind: 'ident', value: 'High' },
    });
  });

  it('parses currentUser()', () => {
    const q = parseJql('assignee = currentUser()');
    assert.deepEqual(q.where, {
      type: 'comparison',
      field: { name: 'assignee' },
      op: '=',
      value: { kind: 'currentUser' },
    });
  });

  it('parses IN (...) with multiple values', () => {
    const q = parseJql('priority IN (High, Highest)');
    assert.deepEqual(q.where, {
      type: 'in',
      field: { name: 'priority' },
      negated: false,
      values: [
        { kind: 'ident', value: 'High' },
        { kind: 'ident', value: 'Highest' },
      ],
    });
  });

  it('parses NOT IN (...)', () => {
    const q = parseJql('status NOT IN ("Done", "Cancelled")');
    assert.equal(q.where?.type, 'in');
    assert.equal((q.where as any).negated, true);
  });

  it('parses IS EMPTY and IS NOT EMPTY', () => {
    const q1 = parseJql('assignee IS EMPTY');
    assert.deepEqual(q1.where, { type: 'empty', field: { name: 'assignee' }, negated: false });

    const q2 = parseJql('assignee IS NOT EMPTY');
    assert.deepEqual(q2.where, { type: 'empty', field: { name: 'assignee' }, negated: true });
  });

  it('parses AND / OR with correct precedence (AND binds tighter than OR)', () => {
    const q = parseJql('a = 1 OR b = 2 AND c = 3');
    assert.equal(q.where?.type, 'or');
    const or = q.where as any;
    assert.equal(or.left.type, 'comparison');
    assert.equal(or.right.type, 'and');
  });

  it('parses parenthesized grouping overriding precedence', () => {
    const q = parseJql('(a = 1 OR b = 2) AND c = 3');
    assert.equal(q.where?.type, 'and');
    const and = q.where as any;
    assert.equal(and.left.type, 'or');
    assert.equal(and.right.type, 'comparison');
  });

  it('parses NOT as a unary prefix', () => {
    const q = parseJql('NOT status = "Done"');
    assert.equal(q.where?.type, 'not');
    assert.equal((q.where as any).expr.type, 'comparison');
  });

  it('parses a custom field reference with cf.<name>', () => {
    const q = parseJql('cf.Severity = "High"');
    assert.deepEqual(q.where, {
      type: 'comparison',
      field: { name: 'cf', customFieldName: 'Severity' },
      op: '=',
      value: { kind: 'string', value: 'High' },
    });
  });

  it('parses a quoted custom field name with spaces', () => {
    const q = parseJql('cf."Story Estimate" > 3');
    assert.deepEqual(q.where, {
      type: 'comparison',
      field: { name: 'cf', customFieldName: 'Story Estimate' },
      op: '>',
      value: { kind: 'number', value: 3 },
    });
  });

  it('parses ORDER BY with direction', () => {
    const q = parseJql('statusCategory != DONE ORDER BY priority DESC');
    assert.equal(q.orderBy?.field, 'priority');
    assert.equal(q.orderBy?.dir, 'DESC');
  });

  it('defaults ORDER BY direction to ASC', () => {
    const q = parseJql('priority = High ORDER BY dueDate');
    assert.equal(q.orderBy?.dir, 'ASC');
  });

  it('parses a query with no WHERE, only ORDER BY', () => {
    const q = parseJql('ORDER BY priority DESC');
    assert.equal(q.where, null);
    assert.equal(q.orderBy?.field, 'priority');
  });

  it('parses comparison operators >, >=, <, <=', () => {
    assert.equal((parseJql('storyPoints > 3').where as any).op, '>');
    assert.equal((parseJql('storyPoints >= 3').where as any).op, '>=');
    assert.equal((parseJql('storyPoints < 3').where as any).op, '<');
    assert.equal((parseJql('storyPoints <= 3').where as any).op, '<=');
  });

  it('is case-insensitive for keywords', () => {
    const q = parseJql('status = "Done" and assignee is not empty');
    assert.equal(q.where?.type, 'and');
  });

  it('throws JqlSyntaxError with a clear message and position for a dangling operator', () => {
    assert.throws(
      () => parseJql('status ='),
      (err: unknown) => {
        assert.ok(err instanceof JqlSyntaxError);
        assert.match(err.message, /Unexpected end of query at position 8, expected a value/);
        return true;
      }
    );
  });

  it('throws on an unknown/garbage token', () => {
    assert.throws(() => parseJql('status = "Done" @'), JqlSyntaxError);
  });

  it('throws a clear error for an unterminated string', () => {
    assert.throws(() => parseJql('status = "Done'), (err: unknown) => {
      assert.ok(err instanceof JqlSyntaxError);
      assert.match(err.message, /Unterminated string/);
      return true;
    });
  });

  it('throws when dot notation is used on a non-cf field', () => {
    assert.throws(() => parseJql('status.name = "Done"'), JqlSyntaxError);
  });

  it('throws on trailing garbage after a complete expression', () => {
    assert.throws(() => parseJql('status = "Done" priority = High'), JqlSyntaxError);
  });

  it('parses a realistic compound query end-to-end', () => {
    const q = parseJql(
      '(status = "In Progress" OR status = "To Do") AND assignee = currentUser() AND priority IN (High, Highest) ORDER BY priority DESC'
    );
    assert.equal(q.where?.type, 'and');
    assert.equal(q.orderBy?.field, 'priority');
    assert.equal(q.orderBy?.dir, 'DESC');
  });
});
