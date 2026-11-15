import React from 'react';
import { TaxonomiesSections } from './transactions/TaxonomiesSections.js';
import { RulesSection } from './transactions/RulesSection.js';
import { RecurringSection } from './transactions/RecurringSection.js';
import {
  AutoMatchesSection,
  StatementVaultSection,
} from './transactions/AutoMatchesAndVaultSections.js';

export type TransactionsSectionId =
  | 'categories'
  | 'tags'
  | 'rules'
  | 'merchants'
  | 'recurring'
  | 'auto_matches'
  | 'statement_vault';

export const TransactionsSettingsSections: React.FC<{
  activeSection: TransactionsSectionId;
  enableAutoMatch: boolean;
  onToggleAutoMatch: (enabled: boolean) => void;
  actionTriggerCounter?: { section: TransactionsSectionId; tick: number } | null;
}> = ({
  activeSection,
  enableAutoMatch,
  onToggleAutoMatch,
  actionTriggerCounter,
}) => {
  return (
    <div className="space-y-5">
      {(activeSection === 'categories' ||
        activeSection === 'tags' ||
        activeSection === 'merchants') && (
        <TaxonomiesSections
          activeSection={activeSection}
          actionTriggerCounter={actionTriggerCounter}
        />
      )}

      {activeSection === 'rules' && (
        <RulesSection actionTriggerCounter={actionTriggerCounter} />
      )}

      {activeSection === 'recurring' && <RecurringSection />}

      {activeSection === 'auto_matches' && (
        <AutoMatchesSection
          enableAutoMatch={enableAutoMatch}
          onToggleAutoMatch={onToggleAutoMatch}
        />
      )}

      {activeSection === 'statement_vault' && <StatementVaultSection />}
    </div>
  );
};
