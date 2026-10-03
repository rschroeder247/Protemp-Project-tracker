'use client';

import React from 'react';

interface SummaryTilesProps {
  completedItems: number;
  totalItems: number;
  completedStages: number;
  totalStages: number;
  workPct: number;
  earnedHours: number;
  quotedHours: number;
}

export const SummaryTiles: React.FC<SummaryTilesProps> = ({
  completedItems,
  totalItems,
  completedStages,
  totalStages,
  workPct,
  earnedHours,
  quotedHours,
}) => {
  const hoursPct = quotedHours > 0 ? ((earnedHours / quotedHours) * 100).toFixed(1) : '0.0';

  return (
    <div className="max-w-3xl mx-auto px-4 py-3">
      {/* 2x2 Grid on Mobile, 4 columns on Desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-xl p-3 shadow-xs">
          <p className="text-[11px] font-medium text-muted-light dark:text-muted-dark">Tasks Complete</p>
          <p className="text-xl font-bold font-mono mt-0.5 text-fg-light dark:text-fg-dark">
            {completedItems} <span className="text-xs font-normal text-muted-light dark:text-muted-dark">/ {totalItems}</span>
          </p>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-xl p-3 shadow-xs">
          <p className="text-[11px] font-medium text-muted-light dark:text-muted-dark">Work Progress</p>
          <p className="text-xl font-bold font-mono mt-0.5 text-fg-light dark:text-fg-dark">
            {Math.round(workPct)}%
          </p>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-xl p-3 shadow-xs">
          <p className="text-[11px] font-medium text-muted-light dark:text-muted-dark">Stages Done</p>
          <p className="text-xl font-bold font-mono mt-0.5 text-fg-light dark:text-fg-dark">
            {completedStages} <span className="text-xs font-normal text-muted-light dark:text-muted-dark">/ {totalStages}</span>
          </p>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-xl p-3 shadow-xs">
          <p className="text-[11px] font-medium text-muted-light dark:text-muted-dark">Quoted Hours</p>
          <p className="text-xl font-bold font-mono mt-0.5 text-accent-light dark:text-accent-dark">
            {hoursPct}%
          </p>
          <p className="text-[10px] text-muted-light dark:text-muted-dark font-mono truncate">
            {earnedHours.toFixed(1)} / {quotedHours.toFixed(1)} h
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-accent-light dark:bg-accent-dark h-full transition-all duration-300 rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, Number(hoursPct)))}%` }}
        />
      </div>
    </div>
  );
};
