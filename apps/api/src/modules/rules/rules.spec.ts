import { describe, expect, it } from 'vitest';
import { RuleEvaluatableEntry, RulesService } from './rules.service.js';

const mockEntry: RuleEvaluatableEntry = {
  id: '00000000-0000-4000-8000-000000000099',
  accountId: '00000000-0000-4000-8000-000000000010',
  familyId: '00000000-0000-4000-8000-000000000001',
  amount: '-142.5000',
  name: 'WHOLEFDS MKT #10248 AUSTIN TX',
  notes: 'Weekly groceries',
  excluded: false,
};

describe('RulesService Condition Evaluator (FR-3.2)', () => {
  it('evaluates string operators: contains, starts_with, equals', () => {
    expect(
      RulesService.evaluateCondition(mockEntry, {
        field: 'name',
        operator: 'contains',
        value: 'wholefds',
      })
    ).toBe(true);

    expect(
      RulesService.evaluateCondition(mockEntry, {
        field: 'name',
        operator: 'starts_with',
        value: 'WHOLEFDS',
      })
    ).toBe(true);

    expect(
      RulesService.evaluateCondition(mockEntry, {
        field: 'notes',
        operator: 'equals',
        value: 'Weekly groceries',
      })
    ).toBe(true);
  });

  it('evaluates Decimal amount operators: lt, gt, between', () => {
    expect(
      RulesService.evaluateCondition(mockEntry, {
        field: 'amount',
        operator: 'lt',
        value: '-100.0000',
      })
    ).toBe(true);

    expect(
      RulesService.evaluateCondition(mockEntry, {
        field: 'amount',
        operator: 'between',
        value: '-200.0000',
        secondaryValue: '-100.0000',
      })
    ).toBe(true);
  });
});
