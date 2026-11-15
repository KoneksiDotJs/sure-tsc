import { Decimal, DISPLAY_SCALE } from './core.js';

/**
 * Safe inline arithmetic expression evaluator matching Sure's `evaluate_amount_expression.js`.
 * Supports expressions like "125000 + 15000 * 2" -> "155000.00" or "(45.50 + 12.25) / 2" -> "28.88"
 * Uses a recursive descent parser backed strictly by `Decimal` (no eval() or IEEE-754 floats).
 */
export function evaluateAmountExpression(
  rawExpression: string,
  scale: number = DISPLAY_SCALE
): string | null {
  const stripped = rawExpression
    .replace(/rp/gi, '')
    .replace(/[$€£¥₹,\s]/g, '')
    .trim();

  if (!stripped) return null;

  if (!/^[0-9.+\-*/()]+$/.test(stripped)) {
    return null;
  }

  let pos = 0;

  function peek(): string | undefined {
    return stripped[pos];
  }

  function consume(): string | undefined {
    return stripped[pos++];
  }

  function parseExpression(): Decimal {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      left = op === '+' ? left.plus(right) : left.minus(right);
    }
    return left;
  }

  function parseTerm(): Decimal {
    let left = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseFactor();
      if (op === '/') {
        if (right.isZero()) {
          throw new Error('Division by zero');
        }
        left = left.dividedBy(right);
      } else {
        left = left.times(right);
      }
    }
    return left;
  }

  function parseFactor(): Decimal {
    if (peek() === '+') {
      consume();
      return parseFactor();
    }
    if (peek() === '-') {
      consume();
      return parseFactor().negated();
    }
    if (peek() === '(') {
      consume();
      const val = parseExpression();
      if (consume() !== ')') {
        throw new Error('Unmatched parenthesis');
      }
      return val;
    }

    const start = pos;
    let hasDot = false;
    while (pos < stripped.length) {
      const ch = stripped[pos]!;
      if (ch >= '0' && ch <= '9') {
        pos++;
      } else if (ch === '.' && !hasDot) {
        hasDot = true;
        pos++;
      } else {
        break;
      }
    }

    const numStr = stripped.slice(start, pos);
    if (!numStr || numStr === '.') {
      throw new Error('Expected number');
    }
    return new Decimal(numStr);
  }

  try {
    const result = parseExpression();
    if (pos !== stripped.length || !result.isFinite()) {
      return null;
    }
    return result.toFixed(scale, Decimal.ROUND_HALF_EVEN);
  } catch {
    return null;
  }
}
