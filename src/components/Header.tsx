'use client';

import React from 'react';
import { CheckCircle2, RefreshCw, WifiOff, Search, Layers, FolderTree } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  pct: number;
  count?: number;
}

interface HeaderProps {
  title: string;
  subtitle: string;
  role: 'owner' | 'crew' | 'viewer';
  isOffline: boolean;
  onOpenSync: () => void;
  onToggleSearch?: () => void;
  isSearchOpen?: boolean;

  // Tier 1: Subprojects
  subprojects: NavItem[];
  activeSubprojectId: string;
  onSelectSubproject: (id: string) => void;

  // Tier 2: First Headings under active subproject
  headings: NavItem[];
  activeHeadingId: string;
  onSelectHeading: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  role,
  isOffline,
  onOpenSync,
  onToggleSearch,
  isSearchOpen = false,
  subprojects,
  activeSubprojectId,
  onSelectSubproject,
  headings,
  activeHeadingId,
  onSelectHeading,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-surface-light dark:bg-surface-dark border-b border-line-light dark:border-line-dark shadow-sm">
      <div className="max-w-3xl mx-auto px-4 pt-3 pb-2.5 space-y-2">
        {/* Top Bar: Title & Action Controls */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-fg-light dark:text-fg-dark">
              {title}
            </h1>
            <p className="text-xs text-muted-light dark:text-muted-dark">
              {subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onToggleSearch && (
              <button
                type="button"
                onClick={onToggleSearch}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                  isSearchOpen
                    ? 'bg-accent-light text-white dark:bg-accent-dark dark:text-slate-900 border-accent-light dark:border-accent-dark'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-fg-light dark:text-fg-dark border-line-light dark:border-line-dark'
                }`}
                title="Search Tasks"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Search</span>
              </button>
            )}

            <button
              onClick={onOpenSync}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-accent-light/10 text-accent-light dark:bg-accent-dark/20 dark:text-accent-dark hover:bg-accent-light/20 transition-colors border border-accent-light/20 dark:border-accent-dark/30"
              title="Two-Way MS Project Sync"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sync MS Project</span>
              <span className="sm:hidden">Sync</span>
            </button>

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
                Live
              </span>
            )}
          </div>
        </div>

        {/* Tier 1: Subprojects (Projects) Buttons */}
        {subprojects.length > 0 && (
          <div className="pt-0.5">
            <div className="flex items-center gap-1 mb-1">
              <FolderTree className="w-3 h-3 text-accent-light dark:text-accent-dark" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-light dark:text-muted-dark">
                Tier 1 &middot; Subprojects
              </span>
            </div>
            <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-0.5">
              {subprojects.map((sp) => {
                const isActive = activeSubprojectId === sp.id;
                return (
                  <button
                    key={sp.id}
                    onClick={() => onSelectSubproject(sp.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-accent-light text-white dark:bg-accent-dark dark:text-slate-900 shadow-sm ring-1 ring-accent-light dark:ring-accent-dark'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-muted-light dark:text-muted-dark hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{sp.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                          : 'bg-slate-200 dark:bg-slate-700 text-fg-light dark:text-fg-dark'
                      }`}
                    >
                      {sp.pct}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tier 2: First Headings (Under Active Subproject) */}
        {headings.length > 0 && (
          <div className="pt-1.5 border-t border-line-light/50 dark:border-line-dark/50">
            <div className="flex items-center gap-1 mb-1">
              <Layers className="w-3 h-3 text-slate-500 dark:text-slate-400" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-light dark:text-muted-dark">
                Tier 2 &middot; Sections & Headings
              </span>
            </div>
            <div className="flex space-x-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {headings.map((h) => {
                const isActive = activeHeadingId === h.id;
                return (
                  <button
                    key={h.id}
                    onClick={() => onSelectHeading(h.id)}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                        : 'bg-slate-100/90 hover:bg-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-700 text-muted-light dark:text-muted-dark border border-line-light/60 dark:border-line-dark/60'
                    }`}
                  >
                    <span>{h.label}</span>
                    <span
                      className={`text-[10px] px-1 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                          : 'bg-slate-200 dark:bg-slate-700/80 text-fg-light dark:text-fg-dark'
                      }`}
                    >
                      {h.pct}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
