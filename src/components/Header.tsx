'use client';

import React from 'react';
import { CheckCircle2, ShieldCheck, WifiOff } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle: string;
  role: 'owner' | 'crew' | 'viewer';
  isOffline: boolean;
  activeTab: string;
  tabs: { id: string; label: string; pct: number }[];
  onSelectTab: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  role,
  isOffline,
  activeTab,
  tabs,
  onSelectTab,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-surface-light dark:bg-surface-dark border-b border-line-light dark:border-line-dark shadow-sm">
      <div className="max-w-3xl mx-auto px-4 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-fg-light dark:text-fg-dark">
              {title}
            </h1>
            <p className="text-xs text-muted-light dark:text-muted-dark">
              {subtitle}
            </p>
          </div>

          <div>
            {isOffline ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                <WifiOff className="w-3.5 h-3.5" />
                Offline
              </span>
            ) : role === 'viewer' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                View only
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Live Tracker
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Tabs */}
        <div className="flex space-x-2 mt-3 overflow-x-auto no-scrollbar pb-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-accent-light text-white dark:bg-accent-dark dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-muted-light dark:text-muted-dark hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                      : 'bg-slate-200 dark:bg-slate-700 text-fg-light dark:text-fg-dark'
                  }`}
                >
                  {tab.pct}%
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
