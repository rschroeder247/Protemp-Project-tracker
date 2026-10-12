'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  User,
  ArrowLeft,
  TrendingUp,
  BarChart3,
  Layers,
  CheckCircle2,
  Download,
  Printer,
  Search,
  Filter,
  Shield,
  Briefcase,
  HardHat,
  Sparkles,
  RefreshCw,
  FolderTree,
  ChevronRight,
  Award,
  Zap,
  Users,
} from 'lucide-react';
import { LockScreen } from '@/components/LockScreen';
import { UserRole } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { parsePersons, consolidateTeamName, matchesPersonOrTeam } from '@/lib/nameNormalizer';

interface ReportsClientProps {
  initialDbTasks: any[];
  initialDbProgress: any[];
  initialDbProjects: any[];
}

type TimeframeOption = '7d' | '30d' | 'all';
type MetricOption = 'hours' | 'tasks';

export function ReportsClient({
  initialDbTasks,
  initialDbProgress,
  initialDbProjects,
}: ReportsClientProps) {
  // Authentication & Session
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [role, setRole] = useState<UserRole>('owner');
  const [userName, setUserName] = useState<string>('Roland (Admin)');
  const [allowedSubprojects, setAllowedSubprojects] = useState<string[]>([]);

  // Filtering State
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<TimeframeOption>('30d');
  const [chartMetric, setChartMetric] = useState<MetricOption>('hours');
  const [activitySearch, setActivitySearch] = useState<string>('');
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [teamViewMode, setTeamViewMode] = useState<'individual' | 'crews'>('individual');

  // Live state
  const [dbTasks, setDbTasks] = useState<any[]>(initialDbTasks);
  const [dbProgress, setDbProgress] = useState<any[]>(initialDbProgress);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check persistent session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.authenticated) {
          setIsAuthenticated(true);
          setRole(data.role);
          setUserName(data.name || (data.role === 'owner' ? 'Roland (Admin)' : 'Staff'));
          setAllowedSubprojects(data.allowedSubprojects || []);
        } else {
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
        console.warn('Session check notice:', err);
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
    } catch {}
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { data: pData } = await supabase
        .from('tracker_task_progress')
        .select('*')
        .order('ticked_at', { ascending: false })
        .limit(5000);
      if (pData) setDbProgress(pData);
    } catch (e) {
      console.warn('Refresh error:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Helper to get friendly project names
  const cleanProjectName = (rawName: string) => {
    return rawName
      .replace(/\(Quote.*?\)/i, '')
      .replace(/\(Motor.*?\)/i, '')
      .replace(/\(JB.*?\)/i, '')
      .replace(/_/g, ' ')
      .trim();
  };

  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of initialDbProjects) {
      map.set(p.id, cleanProjectName(p.title || p.id));
    }
    // Also include from tasks if project table missing some
    for (const t of dbTasks) {
      if (t.project_id && !map.has(t.project_id)) {
        map.set(t.project_id, cleanProjectName(t.project_id));
      }
    }
    return map;
  }, [initialDbProjects, dbTasks]);

  // Available selectable projects (filtered by contractor access if needed)
  const availableProjects = useMemo(() => {
    const distinctProjectIds = Array.from(new Set(dbTasks.map((t) => t.project_id))).filter(Boolean);
    let allowedIds = distinctProjectIds;
    if (role === 'contractor' && allowedSubprojects.length > 0) {
      const allowedSet = new Set(allowedSubprojects);
      allowedIds = distinctProjectIds.filter((pid) => allowedSet.has(pid));
    }

    return allowedIds.map((pid) => ({
      id: pid,
      name: projectMap.get(pid) || pid,
    }));
  }, [dbTasks, role, allowedSubprojects, projectMap]);

  // Filter tasks and progress by selected project
  const filteredTasks = useMemo(() => {
    if (selectedProjectId === 'all') {
      if (role === 'contractor' && allowedSubprojects.length > 0) {
        const allowedSet = new Set(allowedSubprojects);
        return dbTasks.filter((t) => allowedSet.has(t.project_id));
      }
      return dbTasks;
    }
    return dbTasks.filter((t) => t.project_id === selectedProjectId);
  }, [dbTasks, selectedProjectId, role, allowedSubprojects]);

  const taskLookup = useMemo(() => {
    const map = new Map<string, any>();
    for (const t of filteredTasks) {
      map.set(t.id, t);
    }
    return map;
  }, [filteredTasks]);

  const filteredProgress = useMemo(() => {
    let list = dbProgress;
    if (selectedProjectId !== 'all') {
      list = list.filter((p) => p.project_id === selectedProjectId);
    } else if (role === 'contractor' && allowedSubprojects.length > 0) {
      const allowedSet = new Set(allowedSubprojects);
      list = list.filter((p) => allowedSet.has(p.project_id));
    }
    return list;
  }, [dbProgress, selectedProjectId, role, allowedSubprojects]);

  // Overall Project KPIs
  const totalLeafTasks = useMemo(() => {
    return filteredTasks.filter((t) => !t.is_summary).length;
  }, [filteredTasks]);

  const totalQuotedHours = useMemo(() => {
    return filteredTasks
      .filter((t) => !t.is_summary)
      .reduce((sum, t) => sum + (Number(t.quoted_hours) || 0), 0);
  }, [filteredTasks]);

  const overallEarnedHours = useMemo(() => {
    return filteredProgress.reduce((sum, p) => {
      const t = taskLookup.get(p.task_id);
      return sum + (Number(t?.quoted_hours) || 0);
    }, 0);
  }, [filteredProgress, taskLookup]);

  const overallCompletedStages = filteredProgress.length;
  const overallTaskPct = totalLeafTasks > 0 ? (overallCompletedStages / totalLeafTasks) * 100 : 0;
  const overallHoursPct = totalQuotedHours > 0 ? (overallEarnedHours / totalQuotedHours) * 100 : 0;

  // Enriched progress records sorted by date descending
  const enrichedProgress = useMemo(() => {
    return filteredProgress
      .map((p) => {
        const task = taskLookup.get(p.task_id);
        const quotedHrs = Number(task?.quoted_hours) || 0;
        const tickedDate = p.ticked_at ? new Date(p.ticked_at) : new Date();
        const dateStr = p.ticked_at ? p.ticked_at.substring(0, 10) : '';

        const rawDone = p.done_by_name || '';
        const consolidated = consolidateTeamName(rawDone);
        const persons = parsePersons(rawDone);

        return {
          id: `${p.task_id}_${p.ticked_at}`,
          taskId: p.task_id,
          taskName: task?.name || 'Task ' + p.task_id,
          wbs: task?.wbs || '',
          projectId: p.project_id,
          projectName: projectMap.get(p.project_id) || p.project_id,
          doneByName: consolidated,
          rawDoneByName: rawDone,
          persons: persons.length > 0 ? persons : [consolidated],
          tickedAt: p.ticked_at,
          tickedDate,
          dateStr,
          quotedHours: quotedHrs,
        };
      })
      .sort((a, b) => b.tickedDate.getTime() - a.tickedDate.getTime());
  }, [filteredProgress, taskLookup, projectMap]);

  // Most recent data entry
  const latestEntry = enrichedProgress.length > 0 ? enrichedProgress[0] : null;

  // Calendar Date Range Construction
  const { dateRangeDays, startDate, endDate, dateKeys } = useMemo(() => {
    const now = new Date();
    // Use local end of day
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start = new Date(end);

    if (timeframe === '7d') {
      start.setDate(end.getDate() - 6);
    } else if (timeframe === '30d') {
      start.setDate(end.getDate() - 29);
    } else {
      // 'all' time: find earliest progress date or fallback 30 days
      if (enrichedProgress.length > 0) {
        const earliest = enrichedProgress[enrichedProgress.length - 1].tickedDate;
        start = new Date(earliest.getFullYear(), earliest.getMonth(), earliest.getDate());
      } else {
        start.setDate(end.getDate() - 29);
      }
    }

    const keys: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const year = cur.getFullYear();
      const month = String(cur.getMonth() + 1).padStart(2, '0');
      const day = String(cur.getDate()).padStart(2, '0');
      keys.push(`${year}-${month}-${day}`);
      cur.setDate(cur.getDate() + 1);
    }

    const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    return {
      dateRangeDays: diffDays,
      startDate: start,
      endDate: end,
      dateKeys: keys,
    };
  }, [timeframe, enrichedProgress]);

  // Aggregate progress records into daily trend buckets
  const dailyTrends = useMemo(() => {
    // Map progress by date string
    const dayMap = new Map<string, typeof enrichedProgress>();
    for (const ep of enrichedProgress) {
      const existing = dayMap.get(ep.dateStr) || [];
      existing.push(ep);
      dayMap.set(ep.dateStr, existing);
    }

    let runningTasks = 0;
    let runningHours = 0;

    // First calculate total prior progress before startDate for cumulative accuracy
    for (const ep of enrichedProgress) {
      if (ep.dateStr < dateKeys[0]) {
        runningTasks += 1;
        runningHours += ep.quotedHours;
      }
    }

    const days = dateKeys.map((dateStr) => {
      const items = dayMap.get(dateStr) || [];
      const tasksCount = items.length;
      const earnedHours = items.reduce((sum, i) => sum + i.quotedHours, 0);
      const uniquePersons = Array.from(new Set(items.flatMap((i) => i.persons)));

      runningTasks += tasksCount;
      runningHours += earnedHours;

      const dateObj = new Date(dateStr + 'T00:00:00');
      const dayName = dateObj.toLocaleDateString([], { weekday: 'short' });
      const formattedDate = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const fullDate = dateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

      return {
        dateStr,
        dayName,
        formattedDate,
        shortDate: formattedDate,
        fullDate,
        tasksCount,
        earnedHours: Number(earnedHours.toFixed(2)),
        technicians: uniquePersons,
        items,
        cumulativeTasks: runningTasks,
        cumulativeHours: Number(runningHours.toFixed(2)),
        cumulativePct: totalLeafTasks > 0 ? Number(((runningTasks / totalLeafTasks) * 100).toFixed(1)) : 0,
      };
    });

    return days;
  }, [dateKeys, enrichedProgress, totalLeafTasks]);

  // Period-specific KPIs
  const periodStats = useMemo(() => {
    const inPeriodRecords = enrichedProgress.filter((p) => p.dateStr >= dateKeys[0] && p.dateStr <= dateKeys[dateKeys.length - 1]);
    const periodTasks = inPeriodRecords.length;
    const periodHours = inPeriodRecords.reduce((sum, p) => sum + p.quotedHours, 0);
    const activeDaysCount = dailyTrends.filter((d) => d.tasksCount > 0).length;
    const uniquePersons = Array.from(new Set(inPeriodRecords.flatMap((p) => p.persons)));

    const avgTasksPerActiveDay = activeDaysCount > 0 ? (periodTasks / activeDaysCount).toFixed(1) : '0';
    const avgHoursPerDay = (periodHours / dateRangeDays).toFixed(1);

    return {
      periodTasks,
      periodHours: Number(periodHours.toFixed(1)),
      activeDaysCount,
      totalDays: dateRangeDays,
      uniqueTechCount: uniquePersons.length,
      uniquePersons,
      avgTasksPerActiveDay,
      avgHoursPerDay,
    };
  }, [enrichedProgress, dateKeys, dailyTrends, dateRangeDays]);

  // Team Leaderboards (Both Individual Persons & Consolidated Crews)
  const { individualLeaderboard, crewLeaderboard } = useMemo(() => {
    const inPeriodRecords = enrichedProgress.filter(
      (p) => p.dateStr >= dateKeys[0] && p.dateStr <= dateKeys[dateKeys.length - 1]
    );

    // 1. Individual Persons calculation
    const personMap = new Map<string, { tasks: number; hours: number; soloTasks: number; crewTasks: number }>();
    for (const r of inPeriodRecords) {
      const isSolo = r.persons.length <= 1;
      for (const p of r.persons) {
        const prev = personMap.get(p) || { tasks: 0, hours: 0, soloTasks: 0, crewTasks: 0 };
        personMap.set(p, {
          tasks: prev.tasks + 1,
          hours: Number((prev.hours + r.quotedHours).toFixed(2)),
          soloTasks: prev.soloTasks + (isSolo ? 1 : 0),
          crewTasks: prev.crewTasks + (isSolo ? 0 : 1),
        });
      }
    }

    const maxPersonTasks = Math.max(1, ...Array.from(personMap.values()).map((v) => v.tasks));
    const individualList = Array.from(personMap.entries())
      .map(([name, stats]) => ({
        name,
        tasks: stats.tasks,
        hours: Number(stats.hours.toFixed(1)),
        soloTasks: stats.soloTasks,
        crewTasks: stats.crewTasks,
        pctOfMax: Math.round((stats.tasks / maxPersonTasks) * 100),
        pctOfPeriod: periodStats.periodHours > 0 ? Math.round((stats.hours / periodStats.periodHours) * 100) : 0,
      }))
      .sort((a, b) => b.tasks - a.tasks || b.hours - a.hours);

    // 2. Consolidated Crews calculation
    const crewMap = new Map<string, { tasks: number; hours: number; persons: string[] }>();
    for (const r of inPeriodRecords) {
      const prev = crewMap.get(r.doneByName) || { tasks: 0, hours: 0, persons: r.persons };
      crewMap.set(r.doneByName, {
        tasks: prev.tasks + 1,
        hours: Number((prev.hours + r.quotedHours).toFixed(2)),
        persons: r.persons,
      });
    }

    const maxCrewTasks = Math.max(1, ...Array.from(crewMap.values()).map((v) => v.tasks));
    const crewList = Array.from(crewMap.entries())
      .map(([name, stats]) => ({
        name,
        tasks: stats.tasks,
        hours: Number(stats.hours.toFixed(1)),
        persons: stats.persons,
        memberCount: stats.persons.length,
        pctOfMax: Math.round((stats.tasks / maxCrewTasks) * 100),
        pctOfPeriod: periodStats.periodHours > 0 ? Math.round((stats.hours / periodStats.periodHours) * 100) : 0,
      }))
      .sort((a, b) => b.tasks - a.tasks || b.hours - a.hours);

    return { individualLeaderboard: individualList, crewLeaderboard: crewList };
  }, [enrichedProgress, dateKeys, periodStats.periodHours]);

  // Filtered recent activity search
  const filteredActivityList = useMemo(() => {
    const q = activitySearch.trim().toLowerCase();
    if (!q) return enrichedProgress.slice(0, 50);

    return enrichedProgress
      .filter((p) => {
        return (
          p.taskName.toLowerCase().includes(q) ||
          p.wbs.toLowerCase().includes(q) ||
          p.projectName.toLowerCase().includes(q) ||
          p.dateStr.includes(q) ||
          matchesPersonOrTeam(p.doneByName, q)
        );
      })
      .slice(0, 100);
  }, [enrichedProgress, activitySearch]);

  // Selected day details for inspector modal/popover
  const activeDayDetail = useMemo(() => {
    if (!selectedDayDate) return null;
    return dailyTrends.find((d) => d.dateStr === selectedDayDate) || null;
  }, [selectedDayDate, dailyTrends]);

  // Export Daily Data to CSV
  const handleExportCsv = () => {
    const headers = 'Date,Day,Stages Completed,Earned Hours,Cumulative Stages,Cumulative Pct,Technicians\n';
    const rows = dailyTrends
      .map((d) => {
        const techs = `"${d.technicians.join(', ')}"`;
        return `${d.dateStr},${d.dayName},${d.tasksCount},${d.earnedHours},${d.cumulativeTasks},${d.cumulativePct}%,${techs}`;
      })
      .join('\n');

    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `protemp_progress_trend_${timeframe}_${selectedProjectId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Max values for chart scaling
  const maxDayValue = useMemo(() => {
    if (chartMetric === 'hours') {
      const maxH = Math.max(...dailyTrends.map((d) => d.earnedHours), 1);
      return Math.ceil(maxH * 1.15);
    }
    const maxT = Math.max(...dailyTrends.map((d) => d.tasksCount), 1);
    return Math.ceil(maxT * 1.15);
  }, [dailyTrends, chartMetric]);

  // Loading Screen
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

  // Lock Screen
  if (!isAuthenticated) {
    return <LockScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark pb-16 font-sans">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 bg-surface-light dark:bg-surface-dark border-b border-line-light dark:border-line-dark shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Title & Back Button */}
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-fg-light dark:text-fg-dark transition-colors border border-line-light dark:border-line-dark flex items-center gap-1.5 text-xs font-semibold"
                title="Return to Task Tracker view"
              >
                <ArrowLeft className="w-4 h-4 text-accent-light dark:text-accent-dark" />
                <span className="hidden sm:inline">Tracker</span>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-fg-light dark:text-fg-dark flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Daily Progress Trends &amp; Report
                  </h1>
                </div>
                <p className="text-[11px] text-muted-light dark:text-muted-dark">
                  Historical tracking, daily velocity &amp; live site audit
                </p>
              </div>
            </div>

            {/* Role Badge & Actions */}
            <div className="flex items-center gap-2 flex-wrap">
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
                  <Shield className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                ) : role === 'staff' ? (
                  <Briefcase className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                ) : (
                  <HardHat className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                )}
                <span>{userName}</span>
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-fg-light dark:text-fg-dark border border-line-light dark:border-line-dark transition-colors"
                title="Refresh live progress data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>

              {/* Export CSV */}
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-fg-light dark:text-fg-dark border border-line-light dark:border-line-dark transition-colors"
                title="Download daily trend as CSV"
              >
                <Download className="w-3.5 h-3.5 text-accent-light dark:text-accent-dark" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              {/* Print Button */}
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                title="Print or Save as PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print Report</span>
              </button>
            </div>
          </div>

          {/* Filter Bar: Project Selection & Timeframe */}
          <div className="mt-3 pt-2.5 border-t border-line-light/60 dark:border-line-dark/60 flex items-center justify-between gap-3 flex-wrap">
            {/* Project Selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold tracking-wider uppercase text-muted-light dark:text-muted-dark flex items-center gap-1">
                <FolderTree className="w-3.5 h-3.5 text-accent-light dark:text-accent-dark" />
                Project:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedProjectId('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    selectedProjectId === 'all'
                      ? 'bg-accent-light text-white dark:bg-accent-dark dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-muted-light dark:text-muted-dark hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  All Projects (Master)
                </button>
                {availableProjects.map((proj) => {
                  const isActive = selectedProjectId === proj.id;
                  return (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => setSelectedProjectId(proj.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-accent-light text-white dark:bg-accent-dark dark:text-slate-900 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-muted-light dark:text-muted-dark hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {proj.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timeframe Selector (1 Week / 1 Month / All Time) */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-line-light dark:border-line-dark text-xs">
              <button
                type="button"
                onClick={() => setTimeframe('7d')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  timeframe === '7d'
                    ? 'bg-surface-light dark:bg-surface-dark text-fg-light dark:text-fg-dark shadow-xs font-bold'
                    : 'text-muted-light dark:text-muted-dark hover:text-fg-light dark:hover:text-fg-dark'
                }`}
              >
                1 Week
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('30d')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  timeframe === '30d'
                    ? 'bg-surface-light dark:bg-surface-dark text-fg-light dark:text-fg-dark shadow-xs font-bold'
                    : 'text-muted-light dark:text-muted-dark hover:text-fg-light dark:hover:text-fg-dark'
                }`}
              >
                1 Month
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  timeframe === 'all'
                    ? 'bg-surface-light dark:bg-surface-dark text-fg-light dark:text-fg-dark shadow-xs font-bold'
                    : 'text-muted-light dark:text-muted-dark hover:text-fg-light dark:hover:text-fg-dark'
                }`}
              >
                All Time
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Report Dashboard */}
      <main className="max-w-5xl mx-auto px-4 mt-4 space-y-4">
        {/* HERO: Last Entered Data Highlight Card */}
        {latestEntry ? (
          <div className="bg-gradient-to-r from-emerald-500/10 via-surface-light to-surface-light dark:from-emerald-950/40 dark:via-surface-dark dark:to-surface-dark border border-emerald-500/30 rounded-2xl p-4 shadow-xs">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Last Entered Data
                    </span>
                    <span className="text-xs text-muted-light dark:text-muted-dark font-mono">
                      {latestEntry.tickedDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at{' '}
                      {latestEntry.tickedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-fg-light dark:text-fg-dark mt-1">
                    {latestEntry.taskName}{' '}
                    {latestEntry.wbs && (
                      <span className="text-xs font-mono font-normal text-muted-light dark:text-muted-dark">
                        (WBS {latestEntry.wbs})
                      </span>
                    )}
                  </h2>
                </div>
              </div>

              {/* Technician & Project Pill */}
              <div className="flex items-center gap-2 flex-wrap self-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-fg-light dark:text-fg-dark border border-line-light dark:border-line-dark">
                  <User className="w-3.5 h-3.5 text-accent-light dark:text-accent-dark" />
                  <span>By: {latestEntry.doneByName}</span>
                </div>
                {latestEntry.persons.length > 1 && (
                  <div className="hidden sm:flex items-center gap-1">
                    {latestEntry.persons.map((person) => (
                      <span
                        key={person}
                        className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold border border-emerald-400/20"
                      >
                        {person}
                      </span>
                    ))}
                  </div>
                )}
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800">
                  <span>{latestEntry.quotedHours} hrs</span>
                </div>
                <div className="text-xs text-muted-light dark:text-muted-dark font-medium hidden md:inline">
                  &bull; {latestEntry.projectName}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-2xl p-6 text-center text-muted-light dark:text-muted-dark">
            <Clock className="w-6 h-6 mx-auto mb-2 text-slate-400" />
            <p className="text-sm font-medium">No progress records found for this project filter.</p>
          </div>
        )}

        {/* Executive KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1: Stages Completed in Period */}
          <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-xl p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-muted-light dark:text-muted-dark text-xs">
              <span className="font-medium">Completed ({timeframe.toUpperCase()})</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-fg-light dark:text-fg-dark">
                {periodStats.periodTasks}
              </span>
              <span className="text-xs text-muted-light dark:text-muted-dark">stages</span>
            </div>
            <p className="text-[11px] text-muted-light dark:text-muted-dark mt-1">
              {overallCompletedStages} total to date ({overallTaskPct.toFixed(1)}%)
            </p>
          </div>

          {/* Card 2: Earned Hours in Period */}
          <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-xl p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-muted-light dark:text-muted-dark text-xs">
              <span className="font-medium">Earned Hours</span>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-fg-light dark:text-fg-dark">
                {periodStats.periodHours}
              </span>
              <span className="text-xs text-muted-light dark:text-muted-dark">hrs</span>
            </div>
            <p className="text-[11px] text-muted-light dark:text-muted-dark mt-1">
              {overallEarnedHours.toFixed(1)} of {totalQuotedHours.toFixed(1)} quoted hrs
            </p>
          </div>

          {/* Card 3: Velocity & Daily Average */}
          <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-xl p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-muted-light dark:text-muted-dark text-xs">
              <span className="font-medium">Daily Velocity</span>
              <BarChart3 className="w-4 h-4 text-purple-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-fg-light dark:text-fg-dark">
                {periodStats.avgTasksPerActiveDay}
              </span>
              <span className="text-xs text-muted-light dark:text-muted-dark">stages/workday</span>
            </div>
            <p className="text-[11px] text-muted-light dark:text-muted-dark mt-1">
              {periodStats.activeDaysCount} active site days in period
            </p>
          </div>

          {/* Card 4: Active Team Members */}
          <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-xl p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-muted-light dark:text-muted-dark text-xs">
              <span className="font-medium">Active Team</span>
              <User className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-fg-light dark:text-fg-dark">
                {periodStats.uniqueTechCount}
              </span>
              <span className="text-xs text-muted-light dark:text-muted-dark">technicians</span>
            </div>
            <p className="text-[11px] text-muted-light dark:text-muted-dark mt-1">
              Logging site completions
            </p>
          </div>
        </div>

        {/* Daily Progress Trend Chart Card */}
        <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <h3 className="text-sm font-bold text-fg-light dark:text-fg-dark flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-accent-light dark:text-accent-dark" />
                Daily Progress Trend ({timeframe === '7d' ? 'Last 7 Days' : timeframe === '30d' ? 'Last 30 Days' : 'All Time'})
              </h3>
              <p className="text-[11px] text-muted-light dark:text-muted-dark">
                Click any bar to inspect daily technician breakdown and completed stages
              </p>
            </div>

            {/* Toggle metric (Earned Hours vs Stages Completed) */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-line-light dark:border-line-dark text-xs">
              <button
                type="button"
                onClick={() => setChartMetric('hours')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  chartMetric === 'hours'
                    ? 'bg-surface-light dark:bg-surface-dark text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                    : 'text-muted-light dark:text-muted-dark hover:text-fg-light'
                }`}
              >
                Earned Hours
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('tasks')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  chartMetric === 'tasks'
                    ? 'bg-surface-light dark:bg-surface-dark text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                    : 'text-muted-light dark:text-muted-dark hover:text-fg-light'
                }`}
              >
                Stages Ticked
              </button>
            </div>
          </div>

          {/* Interactive SVG Bar Chart */}
          <div className="w-full overflow-x-auto no-scrollbar pb-2">
            <div className="min-w-[500px]">
              {/* Chart Canvas */}
              <div className="h-48 flex items-end gap-1.5 pt-6 pb-2 border-b border-line-light dark:border-line-dark">
                {dailyTrends.map((d) => {
                  const val = chartMetric === 'hours' ? d.earnedHours : d.tasksCount;
                  const heightPct = maxDayValue > 0 ? Math.min(100, Math.max(val > 0 ? 8 : 2, (val / maxDayValue) * 100)) : 2;
                  const isSelected = selectedDayDate === d.dateStr;
                  const hasActivity = val > 0;

                  return (
                    <div
                      key={d.dateStr}
                      onClick={() => setSelectedDayDate(isSelected ? null : d.dateStr)}
                      className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer relative"
                      title={`${d.fullDate}: ${d.tasksCount} stages (${d.earnedHours} hrs)`}
                    >
                      {/* Value label on top of bar if active */}
                      {hasActivity && (
                        <span className="text-[10px] font-bold font-mono text-muted-light dark:text-muted-dark mb-1 group-hover:text-accent-light dark:group-hover:text-accent-dark transition-colors">
                          {chartMetric === 'hours' ? `${val}h` : val}
                        </span>
                      )}

                      {/* Bar body */}
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full max-w-[36px] rounded-t-md transition-all ${
                          hasActivity
                            ? isSelected
                              ? 'bg-accent-light dark:bg-accent-dark ring-2 ring-accent-light/50 shadow-md'
                              : chartMetric === 'hours'
                              ? 'bg-blue-500 dark:bg-blue-600 group-hover:bg-blue-600 dark:group-hover:bg-blue-500'
                              : 'bg-emerald-500 dark:bg-emerald-600 group-hover:bg-emerald-600 dark:group-hover:bg-emerald-500'
                            : 'bg-slate-200/50 dark:bg-slate-800/40 group-hover:bg-slate-300 dark:group-hover:bg-slate-700'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* X-Axis Date Labels */}
              <div className="flex items-center gap-1.5 pt-1.5 text-[10px] text-muted-light dark:text-muted-dark font-mono">
                {dailyTrends.map((d, idx) => {
                  // Only show every Nth date label if there are many days
                  const showLabel =
                    dailyTrends.length <= 10 ||
                    idx % Math.ceil(dailyTrends.length / 8) === 0 ||
                    idx === dailyTrends.length - 1;

                  return (
                    <div
                      key={d.dateStr}
                      className="flex-1 text-center truncate"
                    >
                      {showLabel ? d.formattedDate : ''}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selected Day Inspector Box */}
          {activeDayDetail && (
            <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-line-light dark:border-line-dark animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-line-light/60 dark:border-line-dark/60">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-fg-light dark:text-fg-dark">
                    {activeDayDetail.fullDate}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
                    {activeDayDetail.tasksCount} stages &bull; {activeDayDetail.earnedHours} earned hrs
                  </span>
                  {activeDayDetail.technicians.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] text-muted-light dark:text-muted-dark">Active team:</span>
                      {activeDayDetail.technicians.map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-fg-light dark:text-fg-dark font-semibold">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDayDate(null)}
                  className="text-xs text-muted-light hover:text-fg-light dark:hover:text-fg-dark"
                >
                  Close &times;
                </button>
              </div>

              {activeDayDetail.items.length > 0 ? (
                <div className="mt-2 space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {activeDayDetail.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-surface-light dark:bg-surface-dark border border-line-light/50 dark:border-line-dark/50"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="font-mono text-[10px] text-muted-light dark:text-muted-dark">
                          {item.tickedAt ? item.tickedAt.substring(11, 16) : ''}
                        </span>
                        <span className="font-medium text-fg-light dark:text-fg-dark truncate">
                          {item.taskName}
                        </span>
                        {item.wbs && (
                          <span className="text-[10px] font-mono text-muted-light dark:text-muted-dark">
                            ({item.wbs})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[11px] font-semibold text-accent-light dark:text-accent-dark">
                          {item.doneByName}
                        </span>
                        {item.persons.length > 1 && (
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-muted-light dark:text-muted-dark border border-line-light/40 dark:border-line-dark/40">
                            {item.persons.length}p
                          </span>
                        )}
                        <span className="text-[10px] text-muted-light dark:text-muted-dark font-mono font-medium">
                          {item.quotedHours}h
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-light dark:text-muted-dark mt-2">
                  No site tasks were recorded on this day.
                </p>
              )}
            </div>
          )}
        </div>

        {/* 2-Column Split: Cumulative S-Curve & Team Leaderboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cumulative Progress S-Curve (Growth over time) */}
          <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-fg-light dark:text-fg-dark flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Cumulative Growth Trend
                </h3>
                <p className="text-[11px] text-muted-light dark:text-muted-dark">
                  Overall progress accumulation curve
                </p>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold font-mono text-fg-light dark:text-fg-dark">
                  {overallTaskPct.toFixed(1)}%
                </span>
                <span className="text-[10px] text-muted-light dark:text-muted-dark block">
                  {overallCompletedStages} of {totalLeafTasks} tasks
                </span>
              </div>
            </div>

            {/* SVG Area Curve */}
            <div className="h-40 w-full pt-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 400 120" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid guidelines */}
                <line x1="0" y1="0" x2="400" y2="0" stroke="currentColor" className="text-line-light dark:text-line-dark" strokeDasharray="3 3" opacity="0.5" />
                <line x1="0" y1="60" x2="400" y2="60" stroke="currentColor" className="text-line-light dark:text-line-dark" strokeDasharray="3 3" opacity="0.5" />
                <line x1="0" y1="120" x2="400" y2="120" stroke="currentColor" className="text-line-light dark:text-line-dark" opacity="0.5" />

                {/* Generate polyline points from dailyTrends */}
                {(() => {
                  const points = dailyTrends.map((d, idx) => {
                    const x = (idx / Math.max(1, dailyTrends.length - 1)) * 400;
                    // Max height mapped to 120
                    const y = 120 - (totalLeafTasks > 0 ? (d.cumulativeTasks / totalLeafTasks) * 120 : 0);
                    return `${x},${y}`;
                  });

                  if (points.length === 0) return null;

                  const areaPoints = `0,120 ${points.join(' ')} 400,120`;

                  return (
                    <>
                      <polygon points={areaPoints} fill="url(#areaGradient)" />
                      <polyline
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={points.join(' ')}
                      />
                    </>
                  );
                })()}
              </svg>
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-light dark:text-muted-dark font-mono pt-2 border-t border-line-light/50 dark:border-line-dark/50">
              <span>{dailyTrends[0]?.formattedDate || 'Start'}</span>
              <span>Project Trajectory</span>
              <span>{dailyTrends[dailyTrends.length - 1]?.formattedDate || 'Today'}</span>
            </div>
          </div>

          {/* Team Contribution Leaderboard */}
          <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-2xl p-4 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div>
                  <h3 className="text-sm font-bold text-fg-light dark:text-fg-dark flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-500" />
                    Team Contribution Breakdown
                  </h3>
                  <p className="text-[11px] text-muted-light dark:text-muted-dark">
                    Work completed in selected {timeframe}
                  </p>
                </div>

                {/* View Mode Toggle: Individual vs Crews */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-line-light dark:border-line-dark text-xs">
                  <button
                    type="button"
                    onClick={() => setTeamViewMode('individual')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      teamViewMode === 'individual'
                        ? 'bg-surface-light dark:bg-surface-dark text-fg-light dark:text-fg-dark shadow-xs font-bold'
                        : 'text-muted-light dark:text-muted-dark hover:text-fg-light dark:hover:text-fg-dark'
                    }`}
                    title="Breakdown by each individual person who worked"
                  >
                    Individuals ({individualLeaderboard.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeamViewMode('crews')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      teamViewMode === 'crews'
                        ? 'bg-surface-light dark:bg-surface-dark text-fg-light dark:text-fg-dark shadow-xs font-bold'
                        : 'text-muted-light dark:text-muted-dark hover:text-fg-light dark:hover:text-fg-dark'
                    }`}
                    title="Consolidated crews (order-independent)"
                  >
                    Crews ({crewLeaderboard.length})
                  </button>
                </div>
              </div>

              {teamViewMode === 'individual' ? (
                individualLeaderboard.length > 0 ? (
                  <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                    {individualLeaderboard.map((tech, idx) => (
                      <div key={tech.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                idx === 0
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : idx === 1
                                  ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-fg-light dark:text-fg-dark">
                              {tech.name}
                            </span>
                            {tech.crewTasks > 0 && tech.soloTasks > 0 && (
                              <span className="text-[10px] text-muted-light dark:text-muted-dark hidden sm:inline">
                                ({tech.soloTasks} solo, {tech.crewTasks} crew)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="font-bold text-fg-light dark:text-fg-dark">
                              {tech.tasks} stages
                            </span>
                            <span className="text-muted-light dark:text-muted-dark">
                              ({tech.hours} hrs)
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, Math.max(8, tech.pctOfMax))}%` }}
                            className={`h-full rounded-full ${
                              idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-blue-500' : 'bg-emerald-500'
                            }`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-muted-light dark:text-muted-dark">
                    No individual progress records found in this period.
                  </div>
                )
              ) : (
                crewLeaderboard.length > 0 ? (
                  <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                    {crewLeaderboard.map((crew, idx) => (
                      <div key={crew.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 max-w-[65%] truncate">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                                idx === 0
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : idx === 1
                                  ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-fg-light dark:text-fg-dark truncate" title={crew.name}>
                              {crew.name}
                            </span>
                            {crew.memberCount > 1 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 font-mono text-muted-light dark:text-muted-dark border border-line-light/50 dark:border-line-dark/50 flex-shrink-0">
                                {crew.memberCount} crew
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[11px] flex-shrink-0">
                            <span className="font-bold text-fg-light dark:text-fg-dark">
                              {crew.tasks} stages
                            </span>
                            <span className="text-muted-light dark:text-muted-dark">
                              ({crew.hours} hrs)
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, Math.max(8, crew.pctOfMax))}%` }}
                            className={`h-full rounded-full ${
                              idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-blue-500' : 'bg-purple-500'
                            }`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-muted-light dark:text-muted-dark">
                    No crew entries found in this period.
                  </div>
                )
              )}
            </div>

            <div className="pt-2 border-t border-line-light/50 dark:border-line-dark/50 text-[11px] text-muted-light dark:text-muted-dark flex items-center justify-between">
              <span>Period Total:</span>
              <span className="font-bold font-mono text-fg-light dark:text-fg-dark">
                {periodStats.periodTasks} stages / {periodStats.periodHours} hrs
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Recent Activity Log (Last Entered Data) */}
        <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
              <h3 className="text-sm font-bold text-fg-light dark:text-fg-dark flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent-light dark:text-accent-dark" />
                Live Site Activity Log &amp; Audit Trail
              </h3>
              <p className="text-[11px] text-muted-light dark:text-muted-dark">
                Showing all recent completions in chronological order
              </p>
            </div>

            {/* Activity Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-light absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                placeholder="Filter by technician or task..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-line-light dark:border-line-dark bg-slate-50 dark:bg-slate-900/50 text-fg-light dark:text-fg-dark placeholder:text-muted-light dark:placeholder:text-muted-dark focus:outline-hidden focus:ring-1 focus:ring-accent-light"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto no-scrollbar max-h-96 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-line-light dark:border-line-dark text-[11px] text-muted-light dark:text-muted-dark uppercase tracking-wider font-semibold z-10">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Technician</th>
                  <th className="py-2.5 px-3">Task Name</th>
                  <th className="py-2.5 px-3">WBS</th>
                  <th className="py-2.5 px-3">Project</th>
                  <th className="py-2.5 px-3 text-right">Quoted Hrs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-light/50 dark:divide-line-dark/50">
                {filteredActivityList.length > 0 ? (
                  filteredActivityList.map((entry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-muted-light dark:text-muted-dark">
                        {entry.tickedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                        {entry.tickedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-fg-light dark:text-fg-dark inline-flex items-center gap-1">
                            <User className="w-3 h-3 text-accent-light dark:text-accent-dark" />
                            {entry.doneByName}
                          </span>
                          {entry.persons.length > 1 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-muted-light dark:text-muted-dark border border-line-light/50 dark:border-line-dark/50">
                              {entry.persons.length} crew
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 font-medium text-fg-light dark:text-fg-dark max-w-xs truncate">
                        {entry.taskName}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-muted-light dark:text-muted-dark">
                        {entry.wbs || '-'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-muted-light dark:text-muted-dark truncate max-w-[140px]">
                        {entry.projectName}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-right font-mono font-bold text-fg-light dark:text-fg-dark">
                        {entry.quotedHours > 0 ? `${entry.quotedHours}h` : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-light dark:text-muted-dark">
                      No matching activity records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-2.5 pt-2 border-t border-line-light/60 dark:border-line-dark/60 flex items-center justify-between text-[11px] text-muted-light dark:text-muted-dark">
            <span>
              Showing {filteredActivityList.length} of {enrichedProgress.length} total entries
            </span>
            <span className="italic">
              Audited in live Supabase PostgreSQL database
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
