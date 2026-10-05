'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Header, NavItem } from '@/components/Header';
import { SummaryTiles } from '@/components/SummaryTiles';
import { TaskTree } from '@/components/TaskTree';
import { SaveBar } from '@/components/SaveBar';
import { SyncModal } from '@/components/SyncModal';
import { LockScreen } from '@/components/LockScreen';
import { ContractorAccessModal } from '@/components/ContractorAccessModal';
import { TaskNode, UserRole } from '@/lib/types';
import {
  calculateTreeStats,
  buildTaskTree,
  getAllSummaryIds,
  filterTreeByQuery,
  filterTreeByCompletion,
} from '@/lib/calc';
import { supabase } from '@/lib/supabase';
import {
  Search,
  X,
  ChevronsDownUp,
  ChevronsUpDown,
  Layers,
  RefreshCw,
  CheckCircle2,
  Eye,
  EyeOff,
  Shield,
  Key,
  Lock,
  AlertCircle,
} from 'lucide-react';

interface TrackerClientProps {
  initialDbTasks: any[];
  initialDbProgress: any[];
}

export function TrackerClient({
  initialDbTasks,
  initialDbProgress,
}: TrackerClientProps) {
  // Authentication & Role State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [role, setRole] = useState<UserRole>('owner');
  const [userName, setUserName] = useState<string>('Roland (Admin)');
  const [allowedSubprojects, setAllowedSubprojects] = useState<string[]>([]);

  // Modals for Security
  const [isContractorModalOpen, setIsContractorModalOpen] = useState(false);
  const [isElevateModalOpen, setIsElevateModalOpen] = useState(false);
  const [elevatePassword, setElevatePassword] = useState('');
  const [elevateError, setElevateError] = useState<string | null>(null);
  const [isElevating, setIsElevating] = useState(false);

  const [dbTasks, setDbTasks] = useState<any[]>(initialDbTasks);
  const [dbProgress, setDbProgress] = useState<any[]>(initialDbProgress);
  const [lastSyncedLabel, setLastSyncedLabel] = useState<string | null>(null);

  // Check persistent session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.authenticated) {
          setIsAuthenticated(true);
          setRole(data.role);
          setUserName(data.name || (data.role === 'owner' ? 'Roland (Admin)' : 'Lindani'));
          setAllowedSubprojects(data.allowedSubprojects || []);
        } else {
          // Check local session fallback
          const localAuth = localStorage.getItem('protemp_auth_session');
          if (localAuth) {
            try {
              const parsed = JSON.parse(localAuth);
              if (parsed.role) {
                setIsAuthenticated(true);
                setRole(parsed.role);
                setUserName(parsed.name || 'Technician');
                setAllowedSubprojects(parsed.allowedSubprojects || []);
              }
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Session check warning:', err);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkSession();
  }, []);

  const handleAuthenticated = (auth: {
    role: UserRole;
    name: string;
    allowedSubprojects: string[];
  }) => {
    setIsAuthenticated(true);
    setRole(auth.role);
    setUserName(auth.name);
    setAllowedSubprojects(auth.allowedSubprojects);
    try {
      localStorage.setItem('protemp_auth_session', JSON.stringify(auth));
      localStorage.setItem('protemp_remembered_name', auth.name);
    } catch {}
    refreshData();
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('protemp_auth_session');
    } catch {}
    setIsAuthenticated(false);
  };

  const handleElevateToAdmin = async () => {
    if (!elevatePassword.trim()) {
      setElevateError('Please enter the Admin password');
      return;
    }
    setIsElevating(true);
    setElevateError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: elevatePassword.trim(), technicianName: 'Roland (Admin)' }),
      });
      const data = await res.json();
      if (!res.ok || data.role !== 'owner') {
        setElevateError(data.error || 'Incorrect Admin password');
        setIsElevating(false);
        return;
      }
      setRole('owner');
      setUserName('Roland (Admin)');
      setIsElevateModalOpen(false);
      setElevatePassword('');
      try {
        localStorage.setItem(
          'protemp_auth_session',
          JSON.stringify({ role: 'owner', name: 'Roland (Admin)', allowedSubprojects: [] })
        );
      } catch {}
    } catch (err: any) {
      setElevateError(err.message || 'Verification failed');
    } finally {
      setIsElevating(false);
    }
  };

  const handleSaveContractorAllowed = async (newAllowed: string[]) => {
    const res = await fetch('/api/auth/contractor-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowedSubprojects: newAllowed }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save contractor access');
    }
    setAllowedSubprojects(newAllowed);
  };

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

  // Auto-sync with MS Project state
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [autoSyncMessage, setAutoSyncMessage] = useState<string | null>(null);

  // Show / Hide Completed tasks state
  const [hideCompleted, setHideCompleted] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('protemp_hide_completed');
        return stored === 'true';
      } catch {
        return false;
      }
    }
    return false;
  });

  useEffect(() => {
    try {
      localStorage.setItem('protemp_hide_completed', String(hideCompleted));
    } catch {}
  }, [hideCompleted]);

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

  // Two-way sync with MS Project from OneDrive
  const triggerCloudSync = useCallback(
    async (isManual = false) => {
      setIsAutoSyncing(true);
      if (isManual) {
        setAutoSyncMessage('Connecting to OneDrive & updating from MS Project...');
      }
      try {
        const res = await fetch('/api/onedrive-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: 'Master Project.xml' }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const msg = errData.error || res.statusText || 'Sync failed';
          console.warn('Sync notice:', msg);
          if (isManual) {
            setAutoSyncMessage(`Sync notice: ${msg}`);
            setTimeout(() => setAutoSyncMessage(null), 6000);
          }
          return;
        }

        const data = await res.json();
        if (data.success) {
          let timeLabel = '';
          if (data.lastModifiedDateTime) {
            const fileDate = new Date(data.lastModifiedDateTime);
            const timeStr = fileDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            timeLabel = `(File saved: ${timeStr})`;
            setLastSyncedLabel(timeStr);
          } else {
            const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            timeLabel = `(at ${nowStr})`;
            setLastSyncedLabel(nowStr);
          }
          setAutoSyncMessage(`Updated ${data.taskCount} tasks from MS Project ${timeLabel}`);
          await refreshData();
          setTimeout(() => {
            setAutoSyncMessage(null);
          }, 7000);
        }
      } catch (err: any) {
        console.warn('Sync notice:', err.message);
        if (isManual) {
          setAutoSyncMessage(`Sync error: ${err.message}`);
          setTimeout(() => setAutoSyncMessage(null), 6000);
        }
      } finally {
        setIsAutoSyncing(false);
      }
    },
    [refreshData]
  );

  // Auto-sync with MS Project from OneDrive on page open
  useEffect(() => {
    triggerCloudSync(false);
  }, [triggerCloudSync]);

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

  // Filter subprojects if contractor has restricted access
  const visibleTasks = useMemo(() => {
    if (role !== 'contractor' || allowedSubprojects.length === 0) {
      return allTasks;
    }
    const allowedSet = new Set(allowedSubprojects);

    return allTasks
      .map((root) => {
        if (allowedSet.has(root.id) || allowedSet.has(root.projectId)) {
          return root;
        }
        if (root.children && root.children.length > 0) {
          const filteredChildren = root.children.filter(
            (c) => allowedSet.has(c.id) || allowedSet.has(c.projectId)
          );
          if (filteredChildren.length > 0) {
            return { ...root, children: filteredChildren };
          }
        }
        return null;
      })
      .filter(Boolean) as TaskNode[];
  }, [allTasks, role, allowedSubprojects]);

  // List of subprojects Admin can assign to Contractors
  const assignableSubprojects = useMemo(() => {
    if (allTasks.length === 0) return [];
    if (allTasks.length === 1 && allTasks[0].children && allTasks[0].children.length > 0) {
      return [allTasks[0], ...allTasks[0].children];
    }
    return allTasks;
  }, [allTasks]);

  // Default to the first subproject if available and currently on 'all'
  useEffect(() => {
    if (visibleTasks.length === 1 && selectedSubprojectId === 'all') {
      setSelectedSubprojectId(visibleTasks[0].id);
    }
  }, [visibleTasks, selectedSubprojectId]);

  // TIER 1: Subproject Buttons
  const tier1Subprojects: NavItem[] = useMemo(() => {
    if (visibleTasks.length === 0) return [];
    const totalStats = calculateTreeStats(visibleTasks, pendingTicks);

    const items: NavItem[] = [
      {
        id: 'all',
        label: 'Overview (All)',
        pct: Math.round(totalStats.taskPct),
        count: visibleTasks.length,
      },
      ...visibleTasks.map((sp) => {
        const stats = calculateTreeStats([sp], pendingTicks);
        const shortName = sp.name
          .replace(/\(Quote.*?\)/i, '')
          .replace(/\(Motor.*?\)/i, '')
          .trim();
        return {
          id: sp.id,
          label: shortName.length > 25 ? shortName.substring(0, 23) + '...' : shortName,
          pct: Math.round(stats.taskPct),
          count: sp.children ? sp.children.length : 1,
        };
      }),
    ];

    return items;
  }, [visibleTasks, pendingTicks]);

  const activeSubprojectNode = useMemo(() => {
    if (selectedSubprojectId === 'all') return null;
    return visibleTasks.find((sp) => sp.id === selectedSubprojectId) || null;
  }, [visibleTasks, selectedSubprojectId]);

  // TIER 2: First Headings under Active Subproject
  const tier2Headings: NavItem[] = useMemo(() => {
    const headingsSource: TaskNode[] = activeSubprojectNode
      ? activeSubprojectNode.children || []
      : visibleTasks.flatMap((sp) => (sp.children && sp.children.length > 0 ? sp.children : [sp]));

    if (headingsSource.length === 0) return [];

    const currentScopeStats = calculateTreeStats(
      activeSubprojectNode ? [activeSubprojectNode] : visibleTasks,
      pendingTicks
    );

    const items: NavItem[] = [
      {
        id: 'all',
        label: 'All Headings',
        pct: Math.round(currentScopeStats.taskPct),
        count: headingsSource.length,
      },
      ...headingsSource.map((h) => {
        const stats = calculateTreeStats([h], pendingTicks);
        const cleanName = h.name
          .replace(/\(Quote.*?\)/i, '')
          .replace(/\(Motor.*?\)/i, '')
          .trim();
        return {
          id: h.id,
          label: cleanName.length > 28 ? cleanName.substring(0, 26) + '...' : cleanName,
          pct: Math.round(stats.taskPct),
          count: h.children ? h.children.length : 0,
        };
      }),
    ];

    return items;
  }, [visibleTasks, activeSubprojectNode, pendingTicks]);

  // TIER 3: The Last Headings / Actionable Items
  const displayedNodes: TaskNode[] = useMemo(() => {
    const headingsSource: TaskNode[] = activeSubprojectNode
      ? activeSubprojectNode.children || []
      : visibleTasks.flatMap((sp) => (sp.children && sp.children.length > 0 ? sp.children : [sp]));

    if (selectedHeadingId === 'all') {
      return headingsSource.length > 0
        ? headingsSource
        : (activeSubprojectNode ? [activeSubprojectNode] : visibleTasks);
    }

    const matchedHeading = headingsSource.find((h) => h.id === selectedHeadingId);
    if (!matchedHeading) return headingsSource;

    // Show the last headings / items under this heading
    if (matchedHeading.children && matchedHeading.children.length > 0) {
      return matchedHeading.children;
    }

    // Direct leaf task (milestones, single tasks)
    return [matchedHeading];
  }, [visibleTasks, activeSubprojectNode, selectedHeadingId]);

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

  // Completed tasks filtering
  const completionFilteredNodes = useMemo(() => {
    return filterTreeByCompletion(displayedNodes, hideCompleted, pendingTicks);
  }, [displayedNodes, hideCompleted, pendingTicks]);

  // Count how many completed leaf tasks are hidden in the current view
  const hiddenCompletedCount = useMemo(() => {
    if (!hideCompleted) return 0;
    const allStats = calculateTreeStats(displayedNodes);
    const visStats = calculateTreeStats(completionFilteredNodes);
    return Math.max(0, allStats.completedLeafTasks - visStats.completedLeafTasks);
  }, [displayedNodes, completionFilteredNodes, hideCompleted]);

  // Search filtering applied on completion-filtered nodes
  const { filteredNodes, matchCount, autoExpandIds } = useMemo(() => {
    return filterTreeByQuery(completionFilteredNodes, searchQuery);
  }, [completionFilteredNodes, searchQuery]);

  // Global search count across all tasks
  const globalMatchCount = useMemo(() => {
    if ((selectedSubprojectId === 'all' && selectedHeadingId === 'all') || !searchQuery.trim()) {
      return 0;
    }
    return filterTreeByQuery(allTasks, searchQuery).matchCount;
  }, [allTasks, searchQuery, selectedSubprojectId, selectedHeadingId]);

  // Visible summary IDs for expand/minimize
  const visibleSummaryIds = useMemo(() => {
    return getAllSummaryIds(completionFilteredNodes);
  }, [completionFilteredNodes]);

  // Combined expanded IDs
  const activeExpandedIds = useMemo(() => {
    if (!searchQuery.trim()) return expandedIds;
    return new Set([...expandedIds, ...autoExpandIds]);
  }, [expandedIds, autoExpandIds, searchQuery]);

  const isAllMinimized = useMemo(() => {
    if (visibleSummaryIds.size === 0) return false;
    for (const id of visibleSummaryIds) {
      if (expandedIds.has(id)) return false;
    }
    return true;
  }, [visibleSummaryIds, expandedIds]);

  const handleToggleMinimizeAll = () => {
    if (isAllMinimized) {
      setExpandedIds(new Set(visibleSummaryIds));
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

  const stats = useMemo(
    () => calculateTreeStats(displayedNodes, pendingTicks),
    [displayedNodes, pendingTicks]
  );

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
    if (role !== 'owner') {
      setIsElevateModalOpen(true);
      return;
    }
    try {
      const { error } = await supabase.rpc('save_tree_progress', {
        changes: [{ kind: 'unlock', task_id: task.id }],
      });
      if (error) {
        console.error('Unlock error:', error);
        alert(`Failed to unlock stage: ${error.message}`);
        return;
      }
      await refreshData();
    } catch (e: any) {
      console.error('Unlock error:', e);
    }
  };

  const handleDiscard = () => {
    updatePending({});
  };

  const handleSave = async () => {
    setIsSaving(true);

    const taskMap = new Map(dbTasks.map((t) => [t.id, t.project_id]));
    const changes = Object.entries(pendingTicks).map(([taskId, val]) => ({
      kind: 'tick',
      task_id: taskId,
      project_id: taskMap.get(taskId) || 'avi-line-4---e-i-site-installation',
      done_by_name: val.doneByName,
      ticked_at: val.tickedAt,
    }));

    try {
      const { error } = await supabase.rpc('save_tree_progress', { changes });
      if (error) {
        console.error('RPC save failed:', error);
        alert(`Failed to save progress: ${error.message || 'Database error'}`);
        return;
      }

      const count = Object.keys(pendingTicks).length;
      updatePending({});
      await refreshData();
      setAutoSyncMessage(`Successfully saved and locked ${count} ${count === 1 ? 'stage' : 'stages'}`);
      setTimeout(() => {
        setAutoSyncMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error('RPC save exception:', err);
      alert(`Save failed: ${err.message || 'Network error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const pendingCount = Object.keys(pendingTicks).length;
  const hasMissingNames = Object.values(pendingTicks).some(
    (p) => !p.doneByName || p.doneByName.trim().length === 0
  );

  // Authentication Loading Screen
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 text-sky-500 animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-medium tracking-wide">
          Verifying Protemp Security...
        </p>
      </div>
    );
  }

  // Lock Screen Gate
  if (!isAuthenticated) {
    return <LockScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="min-h-screen pb-12">
      {/* 3-Tier Navigation Header */}
      <Header
        title="AVI Line 4 Site Progress"
        subtitle="MS Project Master & Linked Subprojects"
        role={role}
        userName={userName}
        isOffline={isOffline}
        onOpenSync={() => setIsSyncModalOpen(true)}
        onQuickSync={() => triggerCloudSync(true)}
        isAutoSyncing={isAutoSyncing}
        lastSyncedLabel={lastSyncedLabel}
        onToggleSearch={handleToggleSearch}
        isSearchOpen={isSearchOpen}
        onOpenContractorAccess={() => setIsContractorModalOpen(true)}
        onElevateAdmin={() => setIsElevateModalOpen(true)}
        onLogout={handleLogout}
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

      {/* Auto-Sync Notification Banner */}
      {(isAutoSyncing || autoSyncMessage) && (
        <div className="max-w-3xl mx-auto px-4 mt-2">
          <div
            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border shadow-xs transition-all ${
              isAutoSyncing
                ? 'bg-blue-50/80 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900/50'
                : 'bg-emerald-50/90 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isAutoSyncing
                    ? 'animate-spin text-blue-600 dark:text-blue-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              />
              <span>
                {isAutoSyncing
                  ? 'Syncing latest MS Project updates from OneDrive...'
                  : autoSyncMessage}
              </span>
            </div>
            {!isAutoSyncing && (
              <button
                type="button"
                onClick={() => setAutoSyncMessage(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 mt-2">
        {/* Dynamic Summary Tiles for the currently active Tier view */}
        <SummaryTiles
          completedItems={stats.completedLeafTasks}
          totalItems={stats.totalLeafTasks}
          completedStages={stats.completedLeafTasks}
          totalStages={stats.totalLeafTasks}
          workPct={stats.taskPct}
          earnedHours={stats.earnedHours}
          quotedHours={stats.totalQuotedHours}
          completedPanels={stats.completedPanels}
          totalPanels={stats.totalPanels}
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

              {/* Show / Hide Completed Button */}
              <button
                type="button"
                onClick={() => setHideCompleted((prev) => !prev)}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-xs ${
                  hideCompleted
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-fg-light dark:text-fg-dark border-line-light dark:border-line-dark'
                }`}
                title={
                  hideCompleted
                    ? `Completed tasks hidden (${hiddenCompletedCount} hidden). Click to show completed tasks.`
                    : 'Click to hide completed tasks and show only pending work'
                }
              >
                {hideCompleted ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="hidden sm:inline">Completed Hidden</span>
                    <span className="sm:hidden">Hidden</span>
                    {hiddenCompletedCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300">
                        {hiddenCompletedCount}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-muted-light dark:text-muted-dark" />
                    <span className="hidden sm:inline">Hide Completed</span>
                    <span className="sm:hidden">Hide Done</span>
                  </>
                )}
              </button>

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
                    ({hideCompleted ? `${completionFilteredNodes.length} pending` : `${displayedNodes.length} ${displayedNodes.length === 1 ? 'item' : 'items'}`})
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
          {hideCompleted && displayedNodes.length > 0 && completionFilteredNodes.length === 0 && !searchQuery.trim() ? (
            <div className="bg-surface-light dark:bg-surface-dark border border-emerald-500/30 rounded-xl p-8 text-center shadow-xs my-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-fg-light dark:text-fg-dark">
                All tasks in this section are completed!
              </h3>
              <p className="text-xs text-muted-light dark:text-muted-dark max-w-md mx-auto">
                All {stats.totalLeafTasks} tasks in &ldquo;{selectedHeadingId !== 'all' ? tier2Headings.find((h) => h.id === selectedHeadingId)?.label : activeSubprojectNode ? activeSubprojectNode.name : 'this view'}&rdquo; have been ticked off and locked.
              </p>
              <button
                type="button"
                onClick={() => setHideCompleted(false)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                Show Completed Tasks ({stats.completedLeafTasks})
              </button>
            </div>
          ) : (
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
          )}
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

      {/* Contractor Subproject Access Modal (Admin only) */}
      <ContractorAccessModal
        isOpen={isContractorModalOpen}
        onClose={() => setIsContractorModalOpen(false)}
        subprojects={assignableSubprojects}
        initialAllowed={allowedSubprojects}
        onSaveAllowed={handleSaveContractorAllowed}
      />

      {/* Admin Elevation Modal */}
      {isElevateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-fg-light dark:text-fg-dark">
                  Unlock Admin Privileges
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsElevateModalOpen(false);
                  setElevatePassword('');
                  setElevateError(null);
                }}
                className="p-1 rounded-lg text-muted-light hover:text-fg-light dark:hover:text-fg-dark transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-light dark:text-muted-dark">
              Enter the Admin Password or Master PIN to unlock stage editing and project controls.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleElevateToAdmin();
              }}
              className="space-y-3"
            >
              <input
                type="password"
                placeholder="Enter Admin password"
                value={elevatePassword}
                onChange={(e) => {
                  setElevatePassword(e.target.value);
                  setElevateError(null);
                }}
                autoFocus
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-line-light dark:border-line-dark bg-slate-50 dark:bg-slate-900 text-fg-light dark:text-fg-dark focus:outline-hidden focus:ring-1 focus:ring-purple-500"
              />

              {elevateError && (
                <p className="text-xs text-rose-500 font-medium">{elevateError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsElevateModalOpen(false);
                    setElevatePassword('');
                    setElevateError(null);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-muted-light dark:text-muted-dark hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isElevating || !elevatePassword.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Key className="w-3.5 h-3.5" />
                  {isElevating ? 'Verifying...' : 'Unlock Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
