'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '@/components/Header';
import { SummaryTiles } from '@/components/SummaryTiles';
import { TaskTree } from '@/components/TaskTree';
import { SaveBar } from '@/components/SaveBar';
import { SyncModal } from '@/components/SyncModal';
import { TaskNode, UserRole } from '@/lib/types';
import { calculateTreeStats, buildTaskTree } from '@/lib/calc';
import { supabase } from '@/lib/supabase';

export default function TrackerApp() {
  const [role, setRole] = useState<UserRole>('owner');
  const [allTasks, setAllTasks] = useState<TaskNode[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [pendingTicks, setPendingTicks] = useState<
    Record<string, { doneByName: string; tickedAt: string }>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Fetch live tasks & progress from Supabase
  const loadSupabaseData = useCallback(async () => {
    try {
      const { data: dbTasks, error: taskErr } = await supabase
        .from('tracker_tasks')
        .select('*')
        .order('sort_order', { ascending: true })
        .limit(3000);

      if (taskErr || !dbTasks || dbTasks.length === 0) {
        return;
      }

      const { data: dbProgress } = await supabase
        .from('tracker_task_progress')
        .select('*');

      const progressMap = new Map();
      if (dbProgress) {
        for (const p of dbProgress) {
          progressMap.set(p.task_id, p);
        }
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

      const nestedTree = buildTaskTree(flatNodes);
      if (nestedTree.length > 0) {
        setAllTasks(nestedTree);
      }
    } catch (e) {
      console.warn('Could not load Supabase data:', e);
    }
  }, []);

  useEffect(() => {
    loadSupabaseData();

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
          loadSupabaseData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tracker_tasks' },
        () => {
          loadSupabaseData();
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
  }, [loadSupabaseData]);

  // Extract Major Subproject Sections (Outline Level 2 or Root Children)
  const sections = useMemo(() => {
    if (allTasks.length === 0) return [];
    
    // If root task is a single project wrapper with children, use its children as the main sections
    if (allTasks.length === 1 && allTasks[0].children && allTasks[0].children.length > 0) {
      return allTasks[0].children;
    }
    
    // Otherwise check if any root has multiple sub-children
    const found: TaskNode[] = [];
    for (const r of allTasks) {
      if (r.children && r.children.length > 0 && r.children.some(c => c.isSummary)) {
        found.push(...r.children);
      } else {
        found.push(r);
      }
    }
    return found;
  }, [allTasks]);

  // Dynamic Navigation Tabs
  const totalStats = useMemo(() => calculateTreeStats(sections), [sections]);

  const tabs = useMemo(() => {
    return [
      { id: 'all', label: 'Overview', pct: Math.round(totalStats.hoursPct) },
      ...sections.map((s) => {
        const stats = calculateTreeStats([s]);
        const shortName = s.name
          .replace(/\(Quote.*?\)/i, '')
          .replace(/\(Motor.*?\)/i, '')
          .trim();
        return {
          id: s.id,
          label: shortName.length > 20 ? shortName.substring(0, 18) + '...' : shortName,
          pct: Math.round(stats.hoursPct),
        };
      }),
    ];
  }, [sections, totalStats]);

  // Filter tasks based on active tab
  const displayedNodes = useMemo(() => {
    if (activeTab === 'all') return sections;
    const match = sections.find((s) => s.id === activeTab);
    return match ? (match.children && match.children.length > 0 ? match.children : [match]) : sections;
  }, [activeTab, sections]);

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
      loadSupabaseData();
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
      await loadSupabaseData();
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
      <Header
        title="AVI Line 4 Site Progress"
        subtitle="MS Project Master & Linked Subprojects"
        role={role}
        isOffline={isOffline}
        activeTab={activeTab}
        tabs={tabs}
        onSelectTab={setActiveTab}
        onOpenSync={() => setIsSyncModalOpen(true)}
      />

      <main className="max-w-3xl mx-auto px-4 mt-2">
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
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-semibold text-fg-light dark:text-fg-dark">
              {activeTab === 'all' ? 'All Sections & Items' : 'Section Items & Stages'}
            </h2>
            <div className="text-xs text-muted-light dark:text-muted-dark">
              Role: <span className="font-semibold uppercase text-accent-light dark:text-accent-dark">{role}</span>
            </div>
          </div>

          <TaskTree
            nodes={displayedNodes}
            role={role}
            pendingTicks={pendingTicks}
            onToggleTick={handleToggleTick}
            onChangeDoneBy={handleChangeDoneBy}
            onUnlock={handleUnlock}
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
          loadSupabaseData();
          setIsSyncModalOpen(false);
        }}
      />
    </div>
  );
}
