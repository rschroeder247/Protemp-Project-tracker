'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { SummaryTiles } from '@/components/SummaryTiles';
import { TaskTree } from '@/components/TaskTree';
import { SaveBar } from '@/components/SaveBar';
import { TaskNode, UserRole } from '@/lib/types';
import { calculateTreeStats, buildTaskTree } from '@/lib/calc';
import { supabase } from '@/lib/supabase';

// Sample tree data loaded initially
const INITIAL_DEMO_TASKS: TaskNode[] = [
  {
    id: 'sub-1',
    projectId: 'master',
    projectName: 'Master Project',
    subprojectName: 'AVI 7080 Move panels',
    wbs: '1',
    outlineLevel: 1,
    name: 'AVI 7080 Move panels from clean area to new MCC',
    isSummary: true,
    quotedHours: 120,
    children: [
      {
        id: 'sub-1-1',
        projectId: 'master',
        projectName: 'Master Project',
        subprojectName: 'AVI 7080 Move panels',
        wbs: '1.1',
        outlineLevel: 2,
        name: 'DJB-ZONE111-01 (1000 x 800 x 330)',
        isSummary: true,
        quotedHours: 24,
        children: [
          {
            id: 'task-101',
            projectId: 'master',
            projectName: 'Master Project',
            subprojectName: 'AVI 7080 Move panels',
            wbs: '1.1.1',
            outlineLevel: 3,
            name: 'Materials on site',
            isSummary: false,
            quotedHours: 0,
            isLocked: true,
            doneByName: 'Lindani',
          },
          {
            id: 'task-102',
            projectId: 'master',
            projectName: 'Master Project',
            subprojectName: 'AVI 7080 Move panels',
            wbs: '1.1.2',
            outlineLevel: 3,
            name: 'Cable run / installed',
            isSummary: false,
            quotedHours: 4.8,
            isLocked: true,
            doneByName: 'Lindani',
          },
          {
            id: 'task-103',
            projectId: 'master',
            projectName: 'Master Project',
            subprojectName: 'AVI 7080 Move panels',
            wbs: '1.1.3',
            outlineLevel: 3,
            name: 'Cable glanded (both ends)',
            isSummary: false,
            quotedHours: 4.8,
            isLocked: false,
          },
          {
            id: 'task-104',
            projectId: 'master',
            projectName: 'Master Project',
            subprojectName: 'AVI 7080 Move panels',
            wbs: '1.1.4',
            outlineLevel: 3,
            name: 'JB built',
            isSummary: false,
            quotedHours: 4.8,
            isLocked: false,
          },
          {
            id: 'task-105',
            projectId: 'master',
            projectName: 'Master Project',
            subprojectName: 'AVI 7080 Move panels',
            wbs: '1.1.5',
            outlineLevel: 3,
            name: 'Cable labels fitted',
            isSummary: false,
            quotedHours: 2.4,
            isLocked: false,
          },
          {
            id: 'task-106',
            projectId: 'master',
            projectName: 'Master Project',
            subprojectName: 'AVI 7080 Move panels',
            wbs: '1.1.6',
            outlineLevel: 3,
            name: 'Terminated at JB',
            isSummary: false,
            quotedHours: 3.6,
            isLocked: false,
          },
          {
            id: 'task-107',
            projectId: 'master',
            projectName: 'Master Project',
            subprojectName: 'AVI 7080 Move panels',
            wbs: '1.1.7',
            outlineLevel: 3,
            name: 'Terminated at MCC',
            isSummary: false,
            quotedHours: 3.6,
            isLocked: false,
          },
        ],
      },
      {
        id: 'sub-1-2',
        projectId: 'master',
        projectName: 'Master Project',
        subprojectName: 'AVI 7080 Move panels',
        wbs: '1.2',
        outlineLevel: 2,
        name: 'E0105_1 Extruder Oil Pump (4 kW · 54m)',
        isSummary: true,
        quotedHours: 14.5,
        children: [
          {
            id: 'task-201',
            projectId: 'master',
            projectName: 'Master Project',
            subprojectName: 'AVI 7080 Move panels',
            wbs: '1.2.1',
            outlineLevel: 3,
            name: 'Cable run MCC to isolator',
            isSummary: false,
            quotedHours: 5.5,
            isLocked: false,
          },
          {
            id: 'task-202',
            projectId: 'master',
            projectName: 'Master Project',
            subprojectName: 'AVI 7080 Move panels',
            wbs: '1.2.2',
            outlineLevel: 3,
            name: 'Cable glanded (both ends)',
            isSummary: false,
            quotedHours: 3.0,
            isLocked: false,
          },
          {
            id: 'task-203',
            projectId: 'master',
            projectName: 'Master Project',
            subprojectName: 'AVI 7080 Move panels',
            wbs: '1.2.3',
            outlineLevel: 3,
            name: 'Terminated at MCC & Isolator',
            isSummary: false,
            quotedHours: 4.0,
            isLocked: false,
          },
          {
            id: 'task-204',
            projectId: 'master',
            projectName: 'Master Project',
            subprojectName: 'AVI 7080 Move panels',
            wbs: '1.2.4',
            outlineLevel: 3,
            name: 'Tested & Labelled',
            isSummary: false,
            quotedHours: 2.0,
            isLocked: false,
          },
        ],
      },
    ],
  },
  {
    id: 'sub-2',
    projectId: 'master',
    projectName: 'Master Project',
    subprojectName: 'Buckman 7033',
    wbs: '2',
    outlineLevel: 1,
    name: 'Buckman 7033 Bentonite Makedown system 525 vac',
    isSummary: true,
    quotedHours: 85,
    children: [
      {
        id: 'sub-2-1',
        projectId: 'master',
        projectName: 'Master Project',
        subprojectName: 'Buckman 7033',
        wbs: '2.1',
        outlineLevel: 2,
        name: 'Main Feed & Marshalling Panel',
        isSummary: true,
        quotedHours: 18,
        children: [
          {
            id: 'task-301',
            projectId: 'master',
            projectName: 'Master Project',
            subprojectName: 'Buckman 7033',
            wbs: '2.1.1',
            outlineLevel: 3,
            name: 'Containment and bracket mounting',
            isSummary: false,
            quotedHours: 6.0,
            isLocked: false,
          },
          {
            id: 'task-302',
            projectId: 'master',
            projectName: 'Master Project',
            subprojectName: 'Buckman 7033',
            wbs: '2.1.2',
            outlineLevel: 3,
            name: 'Panel installation and glanding',
            isSummary: false,
            quotedHours: 12.0,
            isLocked: false,
          },
        ],
      },
    ],
  },
];

