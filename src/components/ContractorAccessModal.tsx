'use client';

import React, { useState, useEffect } from 'react';
import { X, Shield, Check, Users, AlertCircle, Copy, CheckCircle2 } from 'lucide-react';
import { TaskNode } from '@/lib/types';

export interface TeamAllocationSaveData {
  allowedSubprojects: string[];
  teamAllowedSubprojects: Record<string, string[]>;
}

interface ContractorAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  subprojects: TaskNode[];
  initialAllowed: string[];
  onSaveAllowed: (data: TeamAllocationSaveData) => Promise<void>;
}

const TEAMS_LIST = [
  { id: 'team_1', name: 'Team 1', short: 'Team 1' },
  { id: 'team_2', name: 'Team 2', short: 'Team 2' },
  { id: 'team_3', name: 'Team 3', short: 'Team 3' },
  { id: 'team_4', name: 'Team 4', short: 'Team 4' },
  { id: 'team_5', name: 'Team 5', short: 'Team 5' },
  { id: 'team_6', name: 'Team 6', short: 'Team 6' },
  { id: 'team_7', name: 'Team 7', short: 'Team 7' },
  { id: 'team_8', name: 'Team 8', short: 'Team 8' },
  { id: 'team_9', name: 'Team 9', short: 'Team 9' },
  { id: 'team_10', name: 'Team 10', short: 'Team 10' },
  { id: 'guest', name: 'Guest & Others', short: 'Guest' },
];

