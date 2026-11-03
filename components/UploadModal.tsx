'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FolderUp,
  FileUp,
  Folder,
  File,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Trash2,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { FileIcon } from './FileIcon';

interface StagedFile {
  file: File;
  relativePath: string;
  size: number;
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
  driveLetter: string;
  targetFolderId: string | null;
  targetFolderName: string;
  onUploadComplete: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  workspaceName,
  driveLetter,
  targetFolderId,
  targetFolderName,
  onUploadComplete,
}) => {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle single or multiple files selection
  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const staged: StagedFile[] = files.map((file) => ({
      file,
      relativePath: file.name,
      size: file.size,
    }));
    setStagedFiles((prev) => [...prev, ...staged]);
    e.target.value = '';
  };

  // Handle folder upload with webkitdirectory
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const staged: StagedFile[] = files.map((file) => ({
      file,
      relativePath: (file as any).webkitRelativePath || file.name,
      size: file.size,
    }));
    setStagedFiles((prev) => [...prev, ...staged]);
    e.target.value = '';
  };

  // Drag and drop handler with nested directory extraction
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const items = e.dataTransfer.items;
    if (!items) return;

    const filesQueue: StagedFile[] = [];

    // Recursive helper for scanning DataTransferItem
    const traverseEntry = async (entry: any, currentPath = '') => {
      if (entry.isFile) {
        const file: File = await new Promise((resolve) => entry.file(resolve));
        filesQueue.push({
          file,
          relativePath: currentPath ? `${currentPath}/${file.name}` : file.name,
          size: file.size,
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const readEntries = async (): Promise<any[]> => {
          return new Promise((resolve) => {
            dirReader.readEntries((entries: any[]) => resolve(entries));
          });
        };

        let entries: any[] = [];
        let batch: any[] = [];
        do {
          batch = await readEntries();
          entries = entries.concat(batch);
        } while (batch.length > 0);

        for (const childEntry of entries) {
          const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
          await traverseEntry(childEntry, nextPath);
        }
      }
    };

    const entriesToScan: any[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry) entriesToScan.push(entry);
      }
    }

    for (const entry of entriesToScan) {
      await traverseEntry(entry);
    }

    setStagedFiles((prev) => [...prev, ...filesQueue]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllStaged = () => {
    setStagedFiles([]);
    setErrorMessage(null);
    setSuccessCount(null);
  };

  // Perform bulk upload with Direct S3 Presigned Upload (bypasses Vercel 4.5MB limit)
  const handleStartUpload = async () => {
    if (stagedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(5);
    setErrorMessage(null);

    try {
      // 1. Request presigned upload plan
      const planRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'presign',
          workspaceId,
          targetFolderId,
          files: stagedFiles.map((item) => ({
            name: item.file.name,
            relativePath: item.relativePath,
            size: item.size,
            mimeType: item.file.type || 'application/octet-stream',
          })),
        }),
      });

      if (!planRes.ok) {
        const text = await planRes.text();
        throw new Error(text || `فشل إعداد خطة الرفع (كود: ${planRes.status})`);
      }

      const planData = await planRes.json();
      if (!planData.success) {
        throw new Error(planData.error || 'فشل في إعداد خطة الرفع');
      }

      // If S3 direct presigned upload is supported:
      if (planData.mode === 'presigned') {
        const totalFiles = stagedFiles.length;
        const uploadedSuccessList: any[] = [];

        for (let i = 0; i < totalFiles; i++) {
          const plan = planData.files[i];
          const staged = stagedFiles[i];

          // Direct PUT to S3 bypassing Vercel completely
          const s3Res = await fetch(plan.uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': plan.mimeType || 'application/octet-stream',
            },
            body: staged.file,
          });

          if (!s3Res.ok) {
            throw new Error(
              `فشل رفع الملف "${plan.originalName}" مباشرة إلى التخزين السحابي (كود: ${s3Res.status})`
            );
          }

          uploadedSuccessList.push({
            name: plan.cleanFileName,
            originalName: plan.originalName,
            storageKey: plan.storageKey,
            size: plan.size,
            mimeType: plan.mimeType,
            extension: plan.ext,
            folderId: plan.folderId,
          });

          const currentPct = Math.round(15 + ((i + 1) / totalFiles) * 75);
          setUploadProgress(currentPct);
        }

        // 2. Finalize and save file records in PostgreSQL
        const completeRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete',
            workspaceId,
            targetFolderId,
            uploadedFiles: uploadedSuccessList,
          }),
        });

        const completeData = await completeRes.json();
        if (!completeData.success) {
          throw new Error(completeData.error || 'فشل تسجيل الملفات في قاعدة البيانات');
        }

        setUploadProgress(100);
        setSuccessCount(uploadedSuccessList.length);
        setStagedFiles([]);

        setTimeout(() => {
          onUploadComplete();
          onClose();
        }, 1200);
        return;
      }

      // Fallback: Traditional FormData upload (for local driver)
      const formData = new FormData();
      formData.append('workspaceId', workspaceId);
      if (targetFolderId) {
        formData.append('targetFolderId', targetFolderId);
      }

      stagedFiles.forEach((item) => {
        formData.append('files', item.file);
        formData.append('paths', item.relativePath);
      });

      setUploadProgress(40);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(85);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `فشل الرفع عبر الخادم (كود: ${res.status})`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'فشل في رفع الملفات');
      }

      setUploadProgress(100);
      setSuccessCount(data.count || stagedFiles.length);
      setStagedFiles([]);

      setTimeout(() => {
        onUploadComplete();
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Upload error:', err);
      setErrorMessage(err.message || 'حدث خطأ غير متوقع أثناء الرفع');
    } finally {
      setIsUploading(false);
    }
  };

  const totalSize = stagedFiles.reduce((acc, curr) => acc + curr.size, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Upload size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                رفع الملفات والمجلدات المتداخلة (Bulk & Nested Upload)
              </h3>
              <p className="text-xs text-slate-400">
                الحفاظ على الشجرة الهيكلية والمجلدات الفرعية تلقائياً
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Boundary & Destination banner */}
        <div className="px-6 py-3 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-slate-500">الوجهة المقيدة:</span>
            <span className="font-semibold text-blue-400 flex items-center gap-1">
              <HardDrive size={13} />
              {driveLetter} {workspaceName}
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-300 flex items-center gap-1">
              <Folder size={13} className="text-amber-400" />
              {targetFolderName || 'المجلد الرئيسي'}
            </span>
          </div>

          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]">
            نطاق مؤمن (Safe Boundary)
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-3">
              <CheckCircle2 size={20} />
              <span>
                تم رفع {successCount} ملفاً بنجاح وحفظ كامل الهيكلية الشجرية للمجلدات!
              </span>
            </div>
          )}

          {/* Drag & Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-slate-700/80 hover:border-blue-500/60 rounded-2xl p-6 text-center bg-slate-950/40 hover:bg-slate-950/80 transition-all cursor-pointer flex flex-col items-center justify-center gap-3"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Upload size={28} />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-200">
                اسحب المجلدات أو الملفات وأفلتها هنا مباشرة
              </p>
              <p className="text-xs text-slate-400 mt-1">
                يدعم سحب مجلد رئيسي يضم مستويات متعددة من المجلدات الفرعية والملفات دفعة واحدة
              </p>
            </div>

            {/* Hidden file inputs */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={handleFilesSelect}
              className="hidden"
            />
            <input
              type="file"
              ref={folderInputRef}
              // @ts-ignore
              webkitdirectory=""
              directory=""
              onChange={handleFolderSelect}
              className="hidden"
            />

            {/* Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-md"
              >
                <FolderUp size={16} />
                <span>اختيار مجلد كامل (مع مجلداته الفرعية)</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700"
              >
                <FileUp size={16} />
                <span>اختيار ملفات منفردة</span>
              </button>
            </div>
          </div>

          {/* Staged files list */}
          {stagedFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  الملفات الجاهزة للرفع ({stagedFiles.length}) • الحجم الإجمالي: {formatBytes(totalSize)}
                </span>
                <button
                  type="button"
                  onClick={clearAllStaged}
                  className="text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  <Trash2 size={13} />
                  <span>تفريغ القائمة</span>
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70 divide-y divide-slate-800/60">
                {stagedFiles.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-900/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon extension={item.file.name.split('.').pop() || ''} size={18} />
                      <div className="min-w-0">
                        <p className="text-slate-200 truncate font-mono text-[11px]">
                          {item.relativePath}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-slate-500 text-[11px] font-mono">
                        {formatBytes(item.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeStagedFile(idx)}
                        className="text-slate-500 hover:text-red-400 p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {isUploading && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs text-slate-300">
                <span>جاري معالجة ورفع الملفات للسحابة...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {stagedFiles.length > 0 ? `${stagedFiles.length} ملف محدد` : 'لا توجد ملفات محددة'}
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="py-2 px-4 text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-50"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleStartUpload}
              disabled={isUploading || stagedFiles.length === 0}
              className="py-2.5 px-6 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              <Upload size={14} />
              <span>{isUploading ? 'جاري الرفع...' : `بدء الرفع (${stagedFiles.length} ملف)`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