export default function TrackerApp() {
  const [role, setRole] = useState<UserRole>('owner');
  const [tasks, setTasks] = useState<TaskNode[]>(INITIAL_DEMO_TASKS);
  const [activeTab, setActiveTab] = useState('all');
  const [pendingTicks, setPendingTicks] = useState<
    Record<string, { doneByName: string; tickedAt: string }>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // Restore pending ticks from localStorage on load
  useEffect(() => {
    try {
      const stored = localStorage.getItem('protemp_pending_ticks');
      if (stored) {
        setPendingTicks(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load pending ticks from localStorage', e);
    }

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync pending changes to localStorage
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

  const handleUnlock = (task: TaskNode) => {
    if (role !== 'owner') return;
    // Mark unlocked locally and let owner save
    const unlockTree = (nodes: TaskNode[]): TaskNode[] => {
      return nodes.map((n) => {
        if (n.id === task.id) {
          return { ...n, isLocked: false };
        }
        if (n.children) {
          return { ...n, children: unlockTree(n.children) };
        }
        return n;
      });
    };
    setTasks(unlockTree(tasks));
  };

  const handleDiscard = () => {
    updatePending({});
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Lock all pending tasks
    setTimeout(() => {
      const lockTree = (nodes: TaskNode[]): TaskNode[] => {
        return nodes.map((n) => {
          if (pendingTicks[n.id]) {
            return {
              ...n,
              isLocked: true,
              doneByName: pendingTicks[n.id].doneByName,
              tickedAt: pendingTicks[n.id].tickedAt,
            };
          }
          if (n.children) {
            return { ...n, children: lockTree(n.children) };
          }
          return n;
        });
      };
      setTasks(lockTree(tasks));
      updatePending({});
      setIsSaving(false);
    }, 600);
  };

  // Filter tasks based on active tab
  const displayedTasks =
    activeTab === 'all'
      ? tasks
      : tasks.filter((t) => t.id === activeTab || t.subprojectName === activeTab);

  const stats = calculateTreeStats(displayedTasks);
  const totalStats = calculateTreeStats(tasks);

  // Tabs generated from top-level tasks / subprojects
  const tabs = [
    { id: 'all', label: 'Overview', pct: Math.round(totalStats.hoursPct) },
    ...tasks.map((t) => {
      const subStats = calculateTreeStats([t]);
      return {
        id: t.id,
        label: t.subprojectName || t.name,
        pct: Math.round(subStats.hoursPct),
      };
    }),
  ];

  const pendingCount = Object.keys(pendingTicks).length;
  const hasMissingNames = Object.values(pendingTicks).some(
    (p) => !p.doneByName || p.doneByName.trim().length === 0
  );

  return (
    <div className="min-h-screen pb-12">
      <Header
        title="Protemp Project Tracker"
        subtitle="MS Project Master & Linked Subprojects"
        role={role}
        isOffline={isOffline}
        activeTab={activeTab}
        tabs={tabs}
        onSelectTab={setActiveTab}
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
              {activeTab === 'all' ? 'All Subprojects & Tasks' : 'Subproject Tasks'}
            </h2>
            <div className="text-xs text-muted-light dark:text-muted-dark">
              Role: <span className="font-semibold uppercase text-accent-light dark:text-accent-dark">{role}</span>
            </div>
          </div>

          <TaskTree
            nodes={displayedTasks}
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
    </div>
  );
}
