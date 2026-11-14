import React from 'react';
import { Card } from '@sure/ui';
import { ExternalLink, Sparkles } from 'lucide-react';

export type MoreSectionId = 'guides' | 'whats_new' | 'feedback';

interface ChangelogEntry {
  version: string;
  subtitle: string;
  author: string;
  date: string;
  summaryTitle: string;
  summaryBody: string;
  bullets: string[];
  changes: Array<{ label: string; scope: string }>;
}

const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: 'v2026.11.14-alpha',
    subtitle: 'compatibility: Sure TypeScript Platform',
    author: '@sure-core',
    date: 'November 14, 2026',
    summaryTitle: 'Settings, Reporting & Classifier Parity',
    summaryBody:
      'Updated General, Transactions, Advanced, and More settings modules along with interactive ledger navigation and reporting views.',
    bullets: [
      'General & Profile Settings: Account classification groups, institution sync adapters, currency/localization preferences, and household TOTP security.',
      'Transactions Configuration: Color-coded category hierarchies, tags, automated rules builder, merchant enrichment, recurring schedules, auto-matches, and statement vault.',
      'Advanced AI & Tooling: Configurable system prompts, local Naive Bayes classifier tuning parameters, API key scoping, MCP Streamable JSON-RPC endpoint guide, and import/export logs.',
    ],
    changes: [
      {
        label: 'Align General, Transactions, and Advanced settings navigation and section layouts',
        scope: 'apps/web',
      },
      {
        label: 'Add interactive cashflow Sankey & monthly/quarterly financial health report trends',
        scope: 'reports',
      },
      {
        label: 'Add local Naive Bayes transaction categorizer & destination-aware transfer rules',
        scope: 'packages/shared',
      },
      {
        label: 'Expose Streamable JSON-RPC 2.0 MCP endpoint (/mcp) with scoped family API bearer tokens',
        scope: 'apps/api',
      },
    ],
  },
];

const GithubMarkIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

const DiscordMarkIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true" className={className}>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

