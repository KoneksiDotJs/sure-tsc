import React from 'react';
import { TranslationKey } from '@sure/shared';
import {
  Activity,
  Archive,
  BookOpen,
  Bot,
  Box,
  Download,
  GitBranch,
  Key,
  Landmark,
  Layers,
  Link2,
  Megaphone,
  Palette,
  Plug,
  Repeat,
  Settings as SettingsIcon,
  Shapes,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Tag,
  Upload,
  UserCircle,
} from 'lucide-react';
import type { TransactionsSectionId } from './TransactionsSettingsSections.js';
import type { AdvancedSectionId } from './AdvancedSettingsSections.js';
import type { MoreSectionId } from './MoreSettingsSections.js';

export type SettingsSectionId =
  | 'accounts'
  | 'sync'
  | 'preferences'
  | 'appearance'
  | 'profile'
  | 'security'
  | TransactionsSectionId
  | AdvancedSectionId
  | MoreSectionId;

export interface SettingsNavItem {
  id: SettingsSectionId;
  labelKey: TranslationKey;
  pageTitleKey?: TranslationKey;
  label: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface SettingsNavGroup {
  headingKey: TranslationKey;
  heading: string;
  items: SettingsNavItem[];
}

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    headingKey: 'settings.group.general',
    heading: 'General',
    items: [
      {
        id: 'accounts',
        labelKey: 'settings.item.accounts',
        label: 'Accounts',
        icon: Layers,
      },
      {
        id: 'sync',
        labelKey: 'settings.item.sync',
        label: 'Bank sync',
        subtitle:
          'Connect external accounts so transactions, balances and holdings flow into Sure automatically.',
        icon: Landmark,
      },
      {
        id: 'preferences',
        labelKey: 'settings.item.preferences',
        label: 'Preferences',
        icon: SettingsIcon,
      },
      {
        id: 'appearance',
        labelKey: 'settings.item.appearance',
        label: 'Appearance',
        icon: Palette,
      },
      {
        id: 'profile',
        labelKey: 'settings.item.profile',
        label: 'Profile Info',
        icon: UserCircle,
      },
      {
        id: 'security',
        labelKey: 'settings.item.security',
        label: 'Security',
        icon: ShieldCheck,
      },
    ],
  },
  {
    headingKey: 'settings.group.transactions',
    heading: 'Transactions',
    items: [
      {
        id: 'categories',
        labelKey: 'settings.item.categories',
        label: 'Categories',
        icon: Shapes,
      },
      {
        id: 'tags',
        labelKey: 'settings.item.tags',
        label: 'Tags',
        icon: Tag,
      },
      {
        id: 'rules',
        labelKey: 'settings.item.rules',
        label: 'Rules',
        icon: GitBranch,
      },
      {
        id: 'merchants',
        labelKey: 'settings.item.merchants',
        label: 'Merchants',
        icon: Store,
      },
      {
        id: 'recurring',
        labelKey: 'settings.item.recurring',
        label: 'Recurring',
        icon: Repeat,
      },
      {
        id: 'auto_matches',
        labelKey: 'settings.item.auto_matches',
        label: 'Auto Matches',
        icon: Link2,
      },
      {
        id: 'statement_vault',
        labelKey: 'settings.item.statement_vault',
        label: 'Statement Vault',
        icon: Archive,
      },
    ],
  },
  {
    headingKey: 'settings.group.advanced',
    heading: 'Advanced',
    items: [
      {
        id: 'ai_prompts',
        labelKey: 'settings.item.ai_prompts',
        label: 'AI Prompts',
        icon: Bot,
      },
      {
        id: 'classifier',
        labelKey: 'settings.item.classifier',
        label: 'Classifier',
        icon: SlidersHorizontal,
      },
      {
        id: 'llm_usage',
        labelKey: 'settings.item.llm_usage',
        pageTitleKey: 'llmUsage.pageTitle',
        label: 'LLM Usage',
        icon: Activity,
      },
      {
        id: 'api_keys',
        labelKey: 'settings.item.api_keys',
        label: 'API Keys',
        icon: Key,
      },
      {
        id: 'mcp',
        labelKey: 'settings.item.mcp',
        label: 'MCP',
        icon: Plug,
      },
      {
        id: 'imports',
        labelKey: 'settings.item.imports',
        label: 'Imports',
        icon: Download,
      },
      {
        id: 'exports',
        labelKey: 'settings.item.exports',
        label: 'Exports',
        icon: Upload,
      },
    ],
  },
  {
    headingKey: 'settings.group.more',
    heading: 'More',
    items: [
      {
        id: 'guides',
        labelKey: 'settings.item.guides',
        label: 'Guides',
        icon: BookOpen,
      },
      {
        id: 'whats_new',
        labelKey: 'settings.item.whats_new',
        label: "What's new",
        icon: Box,
      },
      {
        id: 'feedback',
        labelKey: 'settings.item.feedback',
        label: 'Feedback',
        icon: Megaphone,
      },
    ],
  },
];

export const FLAT_SECTIONS = SETTINGS_NAV_GROUPS.flatMap((g) => g.items);

export interface LocalWorkspacePrefs {
  language: string;
  timezone: string;
  dateFormat: string;
  country: string;
  budgetStartDay: string;
  additionalCurrencies: string[];
  defaultSharing: string;
  enablePreviewFeatures: boolean;
  defaultAccountOrder: string;
  twoColumnDashboard: boolean;
  startExpanded: boolean;
  keepModalsOpen: boolean;
  groupSplitTransactions: boolean;
  autoGenerateNames: boolean;
  enableAutoMatch: boolean;
}

export const DEFAULT_PREFS: LocalWorkspacePrefs = {
  language: 'en',
  timezone: '(-06:00) Central Time',
  dateFormat: 'YYYY-MM-DD',
  country: 'US',
  budgetStartDay: '1st',
  additionalCurrencies: ['EUR', 'GBP'],
  defaultSharing: 'Share with all members',
  enablePreviewFeatures: true,
  defaultAccountOrder: 'Name (A-Z)',
  twoColumnDashboard: true,
  startExpanded: true,
  keepModalsOpen: false,
  groupSplitTransactions: true,
  autoGenerateNames: false,
  enableAutoMatch: true,
};
