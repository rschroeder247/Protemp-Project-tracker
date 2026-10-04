'use client';

import React from 'react';
import { TaskNode, UserRole } from '@/lib/types';
import { ChevronDown, ChevronRight, Lock, Unlock, Check, Clock, User } from 'lucide-react';

interface TaskTreeProps {
  nodes: TaskNode[];
  role: UserRole;
  pendingTicks: Record<string, { doneByName: string; tickedAt: string }>;
  onToggleTick: (task: TaskNode, isChecked: boolean) => void;
  onChangeDoneBy: (taskId: string, name: string) => void;
  onUnlock: (task: TaskNode) => void;
  expandedIds: Set<string>;
  onToggleExpand: (nodeId: string) => void;
  searchQuery?: string;
}

function HighlightText({ text, query }: { text: string; query?: string }) {
  if (!query || !query.trim() || !text) return <>{text}</>;
  const q = query.trim();
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-amber-900/60 dark:text-amber-200 text-slate-900 rounded-xs px-0.5"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export const TaskTree: React.FC<TaskTreeProps> = ({
  nodes,
  role,
  pendingTicks,
  onToggleTick,
  onChangeDoneBy,
  onUnlock,
  expandedIds,
  onToggleExpand,
  searchQuery,
}) => {
  if (nodes.length === 0) {
    return (
      <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-xl p-8 text-center text-muted-light dark:text-muted-dark">
        <p className="text-sm font-medium">No tasks found</p>
        <p className="text-xs mt-1">Try adjusting your search query or selecting a different tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      {nodes.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          role={role}
          pendingTicks={pendingTicks}
          onToggleTick={onToggleTick}
          onChangeDoneBy={onChangeDoneBy}
          onUnlock={onUnlock}
          expandedIds={expandedIds}
          onToggleExpand={onToggleExpand}
          searchQuery={searchQuery}
        />
      ))}
    </div>
  );
};

interface TreeNodeItemProps {
  node: TaskNode;
  role: UserRole;
  pendingTicks: Record<string, { doneByName: string; tickedAt: string }>;
  onToggleTick: (task: TaskNode, isChecked: boolean) => void;
  onChangeDoneBy: (taskId: string, name: string) => void;
  onUnlock: (task: TaskNode) => void;
  expandedIds: Set<string>;
  onToggleExpand: (nodeId: string) => void;
  searchQuery?: string;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  role,
  pendingTicks,
  onToggleTick,
  onChangeDoneBy,
  onUnlock,
  expandedIds,
  onToggleExpand,
  searchQuery,
}) => {
  if (node.isSummary) {
    const isExpanded = expandedIds.has(node.id);
    const children = node.children || [];
    const leafChildren = children.filter((c) => !c.isSummary);
    const completedCount = leafChildren.filter(
      (c) => c.isLocked || !!pendingTicks[c.id]
    ).length;
    const totalCount = leafChildren.length;
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const hasPending = children.some((c) => !!pendingTicks[c.id]);

    return (
      <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-xl shadow-xs overflow-hidden transition-all">
        {/* Summary Card Header (Collapsible) */}
        <button
          onClick={() => onToggleExpand(node.id)}
          className="w-full text-left p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="mt-0.5 text-muted-light dark:text-muted-dark">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 transition-transform" />
              ) : (
                <ChevronRight className="w-4 h-4 transition-transform" />
              )}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-fg-light dark:text-fg-dark">
                  {node.wbs ? `${node.wbs} ` : ''}
                  <HighlightText text={node.name} query={searchQuery} />
                </span>
                {hasPending && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                    Unsaved
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-light dark:text-muted-dark mt-0.5 truncate">
                {totalCount} {totalCount === 1 ? 'task' : 'tasks'} &middot; {completedCount}/{totalCount} complete
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            <span className="font-mono text-xs font-bold text-fg-light dark:text-fg-dark">
              {pct}%
            </span>
          </div>
        </button>

        {/* Children (1 to 20+ tasks rendered cleanly) */}
        {isExpanded && children.length > 0 && (
          <div className="border-t border-line-light dark:border-line-dark divide-y divide-line-light/60 dark:divide-line-dark/60 bg-slate-50/50 dark:bg-slate-900/20">
            {children.map((child) => (
              <TreeNodeItem
                key={child.id}
                node={child}
                role={role}
                pendingTicks={pendingTicks}
                onToggleTick={onToggleTick}
                onChangeDoneBy={onChangeDoneBy}
                onUnlock={onUnlock}
                expandedIds={expandedIds}
                onToggleExpand={onToggleExpand}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Leaf Task Row (Actionable stage/subtask)
  const isPending = !!pendingTicks[node.id];
  const isLocked = !!node.isLocked;
  const isChecked = isLocked || isPending;
  const doneByName = isPending
    ? pendingTicks[node.id].doneByName
    : node.doneByName || '';

  return (
    <div className="p-3 pl-4 sm:pl-6 flex flex-col gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Tickbox / Lock state */}
          <button
            type="button"
            disabled={isLocked || role === 'viewer'}
            onClick={() => onToggleTick(node, !isChecked)}
            className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors flex-shrink-0 mt-0.5 ${
              isLocked
                ? 'bg-emerald-600 text-white cursor-default dark:bg-emerald-500'
                : isPending
                ? 'bg-accent-light text-white dark:bg-accent-dark dark:text-slate-900'
                : 'border-2 border-line-light dark:border-line-dark hover:border-accent-light dark:hover:border-accent-dark'
            }`}
          >
            {isLocked ? (
              <Check className="w-4 h-4 stroke-[2.5]" />
            ) : isPending ? (
              <Check className="w-4 h-4 stroke-[2.5]" />
            ) : null}
          </button>

          <div className="min-w-0">
            <p className="text-sm font-medium text-fg-light dark:text-fg-dark leading-snug">
              <HighlightText text={node.name} query={searchQuery} />
            </p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-light dark:text-muted-dark flex-wrap">
              {node.wbs && (
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                  WBS: <HighlightText text={node.wbs} query={searchQuery} />
                </span>
              )}
              {node.quotedHours > 0 && (
                <span className="font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {node.quotedHours.toFixed(1)} h quoted
                </span>
              )}
              {isLocked ? (
                <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Saved & locked
                </span>
              ) : isPending ? (
                <span className="text-blue-600 dark:text-blue-400">
                  Not saved yet
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Owner Unlock Action */}
        {isLocked && role === 'owner' && (
          <button
            type="button"
            onClick={() => onUnlock(node)}
            className="text-[11px] text-amber-600 hover:text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1 p-1"
          >
            <Unlock className="w-3 h-3" />
            Unlock
          </button>
        )}
      </div>

      {/* Done By Input / Display */}
      {isChecked && (
        <div className="ml-9 mt-1 flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-muted-light dark:text-muted-dark flex-shrink-0" />
          {isLocked ? (
            <span className="text-xs text-muted-light dark:text-muted-dark font-medium">
              Done by: <span className="text-fg-light dark:text-fg-dark">
                <HighlightText text={doneByName || 'Name not recorded'} query={searchQuery} />
              </span>
            </span>
          ) : (
            <input
              type="text"
              placeholder="Who did the work? (e.g. Lindani)"
              value={doneByName}
              onChange={(e) => onChangeDoneBy(node.id, e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-md border border-line-light dark:border-line-dark bg-surface-light dark:bg-surface-dark text-fg-light dark:text-fg-dark focus:outline-hidden focus:ring-1 focus:ring-accent-light dark:focus:ring-accent-dark w-full max-w-xs"
            />
          )}
        </div>
      )}
    </div>
  );
};
