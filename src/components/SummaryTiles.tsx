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
  completedPanels?: number;
  totalPanels?: number;
}

export const SummaryTiles: React.FC<SummaryTilesProps> = ({
  completedItems,
  totalItems,
  completedStages,
  totalStages,
  workPct,
  earnedHours,
  quotedHours,
  completedPanels = 0,
  totalPanels = 0,
}) => {
  const stagePct = totalStages > 0 ? (completedStages / totalStages) * 100 : workPct;
  const hoursPct = quotedHours > 0 ? ((earnedHours / quotedHours) * 100).toFixed(1) : '0.0';

  return (
    <div className="max-w-3xl mx-auto px-4 py-3">
      {/* 2x2 Grid on Mobile, 4 columns on Desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Tile 1: Stages / Tasks Complete */}
        <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-xl p-3 shadow-xs">
          <p className="text-[11px] font-medium text-muted-light dark:text-muted-dark">Stages Complete</p>
          <p className="text-xl font-bold font-mono mt-0.5 text-fg-light dark:text-fg-dark">
            {completedStages} <span className="text-xs font-normal text-muted-light dark:text-muted-dark">/ {totalStages}</span>
          </p>
          <p className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5">
            {Math.round(stagePct)}% of total stages
          </p>
        </div>

        {/* Tile 2: Stage Progress (Physical site completion) */}
        <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-xl p-3 shadow-xs">
          <p className="text-[11px] font-medium text-muted-light dark:text-muted-dark">Stage Progress</p>
          <p className="text-xl font-bold font-mono mt-0.5 text-fg-light dark:text-fg-dark">
            {Math.round(stagePct)}%
          </p>
          <p className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5">
            Physical site progress
          </p>
        </div>

        {/* Tile 3: 100% Completed Panels / Units */}
        <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-xl p-3 shadow-xs">
          <p className="text-[11px] font-medium text-muted-light dark:text-muted-dark">
            {totalPanels > 0 ? 'Panels 100% Done' : 'Tasks Done'}
          </p>
          <p className="text-xl font-bold font-mono mt-0.5 text-fg-light dark:text-fg-dark">
            {totalPanels > 0 ? (
              <>
                {completedPanels} <span className="text-xs font-normal text-muted-light dark:text-muted-dark">/ {totalPanels}</span>
              </>
            ) : (
              <>
                {completedItems} <span className="text-xs font-normal text-muted-light dark:text-muted-dark">/ {totalItems}</span>
              </>
            )}
          </p>
          <p className="text-[10px] text-muted-light dark:text-muted-dark mt-0.5">
            {totalPanels > 0
              ? `${Math.round((completedPanels / totalPanels) * 100)}% fully finished`
              : `${Math.round(stagePct)}% finished`}
          </p>
        </div>

        {/* Tile 4: Quoted Labour Hours */}
        <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-xl p-3 shadow-xs">
          <p className="text-[11px] font-medium text-muted-light dark:text-muted-dark">Quoted Labour</p>
          <p className="text-xl font-bold font-mono mt-0.5 text-accent-light dark:text-accent-dark">
            {hoursPct}%
          </p>
          <p className="text-[10px] text-muted-light dark:text-muted-dark font-mono truncate mt-0.5">
            {earnedHours.toFixed(1)} / {quotedHours.toFixed(1)} h
          </p>
        </div>
      </div>

      {/* Progress Bar & Dual Metric Legend */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-light dark:text-muted-dark px-0.5">
          <span>
            Stage Progress: <strong className="text-fg-light dark:text-fg-dark">{Math.round(stagePct)}%</strong> ({completedStages}/{totalStages})
          </span>
          <span>
            Labour Hours: <strong className="text-accent-light dark:text-accent-dark">{hoursPct}%</strong> ({earnedHours.toFixed(1)}/{quotedHours.toFixed(1)}h)
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-accent-light dark:bg-accent-dark h-full transition-all duration-300 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, stagePct))}%` }}
          />
        </div>
      </div>
    </div>
  );
};
