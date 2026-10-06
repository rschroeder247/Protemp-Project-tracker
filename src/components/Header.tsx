'use client';

import React from 'react';
import {
  CheckCircle2,
  RefreshCw,
  WifiOff,
  Search,
  Layers,
  FolderTree,
  Shield,
  HardHat,
  Briefcase,
  Lock,
  Key,
  Upload,
  Box,
} from 'lucide-react';
import { UserRole } from '@/lib/types';

export interface NavItem {
  id: string;
  label: string;
  pct: number;
  count?: number;
}

interface HeaderProps {
  title: string;
  subtitle: string;
  role: UserRole;
  userName?: string;
  isOffline: boolean;
  onOpenSync: () => void;
  onQuickSync?: () => void;
  isAutoSyncing?: boolean;
  lastSyncedLabel?: string | null;
  onToggleSearch?: () => void;
  isSearchOpen?: boolean;
  onOpenContractorAccess?: () => void;
  onElevateAdmin?: () => void;
  onLogout?: () => void;

  // Tier 1: Subprojects
  subprojects: NavItem[];
  activeSubprojectId: string;
  onSelectSubproject: (id: string) => void;

  // Tier 2: First Headings under active subproject
  headings: NavItem[];
  activeHeadingId: string;
  onSelectHeading: (id: string) => void;

  // Tier 3: Panels / Units / Instruments (Up to 3 tiers)
  tier3Items?: NavItem[];
  activeTier3Id?: string;
  onSelectTier3?: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  role,
  userName,
  isOffline,
  onOpenSync,
  onQuickSync,
  isAutoSyncing = false,
  lastSyncedLabel,
  onToggleSearch,
  isSearchOpen = false,
  onOpenContractorAccess,
  onElevateAdmin,
  onLogout,
  subprojects,
  activeSubprojectId,
  onSelectSubproject,
  headings,
  activeHeadingId,
  onSelectHeading,
  tier3Items,
  activeTier3Id,
  onSelectTier3,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-surface-light dark:bg-surface-dark border-b border-line-light dark:border-line-dark shadow-sm">
      <div className="max-w-3xl mx-auto px-4 pt-3 pb-2.5 space-y-2">
        {/* Top Bar: Title & Action Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-fg-light dark:text-fg-dark">
              {title}
            </h1>
            <p className="text-xs text-muted-light dark:text-muted-dark">
              {subtitle}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Role & Name Badge */}
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-xs ${
                role === 'owner'
                  ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                  : role === 'staff'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}
            >
              {role === 'owner' ? (
                <>
                  <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Admin: {userName || 'Roland'}</span>
                </>
              ) : role === 'staff' ? (
                <>
                  <Briefcase className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Staff: {userName || 'Lindani'}</span>
                </>
              ) : (
                <>
                  <HardHat className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Contractor: {userName || 'Contractor'}</span>
                </>
              )}
            </div>

            {/* Admin: Contractor Access Management Button */}
            {role === 'owner' && onOpenContractorAccess && (
              <button
                type="button"
                onClick={onOpenContractorAccess}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-400/30 transition-colors"
                title="Manage which subprojects contractors can access"
              >
                <HardHat className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Contractor Access</span>
              </button>
            )}

            {/* Staff / Contractor: Switch to Admin Mode Button */}
            {role !== 'owner' && onElevateAdmin && (
              <button
                type="button"
                onClick={onElevateAdmin}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-700 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-400/30 transition-colors"
                title="Unlock Admin Mode (requires password)"
              >
                <Key className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin Mode</span>
              </button>
            )}

            {/* Search Button */}
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

            {/* Sync MS Project Button (Admin and Staff only) */}
            {role !== 'contractor' && (
              <div className="inline-flex items-center gap-1.5">
                <div className="inline-flex items-center rounded-full border border-accent-light/30 dark:border-accent-dark/40 bg-accent-light/10 dark:bg-accent-dark/20 p-0.5">
                  <button
                    type="button"
                    onClick={onQuickSync || onOpenSync}
                    disabled={isAutoSyncing}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      isAutoSyncing
                        ? 'text-accent-light dark:text-accent-dark cursor-wait'
                        : 'text-accent-light dark:text-accent-dark hover:bg-accent-light/20 dark:hover:bg-accent-dark/30'
                    }`}
                    title={isAutoSyncing ? 'Syncing latest MS Project from OneDrive...' : '1-Click Sync latest MS Project from OneDrive'}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isAutoSyncing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{isAutoSyncing ? 'Syncing...' : 'Sync MS Project'}</span>
                    <span className="sm:hidden">{isAutoSyncing ? 'Syncing...' : 'Sync'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenSync}
                    className="px-1.5 py-0.5 text-accent-light/70 dark:text-accent-dark/70 hover:text-accent-light dark:hover:text-accent-dark transition-colors"
                    title="Upload XML file or view sync details"
                  >
                    <Upload className="w-3 h-3" />
                  </button>
                </div>
                {lastSyncedLabel && !isAutoSyncing && (
                  <span className="hidden lg:inline text-[10px] text-muted-light dark:text-muted-dark whitespace-nowrap bg-surface-elevated-light dark:bg-surface-elevated-dark px-2 py-0.5 rounded-full border border-line-light dark:border-line-dark">
                    Saved: {lastSyncedLabel}
                  </span>
                )}
              </div>
            )}

            {/* Lock / Sign Out Button */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-1 rounded-full text-muted-light hover:text-fg-light dark:hover:text-fg-dark hover:bg-slate-100 dark:hover:bg-slate-800 border border-line-light dark:border-line-dark transition-colors"
                title="Lock Tracker / Sign Out"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
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

        {/* Tier 3: Sub-sections / Panels / Units (Under Active Tier 2 Section) */}
        {tier3Items && tier3Items.length > 0 && onSelectTier3 && (
          <div className="pt-1.5 border-t border-line-light/50 dark:border-line-dark/50">
            <div className="flex items-center gap-1 mb-1">
              <Box className="w-3 h-3 text-blue-500 dark:text-blue-400" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-light dark:text-muted-dark">
                Tier 3 &middot; Panels & Units
              </span>
            </div>
            <div className="flex space-x-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {tier3Items.map((item) => {
                const isActive = activeTier3Id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTier3(item.id)}
                    className={`flex-shrink-0 px-2 py-0.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white shadow-xs'
                        : 'bg-blue-50/70 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-900 dark:text-blue-200 border border-blue-200/60 dark:border-blue-800/60'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span
                      className={`text-[10px] px-1 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white dark:bg-white/20'
                          : 'bg-blue-100 dark:bg-blue-900/70 text-blue-700 dark:text-blue-200'
                      }`}
                    >
                      {item.pct}%
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