export function ContractorAccessModal({
  isOpen,
  onClose,
  subprojects,
  initialAllowed,
  onSaveAllowed,
}: ContractorAccessModalProps) {
  const [activeTeamId, setActiveTeamId] = useState<string>('team_1');
  const [teamAllocations, setTeamAllocations] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load existing per-team allocations from DB whenever modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    const fetchCurrentAllocations = async () => {
      try {
        const res = await fetch('/api/auth/contractor-access');
        const data = await res.json();
        if (!isMounted) return;

        const serverTeams = data.teamAllowedSubprojects || {};
        const fallback = data.allowedSubprojects || initialAllowed;

        // Build complete map for all 10 teams + guest
        const fullMap: Record<string, string[]> = {};
        for (const t of TEAMS_LIST) {
          if (Array.isArray(serverTeams[t.id])) {
            fullMap[t.id] = serverTeams[t.id];
          } else if (fallback.length > 0) {
            fullMap[t.id] = [...fallback];
          } else {
            // Default to all subprojects if nothing has been restricted yet
            fullMap[t.id] = subprojects.map((sp) => sp.id);
          }
        }
        setTeamAllocations(fullMap);
      } catch (err: any) {
        console.warn('Failed to load team allocations:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchCurrentAllocations();

    return () => {
      isMounted = false;
    };
  }, [isOpen, initialAllowed, subprojects]);

  if (!isOpen) return null;

  const currentTeamAllocated = teamAllocations[activeTeamId] || [];
  const currentSelectedSet = new Set(currentTeamAllocated);

  const handleToggleSubproject = (id: string) => {
    setTeamAllocations((prev) => {
      const current = prev[activeTeamId] || [];
      const set = new Set(current);
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
      return {
        ...prev,
        [activeTeamId]: Array.from(set),
      };
    });
  };

  const handleSelectAllForActiveTeam = () => {
    setTeamAllocations((prev) => ({
      ...prev,
      [activeTeamId]: subprojects.map((sp) => sp.id),
    }));
  };

  const handleClearAllForActiveTeam = () => {
    setTeamAllocations((prev) => ({
      ...prev,
      [activeTeamId]: [],
    }));
  };

  const handleCopyToAllTeams = () => {
    const activeSelection = teamAllocations[activeTeamId] || [];
    setTeamAllocations((prev) => {
      const updated: Record<string, string[]> = {};
      for (const t of TEAMS_LIST) {
        updated[t.id] = [...activeSelection];
      }
      return updated;
    });

    const activeTeamObj = TEAMS_LIST.find((t) => t.id === activeTeamId);
    setCopyNotice(`Copied ${activeTeamObj?.name || 'team'} setup to all 10 teams!`);
    setTimeout(() => setCopyNotice(null), 3000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      // Determine global fallback from guest or team_1
      const globalFallback = teamAllocations['guest'] || teamAllocations['team_1'] || [];

      await onSaveAllowed({
        teamAllowedSubprojects: teamAllocations,
        allowedSubprojects: globalFallback,
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save team project allocations');
    } finally {
      setIsSaving(false);
    }
  };

  const activeTeamObj = TEAMS_LIST.find((t) => t.id === activeTeamId) || TEAMS_LIST[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-line-light dark:border-line-dark flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-fg-light dark:text-fg-dark">
                Team Project Allocation
              </h2>
              <p className="text-xs text-muted-light dark:text-muted-dark">
                Assign separate projects to separate teams. Admin can always view all projects.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-light hover:text-fg-light dark:hover:text-fg-dark hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Team Selector Tabs (Horizontal Scroll) */}
        <div className="px-4 py-2.5 border-b border-line-light dark:border-line-dark bg-slate-100/60 dark:bg-slate-900/50">
          <div className="text-[11px] font-semibold text-muted-light dark:text-muted-dark uppercase tracking-wider mb-2">
            Select Team to Allocate Projects:
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {TEAMS_LIST.map((team) => {
              const isSelected = team.id === activeTeamId;
              const count = (teamAllocations[team.id] || []).length;
              const isAll = count === subprojects.length && subprojects.length > 0;
              const isNone = count === 0;

              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setActiveTeamId(team.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-600/30'
                      : 'bg-surface-light dark:bg-surface-dark border-line-light dark:border-line-dark text-fg-light dark:text-fg-dark hover:border-purple-400/50'
                  }`}
                >
                  <span>{team.short}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : isAll
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : isNone
                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                        : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                    }`}
                  >
                    {isAll ? 'All' : isNone ? '0' : count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted-light dark:text-muted-dark animate-pulse">
              Loading team project permissions...
            </div>
          ) : (
            <>
              {/* Active Team Subheader & Quick Actions */}
              <div className="flex items-center justify-between flex-wrap gap-2 p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-900/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-fg-light dark:text-fg-dark">
                    Allocated to {activeTeamObj.name}:
                  </span>
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                    {currentSelectedSet.size} of {subprojects.length} projects
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAllForActiveTeam}
                    className="text-purple-700 dark:text-purple-300 hover:underline font-semibold"
                  >
                    Select All
                  </button>
                  <span className="text-slate-400">&middot;</span>
                  <button
                    type="button"
                    onClick={handleClearAllForActiveTeam}
                    className="text-muted-light hover:text-fg-light dark:hover:text-fg-dark hover:underline font-medium"
                  >
                    Clear All
                  </button>
                  <span className="text-slate-400">&middot;</span>
                  <button
                    type="button"
                    onClick={handleCopyToAllTeams}
                    className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:underline font-medium"
                    title="Copy this team's project selection to all other 9 teams"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy to All Teams</span>
                  </button>
                </div>
              </div>

              {copyNotice && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900 text-xs">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-blue-600" />
                  <span>{copyNotice}</span>
                </div>
              )}

              {/* Subproject Checkbox Cards */}
              <div className="space-y-2 mt-2">
                {subprojects.map((sp) => {
                  const isChecked = currentSelectedSet.has(sp.id);
                  return (
                    <label
                      key={sp.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                        isChecked
                          ? 'bg-purple-50/60 dark:bg-purple-950/20 border-purple-400/50 dark:border-purple-700/60 shadow-xs'
                          : 'bg-slate-50/50 dark:bg-slate-900/30 border-line-light dark:border-line-dark hover:bg-slate-100/50 dark:hover:bg-slate-800/40 opacity-75'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleSubproject(sp.id)}
                        className="mt-0.5 w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 dark:border-slate-700"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold text-fg-light dark:text-fg-dark">
                            {sp.name}
                          </p>
                          {isChecked && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                              Visible to {activeTeamObj.name}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-light dark:text-muted-dark font-mono mt-0.5">
                          WBS: {sp.wbs} &middot; {sp.children ? sp.children.length : 1} sections
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {saveSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
                  <Check className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>Team project allocations saved successfully!</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-line-light dark:border-line-dark flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/40">
          <div className="text-[11px] text-muted-light dark:text-muted-dark hidden sm:block">
            Tip: Switch teams above to configure each team before clicking Save.
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-muted-light dark:text-muted-dark hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving || isLoading}
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Shield className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save All Team Allocations'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
