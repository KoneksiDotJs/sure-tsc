import React from 'react';
import {
  ArrowLeftRight,
  Baby,
  Briefcase,
  Building2,
  Car,
  CircleDollarSign,
  Coffee,
  Coins,
  CreditCard,
  Dog,
  DollarSign,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  Music,
  Package,
  Percent,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  Shapes,
  Shield,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Stethoscope,
  Store,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  ArrowLeftRight,
  Baby,
  Briefcase,
  Building2,
  Car,
  CircleDollarSign,
  Coffee,
  Coins,
  CreditCard,
  Dog,
  DollarSign,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  Music,
  Package,
  Percent,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  Shapes,
  Shield,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Stethoscope,
  Store,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
};

export const CATEGORY_ICON_CHOICES = [
  'Home',
  'Utensils',
  'ShoppingBag',
  'Car',
  'Plane',
  'Zap',
  'Gamepad2',
  'HeartPulse',
  'Briefcase',
  'TrendingUp',
  'Repeat',
  'GraduationCap',
  'Gift',
  'Shield',
  'Coffee',
  'PiggyBank',
  'Laptop',
  'Tag',
] as const;

/**
 * Resolves a Lucide icon name from an explicit `icon` field or infers a fitting icon
 * from the category / group label so categories always show meaningful iconography.
 */
export function inferCategoryIconName(icon?: string | null, label?: string | null): string {
  const cleanIcon = icon?.trim();
  if (cleanIcon && cleanIcon !== 'Tag' && cleanIcon in ICON_MAP) {
    return cleanIcon;
  }

  const hay = (label ?? '').toLowerCase();
  if (/(hous|rent|mortgag|home|apartment)/.test(hay)) return 'Home';
  if (/(groc|food|dining|restaur|eat|meal|cafe|coffee)/.test(hay)) {
    return hay.includes('coffee') ? 'Coffee' : 'Utensils';
  }
  if (/(shop|cloth|gear|apparel|retail|store)/.test(hay)) return 'ShoppingBag';
  if (/(travel|flight|hotel|air|trip|vacat)/.test(hay)) return 'Plane';
  if (/(entertain|movie|film|game|stream|music)/.test(hay)) return 'Gamepad2';
  if (/(utilit|electr|power|water|internet|wifi|phone|cloud|software|tech)/.test(hay)) {
    if (hay.includes('internet') || hay.includes('wifi')) return 'Wifi';
    if (hay.includes('software') || hay.includes('cloud')) return 'Laptop';
    return 'Zap';
  }
  if (/(salary|pay|wage|income|freelance|bonus|comp)/.test(hay)) return 'Briefcase';
  if (/(divid|invest|yield|stock|etf|broker|return)/.test(hay)) return 'TrendingUp';
  if (/(crypto|coin|eth|btc|token)/.test(hay)) return 'Coins';
  if (/(cash|check|saving|bank|depository|wallet)/.test(hay)) return 'Wallet';
  if (/(credit|card)/.test(hay)) return 'CreditCard';
  if (/(loan|debt|tax|irs)/.test(hay)) return 'Landmark';
  if (/(car|auto|vehicle|uber|lyft|transit|gas|fuel|parking)/.test(hay)) {
    return hay.includes('fuel') || hay.includes('gas') ? 'Fuel' : 'Car';
  }
  if (/(health|med|doctor|dental|pharma|fitness|gym)/.test(hay)) {
    return hay.includes('gym') || hay.includes('fitness') ? 'Dumbbell' : 'HeartPulse';
  }
  if (/(sub|recur|bill|membership)/.test(hay)) return 'Repeat';
  if (/(edu|school|tuition|course|book)/.test(hay)) return 'GraduationCap';
  if (/(gift|donat|charit)/.test(hay)) return 'Gift';
  if (/(insur|secur|protect)/.test(hay)) return 'Shield';
  if (/(pet|dog|vet)/.test(hay)) return 'Dog';
  if (/(child|kid|baby)/.test(hay)) return 'Baby';
  if (/(transfer)/.test(hay)) return 'ArrowLeftRight';
  if (/(misc|other|general)/.test(hay)) return 'Shapes';

  return cleanIcon && cleanIcon in ICON_MAP ? cleanIcon : 'Shapes';
}

export function getCategoryIconComponent(
  icon?: string | null,
  label?: string | null
): LucideIcon {
  const resolved = inferCategoryIconName(icon, label);
  return ICON_MAP[resolved] ?? Shapes;
}

export interface CategoryIconProps {
  icon?: string | null;
  label?: string | null;
  color?: string;
  variant?: 'inline' | 'circle';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

/**
 * <CategoryIcon /> — Renders category/account iconography in two visual styles matching Sure:
 * - `inline`: bare icon sized for Pills, buttons, and compact metadata labels.
 * - `circle`: 10% color-tinted rounded container (`backgroundColor: ${color}1A`) for category tables and selects.
 */
export const CategoryIcon: React.FC<CategoryIconProps> = ({
  icon,
  label,
  color = '#3b82f6',
  variant = 'inline',
  size = 'sm',
  className = '',
}) => {
  const Icon = getCategoryIconComponent(icon, label);

  if (variant === 'inline') {
    const dim =
      size === 'xs' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
    return (
      <Icon
        className={`shrink-0 ${dim} ${className}`}
        style={color ? { color } : undefined}
        aria-hidden="true"
      />
    );
  }

  const isHex = color.startsWith('#') && (color.length === 7 || color.length === 4);
  const bg = isHex ? `${color}1A` : 'var(--bg-surface-subtle)';
  const boxDim =
    size === 'xs' ? 'w-6 h-6' : size === 'md' ? 'w-8 h-8' : 'w-7 h-7';
  const iconDim =
    size === 'xs' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 ${boxDim} ${className}`}
      style={{ backgroundColor: bg, color }}
      aria-hidden="true"
    >
      <Icon className={iconDim} />
    </span>
  );
};
