import { Token, tokenize, JqlSyntaxError } from './tokenizer';
import {
  ComparisonOp,
  ExprNode,
  FieldRef,
  JqlQuery,
  OrderBy,
  ValueLiteral,
} from './ast';

const KEYWORDS = new Set(['AND', 'OR', 'NOT', 'IN', 'IS', 'EMPTY', 'ORDER', 'BY', 'ASC', 'DESC']);

function isKeyword(tok: Token, word: string): boolean {
  return tok.type === 'IDENT' && tok.value.toUpperCase() === word;
}

/**
 * Recursive-descent parser for the JQL-like subset:
 *
 *   query      := orExpr? (ORDER BY field (ASC|DESC)?)? EOF
 *   orExpr     := andExpr (OR andExpr)*
 *   andExpr    := unary (AND unary)*
 *   unary      := NOT unary | primary
 *   primary    := '(' orExpr ')' | comparison
 *   comparison := field ( op value
 *                       | ('NOT')? 'IN' '(' value (',' value)* ')'
 *                       | 'IS' ('NOT')? 'EMPTY' )
 *   field      := IDENT | 'cf' '.' (IDENT | STRING)
 *   value      := STRING | NUMBER | IDENT | 'currentUser' '(' ')'
 */
export class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(input: string) {
    this.tokens = tokenize(input);
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: Token['type'], what: string): Token {
    const tok = this.peek();
    if (tok.type !== type) {
      throw new JqlSyntaxError(
        `Unexpected ${this.describe(tok)} at position ${tok.pos}, expected ${what}`,
        tok.pos
      );
    }
    return this.advance();
  }

  private describe(tok: Token): string {
    if (tok.type === 'EOF') return 'end of query';
    return `token '${tok.value}'`;
  }

  parse(): JqlQuery {
    let where: ExprNode | null = null;
    if (this.peek().type !== 'EOF' && !isKeyword(this.peek(), 'ORDER')) {
      where = this.parseOr();
    }

    let orderBy: OrderBy | null = null;
    if (isKeyword(this.peek(), 'ORDER')) {
      this.advance();
      if (!isKeyword(this.peek(), 'BY')) {
        const tok = this.peek();
        throw new JqlSyntaxError(`Unexpected ${this.describe(tok)} at position ${tok.pos}, expected 'BY'`, tok.pos);
      }
      this.advance();
      const fieldTok = this.expect('IDENT', 'a field name to order by');
      let dir: 'ASC' | 'DESC' = 'ASC';
      if (isKeyword(this.peek(), 'ASC')) {
        this.advance();
      } else if (isKeyword(this.peek(), 'DESC')) {
        this.advance();
        dir = 'DESC';
      }
      orderBy = { field: fieldTok.value.toLowerCase(), dir };
    }

    const tail = this.peek();
    if (tail.type !== 'EOF') {
      throw new JqlSyntaxError(`Unexpected ${this.describe(tail)} at position ${tail.pos}`, tail.pos);
    }

    return { where, orderBy };
  }

  private parseOr(): ExprNode {
    let left = this.parseAnd();
    while (isKeyword(this.peek(), 'OR')) {
      this.advance();
      const right = this.parseAnd();
      left = { type: 'or', left, right };
    }
    return left;
  }

  private parseAnd(): ExprNode {
    let left = this.parseUnary();
    while (isKeyword(this.peek(), 'AND')) {
      this.advance();
      const right = this.parseUnary();
      left = { type: 'and', left, right };
    }
    return left;
  }

  private parseUnary(): ExprNode {
    if (isKeyword(this.peek(), 'NOT')) {
      this.advance();
      const expr = this.parseUnary();
      return { type: 'not', expr };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExprNode {
    if (this.peek().type === 'LPAREN') {
      this.advance();
      const expr = this.parseOr();
      this.expect('RPAREN', "')'");
      return expr;
    }
    return this.parseComparison();
  }

  private parseField(): FieldRef {
    const tok = this.expect('IDENT', 'a field name');
    const name = tok.value.toLowerCase();
    if (name === 'cf') {
      this.expect('DOT', "'.' followed by a custom field name (e.g. cf.Severity)");
      const next = this.peek();
      let customFieldName: string;
      if (next.type === 'STRING') {
        customFieldName = this.advance().value;
      } else if (next.type === 'IDENT') {
        customFieldName = this.advance().value;
      } else {
        throw new JqlSyntaxError(
          `Unexpected ${this.describe(next)} at position ${next.pos}, expected a custom field name after 'cf.'`,
          next.pos
        );
      }
      return { name: 'cf', customFieldName };
    }
    if (this.peek().type === 'DOT') {
      const dotTok = this.peek();
      throw new JqlSyntaxError(
        `Unexpected '.' at position ${dotTok.pos} — only 'cf.<name>' may use dot notation`,
        dotTok.pos
      );
    }
    return { name };
  }

  private parseValue(): ValueLiteral {
    const tok = this.peek();
    if (tok.type === 'STRING') {
      this.advance();
      return { kind: 'string', value: tok.value };
    }
    if (tok.type === 'NUMBER') {
      this.advance();
      return { kind: 'number', value: Number(tok.value) };
    }
    if (tok.type === 'IDENT') {
      if (tok.value === 'currentUser') {
        this.advance();
        this.expect('LPAREN', "'(' (currentUser is a function, e.g. currentUser())");
        this.expect('RPAREN', "')'");
        return { kind: 'currentUser' };
      }
      this.advance();
      return { kind: 'ident', value: tok.value };
    }
    throw new JqlSyntaxError(`Unexpected ${this.describe(tok)} at position ${tok.pos}, expected a value`, tok.pos);
  }

  private parseComparison(): ExprNode {
    const field = this.parseField();
    const tok = this.peek();

    // field NOT IN (...)
    if (isKeyword(tok, 'NOT')) {
      this.advance();
      if (!isKeyword(this.peek(), 'IN')) {
        const t = this.peek();
        throw new JqlSyntaxError(`Unexpected ${this.describe(t)} at position ${t.pos}, expected 'IN'`, t.pos);
      }
      this.advance();
      const values = this.parseValueList();
      return { type: 'in', field, negated: true, values };
    }

    // field IN (...)
    if (isKeyword(tok, 'IN')) {
      this.advance();
      const values = this.parseValueList();
      return { type: 'in', field, negated: false, values };
    }

    // field IS [NOT] EMPTY
    if (isKeyword(tok, 'IS')) {
      this.advance();
      let negated = false;
      if (isKeyword(this.peek(), 'NOT')) {
        negated = true;
        this.advance();
      }
      if (!isKeyword(this.peek(), 'EMPTY')) {
        const t = this.peek();
        throw new JqlSyntaxError(`Unexpected ${this.describe(t)} at position ${t.pos}, expected 'EMPTY'`, t.pos);
      }
      this.advance();
      return { type: 'empty', field, negated };
    }

    // field <op> value
    if (tok.type === 'OP') {
      this.advance();
      const value = this.parseValue();
      return { type: 'comparison', field, op: tok.value as ComparisonOp, value };
    }

    throw new JqlSyntaxError(
      `Unexpected ${this.describe(tok)} at position ${tok.pos}, expected an operator (=, !=, >, >=, <, <=, IN, IS)`,
      tok.pos
    );
  }

  private parseValueList(): ValueLiteral[] {
    this.expect('LPAREN', "'(' to start a value list");
    const values: ValueLiteral[] = [this.parseValue()];
    while (this.peek().type === 'COMMA') {
      this.advance();
      values.push(this.parseValue());
    }
    this.expect('RPAREN', "')' to close the value list");
    return values;
  }
}

export function parseJql(input: string): JqlQuery {
  return new Parser(input).parse();
}

export { JqlSyntaxError };
export const RESERVED_KEYWORDS = KEYWORDS;
