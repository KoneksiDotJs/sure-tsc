import React from 'react';
import { useLedger } from '../../lib/ledger-context.js';
import { MonthlyBudgetsSection } from './components/MonthlyBudgetsSection.js';
import { FinancialGoalsSection } from './components/FinancialGoalsSection.js';
import { RecurringBillsSection } from './components/RecurringBillsSection.js';

export const BudgetsAndGoalsView: React.FC = () => {
  const {
    family,
    accounts,
    categories,
    goals,
    recurring,
    budgetMonth,
    setBudgetMonth,
    budgetRows,
    budgetRolloverEnabled,
    setBudgetRolloverEnabled,
    budgetAllocations,
    updateBudgetAllocation,
    createGoal,
    deleteGoal,
    createRecurringBill,
    markRecurringPaid,
    deleteRecurringBill,
  } = useLedger();

  return (
    <div className="space-y-8">
      <MonthlyBudgetsSection
        baseCurrency={family.baseCurrency}
        categories={categories}
        budgetMonth={budgetMonth}
        onChangeBudgetMonth={setBudgetMonth}
        serverBudgetRows={budgetRows}
        budgetRolloverEnabled={budgetRolloverEnabled}
        onToggleRollover={setBudgetRolloverEnabled}
        budgetAllocations={budgetAllocations}
        onUpdateAllocation={updateBudgetAllocation}
      />

      <FinancialGoalsSection
        baseCurrency={family.baseCurrency}
        accounts={accounts}
        goals={goals}
        onCreateGoal={createGoal}
        onDeleteGoal={deleteGoal}
      />

      <RecurringBillsSection
        baseCurrency={family.baseCurrency}
        budgetMonth={budgetMonth}
        accounts={accounts}
        categories={categories}
        recurring={recurring}
        onCreateRecurringBill={createRecurringBill}
        onMarkRecurringPaid={markRecurringPaid}
        onDeleteRecurringBill={deleteRecurringBill}
      />
    </div>
  );
};
