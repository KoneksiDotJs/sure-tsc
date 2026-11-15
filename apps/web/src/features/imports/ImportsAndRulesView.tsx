import React from 'react';
import { useLedger } from '../../lib/ledger-context.js';
import { ImportWizardSection } from './components/ImportWizardSection.js';
import { RulesEngineSection } from './components/RulesEngineSection.js';

export const ImportsAndRulesView: React.FC = () => {
  const {
    family,
    accounts,
    categories,
    imports,
    rules,
    previewImportFile,
    commitStagedImport,
    revertImportBatch,
    createRule,
    toggleRuleActive,
    deleteRule,
    dryRunRule,
    applyAllRules,
  } = useLedger();

  return (
    <div className="space-y-8">
      <ImportWizardSection
        baseCurrency={family.baseCurrency}
        accounts={accounts}
        imports={imports}
        onPreviewImport={previewImportFile}
        onCommitImport={commitStagedImport}
        onRevertImport={revertImportBatch}
      />

      <RulesEngineSection
        baseCurrency={family.baseCurrency}
        categories={categories}
        rules={rules}
        onCreateRule={createRule}
        onToggleRuleActive={toggleRuleActive}
        onDeleteRule={deleteRule}
        onDryRunRule={dryRunRule}
        onApplyAllRules={applyAllRules}
      />
    </div>
  );
};
