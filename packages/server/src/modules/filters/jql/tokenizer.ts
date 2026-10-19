/**
 * Tokenizer for the JQL-like query language. Pure lexical analysis only —
 * no knowledge of field names or grammar, so it stays reusable if the
 * grammar grows. Every token carries its source `pos` (0-based character
 * offset) so the parser can produce "Unexpected token at position N" errors.
 */

export type TokenType =
  | 'IDENT'
  | 'STRING'
  | 'NUMBER'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'DOT'
  | 'OP' // = != > >= < <=
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

export class JqlSyntaxError extends Error {
  pos: number;
  constructor(message: string, pos: number) {
    super(message);
    this.pos = pos;
    this.name = 'JqlSyntaxError';
  }
}

const OP_CHARS = new Set(['=', '!', '>', '<']);

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', pos: i });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', pos: i });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ',', pos: i });
      i++;
      continue;
    }
    if (ch === '.') {
      tokens.push({ type: 'DOT', value: '.', pos: i });
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i++;
      let out = '';
      let closed = false;
      while (i < n) {
        const c = input[i];
        if (c === '\\' && i + 1 < n) {
          out += input[i + 1];
          i += 2;
          continue;
        }
        if (c === quote) {
          closed = true;
          i++;
          break;
        }
        out += c;
        i++;
      }
      if (!closed) throw new JqlSyntaxError(`Unterminated string literal starting at position ${start}`, start);
      tokens.push({ type: 'STRING', value: out, pos: start });
      continue;
    }

    if (OP_CHARS.has(ch)) {
      const start = i;
      let op = ch;
      if (input[i + 1] === '=') op += '=';
      if (op === '!' ) throw new JqlSyntaxError(`Unexpected '!' at position ${start}, expected '!='`, start);
      tokens.push({ type: 'OP', value: op, pos: start });
      i += op.length;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(input[i + 1] ?? ''))) {
      const start = i;
      let j = i + 1;
      if (ch === '-') j = i + 1;
      while (j < n && /[0-9]/.test(input[j])) j++;
      if (input[j] === '.' && /[0-9]/.test(input[j + 1] ?? '')) {
        j++;
        while (j < n && /[0-9]/.test(input[j])) j++;
      }
      tokens.push({ type: 'NUMBER', value: input.slice(start, j), pos: start });
      i = j;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      const start = i;
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(input[j])) j++;
      tokens.push({ type: 'IDENT', value: input.slice(start, j), pos: start });
      i = j;
      continue;
    }

    throw new JqlSyntaxError(`Unexpected character '${ch}' at position ${i}`, i);
  }

  tokens.push({ type: 'EOF', value: '', pos: n });
  return tokens;
}
