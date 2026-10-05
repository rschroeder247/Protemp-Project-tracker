'use client';

import React, { useState } from 'react';
import { AlertCircle, Lock, X } from 'lucide-react';

interface SaveBarProps {
  pendingCount: number;
  hasMissingNames: boolean;
  isSaving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

export const SaveBar: React.FC<SaveBarProps> = ({
  pendingCount,
  hasMissingNames,
  isSaving,
  onDiscard,
  onSave,
}) => {
  if (pendingCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface-light dark:bg-surface-dark border-t border-line-light dark:border-line-dark shadow-lg px-4 py-3">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {hasMissingNames ? (
            <div className="flex items-center gap-1.5 text-warn-light dark:text-warn-dark text-xs font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Enter a technician name for all ticked stages before saving</span>
            </div>
          ) : (
            <div className="text-xs font-semibold text-fg-light dark:text-fg-dark">
              <span className="font-mono text-accent-light dark:text-accent-dark text-sm">{pendingCount}</span> unsaved {pendingCount === 1 ? 'stage' : 'stages'} ready to lock
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            disabled={isSaving}
            onClick={onDiscard}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-light dark:text-muted-dark hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Discard
          </button>
          <button
            type="button"
            disabled={hasMissingNames || isSaving}
            onClick={onSave}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              hasMissingNames || isSaving
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            {isSaving ? 'Saving...' : 'Save and Lock'}
          </button>
        </div>
      </div>
    </div>
  );
};
