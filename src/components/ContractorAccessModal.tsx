'use client';

import React, { useState } from 'react';
import { X, Shield, Check, HardHat, AlertCircle } from 'lucide-react';
import { TaskNode } from '@/lib/types';

interface ContractorAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  subprojects: TaskNode[];
  initialAllowed: string[];
  onSaveAllowed: (newAllowed: string[]) => Promise<void>;
}

export function ContractorAccessModal({
  isOpen,
  onClose,
  subprojects,
  initialAllowed,
  onSaveAllowed,
}: ContractorAccessModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialAllowed)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(subprojects.map((sp) => sp.id)));
  };

  const handleClearAll = () => {
    setSelectedIds(new Set());
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onSaveAllowed(Array.from(selectedIds));
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-line-light dark:border-line-dark flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-fg-light dark:text-fg-dark">
                Contractor Subproject Access
              </h2>
              <p className="text-xs text-muted-light dark:text-muted-dark">
                Select which subprojects are visible to Contractor PIN logins
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

        {/* Content Body */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Quick Select Bar */}
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-muted-light dark:text-muted-dark font-medium">
              {selectedIds.size} of {subprojects.length} subprojects allowed
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-accent-light dark:text-accent-dark hover:underline font-semibold"
              >
                Select All
              </button>
              <span className="text-slate-400">&middot;</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-muted-light hover:text-fg-light dark:hover:text-fg-dark hover:underline font-medium"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Subproject Checkbox List */}
          <div className="space-y-2">
            {subprojects.map((sp) => {
              const isChecked = selectedIds.has(sp.id);
              return (
                <label
                  key={sp.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                    isChecked
                      ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-400/50 dark:border-amber-700/60 shadow-xs'
                      : 'bg-slate-50/50 dark:bg-slate-900/30 border-line-light dark:border-line-dark hover:bg-slate-100/50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle(sp.id)}
                    className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 dark:border-slate-700"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-fg-light dark:text-fg-dark">
                      {sp.name}
                    </p>
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
              <span>Contractor subproject permissions saved!</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-line-light dark:border-line-dark flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-900/40">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-muted-light dark:text-muted-dark hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Shield className="w-3.5 h-3.5" />
            {isSaving ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </div>
  );
}
