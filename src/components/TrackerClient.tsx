'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Header, NavItem } from '@/components/Header';
import { SummaryTiles } from '@/components/SummaryTiles';
import { TaskTree } from '@/components/TaskTree';
import { SaveBar } from '@/components/SaveBar';
import { SyncModal } from '@/components/SyncModal';
import { TaskNode, UserRole } from '@/lib/types';
import {
  calculateTreeStats,
  buildTaskTree,
  getAllSummaryIds,
  filterTreeByQuery,
} from '@/lib/calc';
import { supabase } from '@/lib/supabase';
import { Search, X, ChevronsDownUp, ChevronsUpDown, Layers } from 'lucide-react';

interface TrackerClientProps {
  initialDbTasks: any[];
  initialDbProgress: any[];
}

export function TrackerClient({
  initialDbTasks,
  initialDbProgress,
}: TrackerClientProps) {
  const [role, setRole] = useState<UserRole>('owner');
  const [dbTasks, setDbTasks] = useState<any[]>(initialDbTasks);
  const [dbProgress, setDbProgress] = useState<any[]>(initialDbProgress);

  // 3-Tier Navigation State
  // Tier 1: Subproject ID ('all' or specific subproject root id)
  const [selectedSubprojectId, setSelectedSubprojectId] = useState<string>('all');
  // Tier 2: First Heading ID ('all' or specific level-2 heading id)
  const [selectedHeadingId, setSelectedHeadingId] = useState<string>('all');

  const [pendingTicks, setPendingTicks] = useState<
    Record<string, { doneByName: string; tickedAt: string }>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Search & Expand/Minimize state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [hasInitializedExpanded, setHasInitializedExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reload data from Supabase
  const refreshData = useCallback(async () => {
    try {
      const { data: tData } = await supabase
        .from('tracker_tasks')
        .select('*')
        .order('sort_order', { ascending: true })
        .limit(3000);

      const { data: pData } = await supabase
        .from('tracker_task_progress')
        .select('*');

      if (tData) setDbTasks(tData);
      if (pData) setDbProgress(pData || []);
    } catch (e) {
      console.warn('Refresh error:', e);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('protemp_pending_ticks');
      if (stored) {
        setPendingTicks(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load pending ticks from localStorage', e);
    }

    const channel = supabase
      .channel('realtime_tracker_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tracker_task_progress' },
        () => {
          refreshData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tracker_tasks' },
        () => {
          refreshData();
        }
      )
      .subscribe();

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshData]);

  // Construct Nested WBS Tree from dbTasks & dbProgress
  const allTasks = useMemo(() => {
    if (!dbTasks || dbTasks.length === 0) return [];

    const progressMap = new Map();
    for (const p of dbProgress) {
      progressMap.set(p.task_id, p);
    }

    const flatNodes: TaskNode[] = dbTasks.map((t) => {
      const prog = progressMap.get(t.id);
      return {
        id: t.id,
        projectId: t.project_id,
        projectName: 'Master Project',
        subprojectName: t.project_id,
        wbs: t.wbs,
        outlineLevel: t.outline_level,
        name: t.name,
        isSummary: t.is_summary,
        quotedHours: Number(t.quoted_hours) || 0,
        durationDays: Number(t.duration_days) || 0,
        notes: t.notes,
        isLocked: !!prog,
        doneByName: prog ? prog.done_by_name : '',
        tickedAt: prog ? prog.ticked_at : undefined,
        savedAt: prog ? prog.saved_at : undefined,
      };
    });

    return buildTaskTree(flatNodes);
  }, [dbTasks, dbProgress]);

  // Default to the first subproject if available and currently on 'all'
  useEffect(() => {
    if (allTasks.length === 1 && selectedSubprojectId === 'all') {
      setSelectedSubprojectId(allTasks[0].id);
    }
  }, [allTasks, selectedSubprojectId]);

  // TIER 1: Subproject Buttons
  const tier1Subprojects: NavItem[] = useMemo(() => {
    if (allTasks.length === 0) return [];
    const totalStats = calculateTreeStats(allTasks);

    const items: NavItem[] = [
      {
        id: 'all',
        label: 'Overview (All)',
        pct: Math.round(totalStats.hoursPct),
        count: allTasks.length,
      },
      ...allTasks.map((sp) => {
        const stats = calculateTreeStats([sp]);
        const shortName = sp.name
          .replace(/\(Quote.*?\)/i, '')
          .replace(/\(Motor.*?\)/i, '')
          .trim();
        return {
          id: sp.id,
          label: shortName.length > 25 ? shortName.substring(0, 23) + '...' : shortName,
          pct: Math.round(stats.hoursPct),
          count: sp.children ? sp.children.length : 1,
        };
      }),
    ];

    return items;
  }, [allTasks]);

  const activeSubprojectNode = useMemo(() => {
    if (selectedSubprojectId === 'all') return null;
    return allTasks.find((sp) => sp.id === selectedSubprojectId) || null;
  }, [allTasks, selectedSubprojectId]);

  // TIER 2: First Headings under Active Subproject
  const tier2Headings: NavItem[] = useMemo(() => {
    const headingsSource: TaskNode[] = activeSubprojectNode
      ? activeSubprojectNode.children || []
      : allTasks.flatMap((sp) => (sp.children && sp.children.length > 0 ? sp.children : [sp]));

    if (headingsSource.length === 0) return [];

    const currentScopeStats = calculateTreeStats(
      activeSubprojectNode ? [activeSubprojectNode] : allTasks
    );

    const items: NavItem[] = [
      {
        id: 'all',
        label: 'All Headings',
        pct: Math.round(currentScopeStats.hoursPct),
        count: headingsSource.length,
      },
      ...headingsSource.map((h) => {
        const stats = calculateTreeStats([h]);
        const cleanName = h.name
          .replace(/\(Quote.*?\)/i, '')
          .replace(/\(Motor.*?\)/i, '')
          .trim();
        return {
          id: h.id,
          label: cleanName.length > 28 ? cleanName.substring(0, 26) + '...' : cleanName,
          pct: Math.round(stats.hoursPct),
          count: h.children ? h.children.length : 0,
        };
      }),
    ];

    return items;
  }, [allTasks, activeSubprojectNode]);

  // TIER 3: The Last Headings / Actionable Items
  const displayedNodes: TaskNode[] = useMemo(() => {
    const headingsSource: TaskNode[] = activeSubprojectNode
      ? activeSubprojectNode.children || []
      : allTasks.flatMap((sp) => (sp.children && sp.children.length > 0 ? sp.children : [sp]));

    if (selectedHeadingId === 'all') {
      return headingsSource.length > 0
        ? headingsSource
        : (activeSubprojectNode ? [activeSubprojectNode] : allTasks);
    }

    const matchedHeading = headingsSource.find((h) => h.id === selectedHeadingId);
    if (!matchedHeading) return headingsSource;

    // Show the last headings / items under this heading
    if (matchedHeading.children && matchedHeading.children.length > 0) {
      return matchedHeading.children;
    }

    // Direct leaf task (milestones, single tasks)
    return [matchedHeading];
  }, [allTasks, activeSubprojectNode, selectedHeadingId]);

  // Calculate summary IDs for current displayed nodes
  const currentSummaryIds = useMemo(() => {
    return getAllSummaryIds(displayedNodes);
  }, [displayedNodes]);

  // Initial expansion
  useEffect(() => {
    if (!hasInitializedExpanded && displayedNodes.length > 0) {
      setExpandedIds(getAllSummaryIds(displayedNodes));
      setHasInitializedExpanded(true);
    }
  }, [displayedNodes, hasInitializedExpanded]);

  // Search filtering
  const { filteredNodes, matchCount, autoExpandIds } = useMemo(() => {
    return filterTreeByQuery(displayedNodes, searchQuery);
  }, [displayedNodes, searchQuery]);

  // Global search count across all tasks
  const globalMatchCount = useMemo(() => {
    if ((selectedSubprojectId === 'all' && selectedHeadingId === 'all') || !searchQuery.trim()) {
      return 0;
    }
    return filterTreeByQuery(allTasks, searchQuery).matchCount;
  }, [allTasks, searchQuery, selectedSubprojectId, selectedHeadingId]);

  // Combined expanded IDs
  const activeExpandedIds = useMemo(() => {
    if (!searchQuery.trim()) return expandedIds;
    return new Set([...expandedIds, ...autoExpandIds]);
  }, [expandedIds, autoExpandIds, searchQuery]);

  const isAllMinimized = useMemo(() => {
    if (currentSummaryIds.size === 0) return false;
    for (const id of currentSummaryIds) {
      if (expandedIds.has(id)) return false;
    }
    return true;
  }, [currentSummaryIds, expandedIds]);

  const handleToggleMinimizeAll = () => {
    if (isAllMinimized) {
      setExpandedIds(new Set(currentSummaryIds));
    } else {
      setExpandedIds(new Set());
    }
  };

  const handleToggleExpandNode = (nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleToggleSearch = () => {
    setIsSearchOpen((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      return next;
    });
  };

  const stats = useMemo(() => calculateTreeStats(displayedNodes), [displayedNodes]);

  const updatePending = (
    newPending: Record<string, { doneByName: string; tickedAt: string }>
  ) => {
    setPendingTicks(newPending);
    try {
      localStorage.setItem('protemp_pending_ticks', JSON.stringify(newPending));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  };

  const handleToggleTick = (task: TaskNode, isChecked: boolean) => {
    const updated = { ...pendingTicks };
    if (isChecked) {
      const rememberedName = localStorage.getItem('protemp_remembered_name') || 'Lindani';
      updated[task.id] = {
        doneByName: rememberedName,
        tickedAt: new Date().toISOString(),
      };
    } else {
      delete updated[task.id];
    }
    updatePending(updated);
  };

  const handleChangeDoneBy = (taskId: string, name: string) => {
    if (!pendingTicks[taskId]) return;
    const updated = {
      ...pendingTicks,
      [taskId]: {
        ...pendingTicks[taskId],
        doneByName: name,
      },
    };
    updatePending(updated);
    if (name.trim().length > 0) {
      localStorage.setItem('protemp_remembered_name', name.trim());
    }
  };

  const handleUnlock = async (task: TaskNode) => {
    if (role !== 'owner') return;
    try {
      await supabase.rpc('save_tree_progress', {
        changes: [{ kind: 'unlock', task_id: task.id }],
      });
      refreshData();
    } catch (e) {
      console.error('Unlock error:', e);
    }
  };

  const handleDiscard = () => {
    updatePending({});
  };

  const handleSave = async () => {
    setIsSaving(true);

    const changes = Object.entries(pendingTicks).map(([taskId, val]) => ({
      kind: 'tick',
      task_id: taskId,
      project_id: 'master',
      done_by_name: val.doneByName,
      ticked_at: val.tickedAt,
    }));

    try {
      await supabase.rpc('save_tree_progress', { changes });
      updatePending({});
      await refreshData();
    } catch (err) {
      console.warn('RPC save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const pendingCount = Object.keys(pendingTicks).length;
  const hasMissingNames = Object.values(pendingTicks).some(
    (p) => !p.doneByName || p.doneByName.trim().length === 0
  );

  return (
    <div className="min-h-screen pb-12">
      {/* 3-Tier Navigation Header */}
      <Header
        title="AVI Line 4 Site Progress"
        subtitle="MS Project Master & Linked Subprojects"
        role={role}
        isOffline={isOffline}
        onOpenSync={() => setIsSyncModalOpen(true)}
        onToggleSearch={handleToggleSearch}
        isSearchOpen={isSearchOpen}
        subprojects={tier1Subprojects}
        activeSubprojectId={selectedSubprojectId}
        onSelectSubproject={(spId) => {
          setSelectedSubprojectId(spId);
          setSelectedHeadingId('all');
        }}
        headings={tier2Headings}
        activeHeadingId={selectedHeadingId}
        onSelectHeading={(hId) => {
          setSelectedHeadingId(hId);
          // Expand newly selected tier 3 items
          setExpandedIds((prev) => new Set([...prev, ...getAllSummaryIds(displayedNodes)]));
        }}
      />

      <main className="max-w-3xl mx-auto px-4 mt-2">
        {/* Dynamic Summary Tiles for the currently active Tier view */}
        <SummaryTiles
          completedItems={stats.completedLeafTasks}
          totalItems={stats.totalLeafTasks}
          completedStages={stats.completedLeafTasks}
          totalStages={stats.totalLeafTasks}
          workPct={stats.hoursPct}
          earnedHours={stats.earnedHours}
          quotedHours={stats.totalQuotedHours}
        />

        <div className="mt-4">
          {/* Action Toolbar: Search & Minimize All Controls */}
          <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-xl p-3 mb-3 shadow-xs space-y-2">
            <div className="flex items-center gap-2">
              {/* Search Input Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-muted-light dark:text-muted-dark absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks, WBS, equipment, or technician name..."
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-line-light dark:border-line-dark bg-slate-50 dark:bg-slate-900/50 text-fg-light dark:text-fg-dark placeholder:text-muted-light dark:placeholder:text-muted-dark focus:outline-hidden focus:ring-1 focus:ring-accent-light dark:focus:ring-accent-dark transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-light hover:text-fg-light dark:hover:text-fg-dark p-0.5 rounded transition-colors"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Minimize All / Expand All Button */}
              <button
                type="button"
                onClick={handleToggleMinimizeAll}
                className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-fg-light dark:text-fg-dark border border-line-light dark:border-line-dark transition-colors flex items-center gap-1.5 shadow-xs"
                title={isAllMinimized ? 'Expand all sections and tasks' : 'Minimize all sections and tasks'}
              >
                {isAllMinimized ? (
                  <>
                    <ChevronsUpDown className="w-3.5 h-3.5 text-accent-light dark:text-accent-dark" />
                    <span className="hidden sm:inline">Expand All</span>
                    <span className="sm:hidden">Expand</span>
                  </>
                ) : (
                  <>
                    <ChevronsDownUp className="w-3.5 h-3.5 text-accent-light dark:text-accent-dark" />
                    <span className="hidden sm:inline">Minimize All</span>
                    <span className="sm:hidden">Minimize</span>
                  </>
                )}
              </button>
            </div>

            {/* Search Match Info & Cross-Tier Discovery */}
            {searchQuery.trim() && (
              <div className="flex items-center justify-between text-xs px-1 text-muted-light dark:text-muted-dark pt-1">
                <span>
                  Found <strong className="text-fg-light dark:text-fg-dark">{matchCount}</strong> {matchCount === 1 ? 'task' : 'tasks'} matching &ldquo;{searchQuery}&rdquo;
                  {globalMatchCount > matchCount && (
                    <>
                      {' '}&middot;{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSubprojectId('all');
                          setSelectedHeadingId('all');
                        }}
                        className="text-accent-light dark:text-accent-dark font-medium underline ml-1 hover:opacity-80"
                      >
                        Found {globalMatchCount} matches across all subprojects &rarr;
                      </button>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-accent-light dark:text-accent-dark hover:underline font-medium text-[11px]"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>

          {/* Tier 3 Breadcrumb Header */}
          <div className="flex items-center justify-between mb-2.5 px-1 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-light dark:text-muted-dark">
              <span className="font-semibold text-fg-light dark:text-fg-dark">
                {activeSubprojectNode ? activeSubprojectNode.name : 'All Subprojects'}
              </span>
              {selectedHeadingId !== 'all' && (
                <>
                  <span className="text-slate-400 dark:text-slate-600">&rsaquo;</span>
                  <span className="font-semibold text-accent-light dark:text-accent-dark">
                    {tier2Headings.find((h) => h.id === selectedHeadingId)?.label}
                  </span>
                  <span className="text-[11px] text-muted-light dark:text-muted-dark">
                    ({displayedNodes.length} {displayedNodes.length === 1 ? 'item' : 'items'})
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {selectedHeadingId !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedHeadingId('all')}
                  className="text-xs text-accent-light dark:text-accent-dark hover:underline font-medium"
                >
                  &larr; View all headings
                </button>
              )}
              <div className="text-xs text-muted-light dark:text-muted-dark">
                Role: <span className="font-semibold uppercase text-accent-light dark:text-accent-dark">{role}</span>
              </div>
            </div>
          </div>

          {/* Tier 3: Task Tree (Last Headings & Actionable Stages) */}
          <TaskTree
            nodes={filteredNodes}
            role={role}
            pendingTicks={pendingTicks}
            onToggleTick={handleToggleTick}
            onChangeDoneBy={handleChangeDoneBy}
            onUnlock={handleUnlock}
            expandedIds={activeExpandedIds}
            onToggleExpand={handleToggleExpandNode}
            searchQuery={searchQuery}
          />
        </div>
      </main>

      <SaveBar
        pendingCount={pendingCount}
        hasMissingNames={hasMissingNames}
        isSaving={isSaving}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />

      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncComplete={() => {
          refreshData();
          setIsSyncModalOpen(false);
        }}
      />
    </div>
  );
}
