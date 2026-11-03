'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  HardDrive,
  Folder,
  Lock,
  LogOut,
  Download,
  Building2,
  FileText,
  AlertCircle,
  RotateCw,
  Archive,
  Clock,
} from 'lucide-react';
import { PinVerificationScreen } from '@/components/PinVerificationScreen';
import { FileExplorer, FolderItem, FileItem } from '@/components/FileExplorer';
import { FilePreviewModal } from '@/components/FilePreviewModal';

interface ShareInfo {
  title: string;
  workspaceName: string;
  clientName: string;
  driveLetter: string;
  color?: string;
  isSubfolderIsolated: boolean;
  permittedFolderId?: string | null;
  folderName: string | null;
  requiresPin: boolean;
  allowDownload: boolean;
}

export default function ClientShareViewerPage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;

  // States
  const [initialLoading, setInitialLoading] = useState(true);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Authentication & session
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Browser state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string | null; name: string }>>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loadingBrowse, setLoadingBrowse] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);

  // Preview modal
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  // 1. Initial check: fetch link metadata
  useEffect(() => {
    async function fetchLinkMeta() {
      try {
        setInitialLoading(true);
        const res = await fetch(`/api/share/${token}`);
        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || 'تعذر تحميل رابط المشاركة');
        }

        setShareInfo(data.shareInfo);

        // Check if there's already a saved session token in sessionStorage
        const savedSession = sessionStorage.getItem(`vault_session_${token}`);
        if (savedSession) {
          setSessionToken(savedSession);
        }
      } catch (err: any) {
        setLinkError(err.message || 'رابط المشاركة غير متاح');
      } finally {
        setInitialLoading(false);
      }
    }

    fetchLinkMeta();
  }, [token]);

  // 2. Fetch scoped folder contents
  const loadFolderContents = useCallback(
    async (folderId: string | null) => {
      if (!sessionToken) return;

      setLoadingBrowse(true);
      setBrowseError(null);

      try {
        const query = folderId ? `?folderId=${folderId}` : '';
        const res = await fetch(`/api/share/${token}/browse${query}`, {
          headers: {
            'x-share-session': sessionToken,
          },
        });

        const data = await res.json();
        if (!data.success) {
          if (res.status === 401) {
            // Session expired
            sessionStorage.removeItem(`vault_session_${token}`);
            setSessionToken(null);
            throw new Error('انتهت صلاحية جلسة الأمان. الرجاء إعادة إدخال رمز PIN.');
          }
          throw new Error(data.error || 'تعذر استعراض محتويات المجلد');
        }

        setBreadcrumbs(data.breadcrumbs || []);
        setFolders(data.folders || []);
        setFiles(data.files || []);
        setCurrentFolderId(data.currentFolder?.id || null);
      } catch (err: any) {
        setBrowseError(err.message || 'حدث خطأ أثناء تحميل البيانات');
      } finally {
        setLoadingBrowse(false);
      }
    },
    [token, sessionToken]
  );

  // Trigger browse when sessionToken is acquired or changes
  useEffect(() => {
    if (sessionToken) {
      loadFolderContents(null);
    }
  }, [sessionToken, loadFolderContents]);

  // Handle successful PIN verification
  const handlePinVerified = (newSessionToken: string, updatedInfo: any) => {
    sessionStorage.setItem(`vault_session_${token}`, newSessionToken);
    setSessionToken(newSessionToken);
    if (updatedInfo) {
      setShareInfo((prev) => (prev ? { ...prev, ...updatedInfo } : updatedInfo));
    }
  };

  // Logout / Lock session
  const handleLockSession = () => {
    sessionStorage.removeItem(`vault_session_${token}`);
    setSessionToken(null);
  };

  // Download File
  const handleDownloadFile = (file: FileItem) => {
    const downloadUrl = `/api/share/${token}/download/${file.id}?session=${encodeURIComponent(
      sessionToken || ''
    )}`;
    window.open(downloadUrl, '_blank');
  };

  // Download Folder ZIP
  const handleDownloadZip = () => {
    const query = currentFolderId ? `&folderId=${currentFolderId}` : '';
    const zipUrl = `/api/share/${token}/download-zip?session=${encodeURIComponent(
      sessionToken || ''
    )}${query}`;
    window.location.href = zipUrl;
  };

  // Preview file URL (always permits inline viewing)
  const getPreviewUrl = (file: FileItem | null) => {
    if (!file) return '';
    return `/api/share/${token}/download/${file.id}?session=${encodeURIComponent(
      sessionToken || ''
    )}&preview=true`;
  };

  // Direct download URL
  const getDirectDownloadUrl = (file: FileItem | null) => {
    if (!file) return '';
    return `/api/share/${token}/download/${file.id}?session=${encodeURIComponent(
      sessionToken || ''
    )}`;
  };

  // Loading state
  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">جاري التحقق من رابط المشاركة والاتصال بالسحابة...</p>
        </div>
      </div>
    );
  }

  // Error state (invalid, expired, revoked)
  if (linkError || !shareInfo) {
    const isExpired = linkError?.includes('صلاحية');

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
              isExpired
                ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
          >
            {isExpired ? <Clock size={32} /> : <AlertCircle size={32} />}
          </div>
          <h2 className="text-lg font-bold text-slate-100 mb-2">
            {isExpired ? 'انتهت صلاحية الرابط' : 'رابط غير متوفر'}
          </h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            {isExpired
              ? 'انتهت الفترة الزمنية المحددة للوصول إلى هذه المحفظة. يرجى التواصل مع المسؤول للحصول على رابط جديد.'
              : linkError || 'تعذر العثور على رابط المشاركة المطلوب، قد يكون الرابط خاطئاً أو تم حذفه.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-md"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  // Not authenticated: Show PIN Verification screen
  if (!sessionToken) {
    return (
      <PinVerificationScreen
        token={token}
        shareInfo={shareInfo}
        onVerified={handlePinVerified}
      />
    );
  }

  // Authenticated: Render Full Client Portfolio Viewer with File Explorer UX!
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Top Header Bar */}
      <header className="px-4 md:px-6 py-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-3 sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-blue-600/15 border border-blue-500/20 text-blue-400 flex-shrink-0">
            <Folder size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-100 truncate">{shareInfo.title}</h1>
            {shareInfo.clientName && (
              <p className="text-[11px] text-slate-400 truncate">
                {shareInfo.clientName}
              </p>
            )}
          </div>
        </div>

        {/* Lock / Exit Session */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleLockSession}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors shadow-sm"
            title="قفل المحفظة والخروج"
          >
            <Lock size={13} className="text-blue-400" />
            <span>قفل الجلسة</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Canvas */}
      <main className="flex-1 p-4 md:p-6 flex flex-col max-w-7xl w-full mx-auto">
        {browseError ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{browseError}</span>
            </div>
            <button
              onClick={() => loadFolderContents(currentFolderId)}
              className="px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : null}

        {/* File Explorer UX Component */}
        <div className="flex-1 flex flex-col min-h-[550px]">
          <FileExplorer
            isAdmin={false}
            workspaceName={shareInfo.workspaceName}
            clientName={shareInfo.clientName}
            driveLetter={shareInfo.driveLetter}
            breadcrumbs={breadcrumbs}
            folders={folders}
            files={files}
            currentFolderId={currentFolderId}
            onNavigateFolder={(folderId) => loadFolderContents(folderId)}
            onRefresh={() => loadFolderContents(currentFolderId)}
            onPreviewFile={(file) => setPreviewFile(file)}
            onDownloadFile={handleDownloadFile}
            onDownloadZip={shareInfo.allowDownload ? handleDownloadZip : undefined}
            allowDownload={shareInfo.allowDownload}
          />
        </div>
      </main>

      {/* File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        previewUrl={getPreviewUrl(previewFile)}
        downloadUrl={getDirectDownloadUrl(previewFile)}
        allowDownload={shareInfo.allowDownload}
      />
    </div>
  );
}
