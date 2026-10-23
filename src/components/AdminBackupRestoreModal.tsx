'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  Shield,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { parseCsvRows } from '@/lib/csvBackup';

interface AdminBackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess: () => Promise<void> | void;
  currentCompletedCount?: number;
  initialTab?: 'backup' | 'restore';
}

export function AdminBackupRestoreModal({
  isOpen,
  onClose,
  onRestoreSuccess,
  currentCompletedCount = 0,
  initialTab = 'backup',
}: AdminBackupRestoreModalProps) {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>(initialTab);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Restore states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<{
    totalRows: number;
    detectedTechs: string[];
    sampleTasks: string[];
  } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{
    success: boolean;
    message: string;
    restoredCount?: number;
    skippedCount?: number;
  } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Backup Download
  const handleDownloadBackup = async () => {
    setIsDownloading(true);
    setDownloadSuccess(false);
    try {
      const res = await fetch('/api/backup-progress');
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to download backup CSV');
      }

      const disposition = res.headers.get('content-disposition') || '';
      let filename = 'protemp_site_backup.csv';
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err: any) {
      alert(`Backup download failed: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle File Selected for Restore
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setRestoreResult(null);
    setRestoreError(null);

    try {
      const text = await file.text();
      const rows = parseCsvRows(text);

      if (rows.length === 0) {
        setRestoreError('The selected file has no data rows or invalid CSV formatting.');
        setFilePreview(null);
        return;
      }

      const techs = new Set<string>();
      const samples: string[] = [];

      for (const r of rows) {
        const tech = r.donebyname || r.done_by_name || r.doneby || r.technician;
        if (tech) techs.add(tech);
        const taskName = r.taskname || r.task_name || r.task;
        if (taskName && samples.length < 3) samples.push(taskName);
      }

      setFilePreview({
        totalRows: rows.length,
        detectedTechs: Array.from(techs).slice(0, 6),
        sampleTasks: samples,
      });
    } catch (err: any) {
      setRestoreError(`Failed to read CSV: ${err.message}`);
      setFilePreview(null);
    }
  };

  // Handle Restore Execution
  const handleExecuteRestore = async () => {
    if (!selectedFile) return;

    setIsRestoring(true);
    setRestoreError(null);
    setRestoreResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/backup-progress', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Restore failed on server');
      }

      setRestoreResult({
        success: true,
        message: data.message,
        restoredCount: data.restoredCount,
        skippedCount: data.skippedCount,
      });

      // Refresh parent tracker data
      await onRestoreSuccess();
    } catch (err: any) {
      setRestoreError(err.message || 'Error occurred while restoring progress');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-surface-light dark:bg-surface-dark border border-line-light dark:border-line-dark rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-line-light dark:border-line-dark flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-fg-light dark:text-fg-dark">
                  Backup &amp; Restore
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-muted-light dark:text-muted-dark">
                Export all site progress data to CSV or restore previous progress records.
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

        {/* Tab Toggle Navigation */}
        <div className="flex border-b border-line-light dark:border-line-dark bg-slate-100/60 dark:bg-slate-900/50 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-surface-light dark:bg-surface-dark text-fg-light dark:text-fg-dark shadow-xs border border-line-light dark:border-line-dark'
                : 'text-muted-light dark:text-muted-dark hover:text-fg-light'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-emerald-500" />
            <span>Backup to CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('restore')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'restore'
                ? 'bg-surface-light dark:bg-surface-dark text-fg-light dark:text-fg-dark shadow-xs border border-line-light dark:border-line-dark'
                : 'text-muted-light dark:text-muted-dark hover:text-fg-light'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-purple-500" />
            <span>Restore from CSV</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'backup' ? (
            /* BACKUP SECTION */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-line-light dark:border-line-dark space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-fg-light dark:text-fg-dark">
                    Current Database State:
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    {currentCompletedCount} Completed Stages
                  </span>
                </div>
                <p className="text-xs text-muted-light dark:text-muted-dark leading-relaxed">
                  The backup creates an archive of all recorded task completions. It includes Task IDs, WBS numbers, task names, subproject associations, technician names, and completion timestamps.
                </p>
                <div className="flex items-center gap-2 text-[11px] text-muted-light dark:text-muted-dark font-mono bg-surface-light dark:bg-surface-dark p-2 rounded-lg border border-line-light/50 dark:border-line-dark/50">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>Format: UTF-8 CSV (Compatible with Microsoft Excel &amp; Restore tool)</span>
                </div>
              </div>

              {downloadSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>Backup file downloaded successfully to your computer!</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={isDownloading}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-900/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDownloading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Preparing Backup CSV...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Full Backup (.csv)</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* RESTORE SECTION */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-900/30 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-purple-900 dark:text-purple-300">
                  <Shield className="w-4 h-4 text-purple-600" />
                  <span>Admin Database Restoration</span>
                </div>
                <p className="text-muted-light dark:text-muted-dark leading-relaxed">
                  Upload a previously saved Protemp backup CSV file. Any task progress present in the CSV will be safely updated in the live database.
                </p>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* File Drop / Selection Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-line-light dark:border-line-dark hover:border-purple-400 dark:hover:border-purple-600 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/20"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto mb-2">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-fg-light dark:text-fg-dark">
                  {selectedFile ? selectedFile.name : 'Click to select CSV backup file'}
                </p>
                <p className="text-[11px] text-muted-light dark:text-muted-dark mt-0.5">
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                    : 'Choose a .csv file exported from Protemp Project Tracker'}
                </p>
              </div>

              {/* File Preview */}
              {filePreview && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-line-light dark:border-line-dark space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-fg-light dark:text-fg-dark flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                      Valid Records Detected:
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {filePreview.totalRows} records
                    </span>
                  </div>
                  {filePreview.detectedTechs.length > 0 && (
                    <div className="text-[11px] text-muted-light dark:text-muted-dark">
                      <span className="font-medium text-fg-light dark:text-fg-dark">Technicians: </span>
                      {filePreview.detectedTechs.join(', ')}
                    </div>
                  )}
                  {filePreview.sampleTasks.length > 0 && (
                    <div className="text-[11px] text-muted-light dark:text-muted-dark truncate">
                      <span className="font-medium text-fg-light dark:text-fg-dark">Sample Tasks: </span>
                      {filePreview.sampleTasks.join(' &middot; ')}
                    </div>
                  )}
                </div>
              )}

              {restoreError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{restoreError}</span>
                </div>
              )}

              {restoreResult && (
                <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                  <div>
                    <p>{restoreResult.message}</p>
                    <p className="text-[11px] font-normal opacity-90 mt-0.5">
                      The tracker view and progress counts have been updated.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={!selectedFile || isRestoring || !filePreview}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md shadow-purple-900/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Restoring Records to Database...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>
                      {filePreview
                        ? `Confirm & Restore ${filePreview.totalRows} Records`
                        : 'Select File to Restore'}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line-light dark:border-line-dark flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/40">
          <span className="text-[11px] text-muted-light dark:text-muted-dark">
            Logged in as Roland (Admin)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-fg-light dark:text-fg-dark transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
