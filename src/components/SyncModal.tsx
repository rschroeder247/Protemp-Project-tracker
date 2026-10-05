'use client';

import React, { useState } from 'react';
import { RefreshCw, Cloud, Upload, Download, X, Check, AlertCircle } from 'lucide-react';
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
  const [isSyncingOneDrive, setIsSyncingOneDrive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleSyncFromOneDrive = async () => {
    setIsSyncingOneDrive(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/onedrive-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: 'Master Project.xml' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync from OneDrive');
      }

      let timeNote = '';
      if (data.lastModifiedDateTime) {
        const fileTime = new Date(data.lastModifiedDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        timeNote = ` (Saved: ${fileTime})`;
      }

      setStatusMessage({
        type: 'success',
        text: `Cloud sync complete! Fetched ${data.taskCount} tasks from "${data.fileName}"${timeNote}.`,
      });

      setTimeout(() => {
        onSyncComplete();
      }, 1500);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error syncing from OneDrive',
      });
    } finally {
      setIsSyncingOneDrive(false);
    }
  };

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
        text: `Successfully synced ${data.count} tasks from "${data.projectName}"!`,
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
            <Cloud className="w-5 h-5 text-accent-light dark:text-accent-dark" />
            <h3 className="font-bold text-base text-fg-light dark:text-fg-dark">
              MS Project &amp; OneDrive Cloud Sync
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-light dark:text-muted-dark hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Option A: Direct Cloud Sync from OneDrive */}
        <div className="bg-accent-light/5 dark:bg-accent-dark/10 border border-accent-light/20 dark:border-accent-dark/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-accent-light dark:text-accent-dark flex-shrink-0" />
            <p className="text-xs font-semibold text-fg-light dark:text-fg-dark">
              Direct OneDrive Cloud Sync (Multi-User)
            </p>
          </div>
          <p className="text-[11px] text-muted-light dark:text-muted-dark leading-relaxed">
            Pulls <span className="font-mono font-semibold">Master Project.xml</span> directly from your shared Protemp OneDrive in Microsoft 365, updating all subprojects and tasks.
          </p>
          <button
            type="button"
            disabled={isSyncingOneDrive}
            onClick={handleSyncFromOneDrive}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-accent-light hover:bg-accent-light/90 text-white dark:bg-accent-dark dark:text-slate-900 transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOneDrive ? 'animate-spin' : ''}`} />
            {isSyncingOneDrive ? 'Syncing from OneDrive...' : 'Sync from OneDrive Cloud Now'}
          </button>
        </div>

        {/* Option B: Manual File Upload */}
        <div className="space-y-2 pt-1 border-t border-line-light dark:border-line-dark">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-light dark:text-muted-dark">
            Or Manual File Upload
          </p>
          <div className="border border-dashed border-line-light dark:border-line-dark rounded-xl p-3 text-center hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <input
              type="file"
              id="file-upload"
              accept=".xml,.json"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4 text-accent-light dark:text-accent-dark" />
              <span className="text-xs font-medium text-fg-light dark:text-fg-dark">
                {file ? file.name : 'Choose Project XML or JSON file'}
              </span>
            </label>
          </div>

          {file && (
            <button
              type="button"
              disabled={isUploading}
              onClick={handleUpload}
              className="w-full py-2 px-4 rounded-xl text-xs font-semibold bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-3.5 h-3.5" />
              {isUploading ? 'Uploading...' : 'Upload Selected File'}
            </button>
          )}
        </div>

        {/* Section: Pull Site Progress -> MS Project */}
        <div className="space-y-1.5 pt-2 border-t border-line-light dark:border-line-dark">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-light dark:text-muted-dark">
            Pull Site Progress &rarr; MS Project
          </p>
          <a
            href="/api/export-progress?format=csv"
            download="site_progress_export.csv"
            className="w-full py-2 px-4 rounded-xl text-xs font-semibold border border-line-light dark:border-line-dark bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-fg-light dark:text-fg-dark flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download Progress Actuals CSV
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
