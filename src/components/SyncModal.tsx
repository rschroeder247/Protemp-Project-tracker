'use client';

import React, { useState } from 'react';
import { RefreshCw, Upload, Download, X, Check, AlertCircle } from 'lucide-react';
import { parseMsProjectXml } from '@/lib/msproject-xml';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatusMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setStatusMessage(null);

    try {
      const content = await file.text();
      let payload: any;

      if (file.name.endsWith('.xml') || content.trim().startsWith('<')) {
        const parsed = parseMsProjectXml(content);
        payload = {
          projectName: parsed.projectName,
          tasks: parsed.tasks,
        };
      } else {
        payload = JSON.parse(content);
      }

      const res = await fetch('/api/sync-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync project');
      }

      setStatusMessage({
        type: 'success',
        text: `Successfully synced ${data.count} tasks from "${data.projectName}" to Web Tracker!`,
      });

      setTimeout(() => {
        onSyncComplete();
      }, 1200);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error uploading file',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line-light dark:border-line-dark">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-accent-light dark:text-accent-dark" />
            <h3 className="font-bold text-base text-fg-light dark:text-fg-dark">
              MS Project Two-Way Sync
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-light dark:text-muted-dark hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Push MS Project -> Web Tracker */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-light dark:text-muted-dark">
            1. Push from MS Project &rarr; Web Tracker
          </p>
          <div className="border-2 border-dashed border-line-light dark:border-line-dark rounded-xl p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <input
              type="file"
              id="file-upload"
              accept=".xml,.json"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-1.5"
            >
              <Upload className="w-6 h-6 text-accent-light dark:text-accent-dark" />
              <span className="text-xs font-medium text-fg-light dark:text-fg-dark">
                {file ? file.name : 'Choose Project XML or JSON file'}
              </span>
              <span className="text-[11px] text-muted-light dark:text-muted-dark">
                In MS Project: File &rarr; Save As &rarr; XML (*.xml)
              </span>
            </label>
          </div>

          <button
            type="button"
            disabled={!file || isUploading}
            onClick={handleUpload}
            className={`w-full py-2 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
              !file || isUploading
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-accent-light hover:bg-accent-light/90 text-white dark:bg-accent-dark dark:text-slate-900'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUploading ? 'animate-spin' : ''}`} />
            {isUploading ? 'Syncing...' : 'Sync Tasks to Web Tracker'}
          </button>
        </div>

        {/* Section 2: Pull Site Progress -> MS Project */}
        <div className="space-y-2 pt-2 border-t border-line-light dark:border-line-dark">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-light dark:text-muted-dark">
            2. Pull Site Progress &rarr; MS Project
          </p>
          <p className="text-xs text-muted-light dark:text-muted-dark leading-relaxed">
            Download completed stage actuals and technician names, or use the 1-click VBA macro in Excel.
          </p>
          <a
            href="/api/export-progress?format=csv"
            download="site_progress_export.csv"
            className="w-full py-2 px-4 rounded-xl text-xs font-semibold border border-line-light dark:border-line-dark bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-fg-light dark:text-fg-dark flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download Progress CSV for MS Project
          </a>
        </div>

        {/* Status message */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <Check className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>
    </div>
  );
};
