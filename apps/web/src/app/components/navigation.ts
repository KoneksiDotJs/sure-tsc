import {
  ArrowLeftRight,
  BarChart3,
  FileSpreadsheet,
  Home,
  PieChart,
  Wallet,
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', railKey: 'nav.home' as const, railLabel: 'Home', label: 'Dashboard', icon: Home },
  { id: 'accounts', railKey: 'nav.accounts' as const, railLabel: 'Accounts', label: 'Accounts & Loans', icon: Wallet },
  { id: 'transactions', railKey: 'nav.transactions' as const, railLabel: 'Ledger', label: 'Ledger & Splits', icon: ArrowLeftRight },
  { id: 'imports', railKey: 'nav.imports' as const, railLabel: 'Imports', label: 'Imports & Rules', icon: FileSpreadsheet },
  { id: 'budgets', railKey: 'nav.budgets' as const, railLabel: 'Budgets', label: 'Budgets & Goals', icon: PieChart },
  { id: 'reports', railKey: 'nav.reports' as const, railLabel: 'Reports', label: 'Reports & Sync', icon: BarChart3 },
] as const;

export type NavTabId = (typeof NAV_ITEMS)[number]['id'] | 'settings';
export type SidebarFilter = 'ALL' | 'ASSET' | 'LIABILITY';

export const ACCOUNT_GROUP_LABELS: Record<string, string> = {
  DEPOSITORY: 'Cash & Checking',
  INVESTMENT: 'Investments',
  CRYPTO: 'Crypto',
  PROPERTY: 'Property',
  VEHICLE: 'Vehicles',
  OTHER_ASSET: 'Other Assets',
  CREDIT_CARD: 'Credit Cards',
  LOAN: 'Loans & Mortgages',
  OTHER_LIABILITY: 'Other Liabilities',
};

export const ACCOUNT_GROUP_META: Record<string, { icon: string; color: string }> = {
  DEPOSITORY: { icon: 'Wallet', color: '#078C52' },
  INVESTMENT: { icon: 'TrendingUp', color: '#3b82f6' },
  CRYPTO: { icon: 'Coins', color: '#f59e0b' },
  PROPERTY: { icon: 'Home', color: '#8b5cf6' },
  VEHICLE: { icon: 'Car', color: '#14b8a6' },
  OTHER_ASSET: { icon: 'Package', color: '#6b7280' },
  CREDIT_CARD: { icon: 'CreditCard', color: '#f97316' },
  LOAN: { icon: 'Landmark', color: '#ef4444' },
  OTHER_LIABILITY: { icon: 'Shapes', color: '#64748b' },
};