export const MoreSettingsSections: React.FC<{
  activeSection: MoreSectionId;
}> = ({ activeSection }) => {
  /* ---------------- GUIDES ---------------- */
  if (activeSection === 'guides') {
    return (
      <Card>
        <article className="space-y-6 text-sm leading-relaxed text-[var(--text-primary)]">
          <div className="space-y-3">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Welcome to Sure!
            </h2>
            <p className="text-[var(--text-secondary)]">
              This guide aims to assist new users through:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[var(--text-primary)] pl-1">
              <li>Creating a Sure account</li>
              <li>Adding your first accounts</li>
              <li>Recording transactions</li>
            </ol>
            <p className="text-[var(--text-secondary)]">
              This guide also covers the differences between{' '}
              <strong className="font-semibold text-[var(--text-primary)]">asset</strong> and{' '}
              <strong className="font-semibold text-[var(--text-primary)]">liability</strong>{' '}
              accounts, a key concept for using and understanding balances in Sure!
            </p>
          </div>

          <blockquote className="border-l-2 border-[var(--border-strong)] pl-4 py-1 space-y-2 italic text-[var(--text-secondary)]">
            <p className="font-medium text-[var(--text-primary)]">
              “Important: Sure is evolving quickly. If you find something inaccurate while
              following this guide, please:”
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>
                Ask in the{' '}
                <a
                  href="https://discord.gg/sure"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
                >
                  Discord
                </a>
              </li>
              <li>
                Open an{' '}
                <a
                  href="https://github.com/we-promise/sure/issues"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
                >
                  issue
                </a>
              </li>
              <li>
                Or if you know the answer, open a{' '}
                <a
                  href="https://github.com/we-promise/sure/pulls"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
                >
                  PR
                </a>
                !
              </li>
            </ul>
          </blockquote>

          <section className="space-y-3 pt-1">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              1. Creating your Sure Account
            </h3>
            <p className="text-[var(--text-secondary)]">
              Once Sure is running, sign in or create your family workspace. Your Family acts as the
              root household tenant: accounts, balances, categories, budgets, and rules are all
              isolated to your family, and extra household members can be invited under{' '}
              <strong className="font-medium text-[var(--text-primary)]">
                Settings → Profile Info
              </strong>
              .
            </p>
            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)] p-6 flex flex-col items-center justify-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#078C52] text-white font-bold text-sm flex items-center justify-center tracking-tight">
                su
                <br />
                re
              </div>
              <div className="inline-flex rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] p-0.5 text-xs">
                <span className="px-4 py-1.5 text-[var(--text-secondary)]">Sign in</span>
                <span className="px-4 py-1.5 rounded-md bg-[var(--bg-surface-subtle)] font-medium text-[var(--text-primary)] border border-[var(--border-primary)]">
                  Create account
                </span>
              </div>
            </div>
          </section>

          <section className="space-y-2.5 pt-1">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              2. Adding Accounts & Understanding Assets vs. Liabilities
            </h3>
            <p className="text-[var(--text-secondary)]">
              Every account belongs to one of two classifications:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-[var(--text-secondary)] pl-1">
              <li>
                <strong className="font-medium text-[var(--text-primary)]">Assets</strong>{' '}
                (Checking, Savings, Investments, Crypto, Property, Vehicles, Other Assets): positive
                inflows increase net worth.
              </li>
              <li>
                <strong className="font-medium text-[var(--text-primary)]">Liabilities</strong>{' '}
                (Credit Cards, Loans & Mortgages, Other Liabilities): charges increase what you owe,
                while payments reduce the debt balance.
              </li>
            </ul>
          </section>

          <section className="space-y-2.5 pt-1">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              3. Recording Transactions, Splits & Transfers
            </h3>
            <p className="text-[var(--text-secondary)]">
              Add entries directly inside an account, import CSV statements under{' '}
              <strong className="font-medium text-[var(--text-primary)]">Imports</strong>, or
              configure rules under{' '}
              <strong className="font-medium text-[var(--text-primary)]">Transactions → Rules</strong>{' '}
              to automate categories, merchants, tags, and split ratios. Transfers between accounts
              are tracked with paired legs so debt payoffs and investment contributions keep accurate
              reporting totals.
            </p>
          </section>
        </article>
      </Card>
    );
  }

  /* ---------------- WHAT'S NEW ---------------- */
  if (activeSection === 'whats_new') {
    return (
      <div className="space-y-4">
        {CHANGELOG_ENTRIES.map((release) => (
          <Card key={release.version}>
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Author & Date Meta Column */}
              <div className="sm:w-44 shrink-0 flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-primary)] shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {release.author}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">{release.date}</div>
                </div>
              </div>

              {/* Release Body */}
              <div className="flex-1 min-w-0 space-y-5 text-sm">
                <div className="space-y-1.5">
                  <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                    {release.version} — {release.subtitle}
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">{release.summaryBody}</p>
                </div>

                <div className="space-y-2.5">
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">
                    {release.summaryTitle}
                  </h3>
                  <ul className="list-disc list-inside space-y-1.5 text-[var(--text-secondary)]">
                    {release.bullets.map((bullet) => (
                      <li key={bullet} className="leading-relaxed">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>

                <blockquote className="border-l-2 border-[var(--border-strong)] pl-4 py-1 text-xs italic text-[var(--text-secondary)]">
                  “Note: All monetary calculations use fixed-point Decimal arithmetic with
                  daily materialized account snapshots.”
                </blockquote>

                <div className="space-y-2.5">
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">
                    What&apos;s Changed
                  </h3>
                  <ul className="list-disc list-inside space-y-1.5 text-[var(--text-secondary)]">
                    {release.changes.map((c) => (
                      <li key={c.label}>
                        <span>{c.label}</span>{' '}
                        <span className="font-mono-tabular text-xs text-blue-600 dark:text-blue-400">
                          [{c.scope}]
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  /* ---------------- FEEDBACK ---------------- */
  return (
    <Card>
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Leave feedback</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Let us know if you have any specific feedback. Feel free to include links to videos or
            screenshots.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a
            href="https://github.com/we-promise/sure/issues/new?template=feature_request.md"
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col items-center justify-center gap-3 px-4 py-6 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-strong)] transition-colors text-center"
          >
            <GithubMarkIcon className="w-7 h-7 text-[var(--text-primary)]" />
            <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-primary)]">
              Write a feature request
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
            </span>
          </a>

          <a
            href="https://github.com/we-promise/sure/issues/new?template=bug_report.md"
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col items-center justify-center gap-3 px-4 py-6 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-strong)] transition-colors text-center"
          >
            <GithubMarkIcon className="w-7 h-7 text-[var(--text-primary)]" />
            <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-primary)]">
              File a bug report
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
            </span>
          </a>

          <a
            href="https://discord.gg/sure"
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col items-center justify-center gap-3 px-4 py-6 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-strong)] transition-colors text-center"
          >
            <DiscordMarkIcon className="w-7 h-7" />
            <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-primary)]">
              Discuss Sure with others
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
            </span>
          </a>
        </div>
      </div>
    </Card>
  );
};
