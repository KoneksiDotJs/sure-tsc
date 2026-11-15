import React from 'react';
import { AiPromptsSection } from './advanced/AiPromptsSection.js';
import { ClassifierSection } from './advanced/ClassifierSection.js';
import { LlmUsageSection } from './advanced/LlmUsageSection.js';
import { ApiKeysAndMcpSections } from './advanced/ApiKeysAndMcpSections.js';
import {
  ExportsSection,
  ImportsSection,
} from './advanced/ImportsAndExportsSections.js';

export type AdvancedSectionId =
  | 'ai_prompts'
  | 'classifier'
  | 'llm_usage'
  | 'api_keys'
  | 'mcp'
  | 'imports'
  | 'exports';

export const AdvancedSettingsSections: React.FC<{
  activeSection: AdvancedSectionId;
  actionTriggerCounter?: { section: AdvancedSectionId; tick: number } | null;
  onNavigateToImports?: () => void;
}> = ({ activeSection, actionTriggerCounter, onNavigateToImports }) => {
  return (
    <div className="space-y-5">
      {activeSection === 'ai_prompts' && <AiPromptsSection />}

      {activeSection === 'classifier' && (
        <ClassifierSection actionTriggerCounter={actionTriggerCounter} />
      )}

      {activeSection === 'llm_usage' && <LlmUsageSection />}

      {(activeSection === 'api_keys' || activeSection === 'mcp') && (
        <ApiKeysAndMcpSections
          activeSection={activeSection}
          actionTriggerCounter={actionTriggerCounter}
        />
      )}

      {activeSection === 'imports' && (
        <ImportsSection onNavigateToImports={onNavigateToImports} />
      )}

      {activeSection === 'exports' && <ExportsSection />}
    </div>
  );
};
