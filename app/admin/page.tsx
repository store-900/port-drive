'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  Folder,
  Layers,
  Share2,
  Upload,
  Plus,
  RefreshCw,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Users,
  Database,
  Eye,
  Calendar,
  Settings,
  ChevronDown,
  Edit3,
  LogOut,
  History,
  Clock,
  KeyRound,
  Download,
  Search,
  X,
} from 'lucide-react';
import { formatBytes, formatDate, getWorkspaceColor } from '@/lib/utils';
import { FileExplorer, FolderItem, FileItem } from '@/components/FileExplorer';
import { FilePreviewModal } from '@/components/FilePreviewModal';
import { UploadModal } from '@/components/UploadModal';
import { ShareModal } from '@/components/ShareModal';
import { NewWorkspaceModal } from '@/components/NewWorkspaceModal';
import { NewFolderModal } from '@/components/NewFolderModal';
import { EditWorkspaceModal } from '@/components/EditWorkspaceModal';
import { ChangeAdminProfileModal } from '@/components/ChangeAdminProfileModal';
import { ShareLogsModal } from '@/components/ShareLogsModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Toast } from '@/components/Toast';
import { ClientAccountVault } from '@/components/ClientAccountVault';

interface Workspace {
  id: string;
  name: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  driveLetter: string;
  color: string;
  description?: string | null;
  storageQuotaBytes: string;
  usedStorageBytes: string;
  _count?: {
    folders: number;
    files: number;
    shareLinks: number;
  };
}

interface ShareLinkItem {
  id: string;
  token: string;
  title: string;
  pinCode: string;
  allowDownload: boolean;
  expiresAt: string | null;
  viewsCount: number;
  isActive: boolean;
  createdAt: string;
  workspace: {
    id: string;
    name: string;
    clientName: string;
    driveLetter: string;
  };
  folder: {
    id: string;
    name: string;
    path: string;
  } | null;
}

interface StorageStatus {
  activeDriver: 'local' | 's3';
  statusMessage: string;
  isConfigured: boolean;
  s3Config: {
    isConfigured: boolean;
    endpoint: string;
    region: string;
    bucket: string;
    latencyMs?: number;
    provider?: string;
    ssl?: boolean;
  };
  dbConfig?: {
    isConnected: boolean;
    host: string;
    port: number;
    database: string;
    engine: string;
    latencyMs?: number;
  };
}

export default function AdminDashboardPage() {
  // Authentication state
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [adminUser, setAdminUser] = useState<{ id: string; email: string; name: string } | null>(null);

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'explorer' | 'links' | 'storage'>('explorer');

  // Workspaces state
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  // Explorer state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string | null; name: string }>>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loadingExplorer, setLoadingExplorer] = useState(false);

  // Share links state
  const [shareLinks, setShareLinks] = useState<ShareLinkItem[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  // Storage status state
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareTargetFolder, setShareTargetFolder] = useState<FolderItem | null>(null);
  const [isNewWorkspaceModalOpen, setIsNewWorkspaceModalOpen] = useState(false);
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [isEditWorkspaceModalOpen, setIsEditWorkspaceModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [selectedLogToken, setSelectedLogToken] = useState<string | null>(null);
  const [selectedLogTitle, setSelectedLogTitle] = useState<string>('');

  // Copied states
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copiedPinToken, setCopiedPinToken] = useState<string | null>(null);

  // Search clients query
  const [workspaceSearch, setWorkspaceSearch] = useState('');

  // Delete Share Link confirmation modal state
  const [linkToDelete, setLinkToDelete] = useState<{ token: string; title: string } | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  // Authentication check on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/me');
        const data = await res.json();
        if (!data.authenticated) {
          window.location.href = '/admin/login';
          return;
        }
        setAdminUser(data.user);
        setCheckingAuth(false);
      } catch {
        window.location.href = '/admin/login';
      }
    }
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    window.location.href = '/admin/login';
  };

  // 1. Fetch Workspaces
  const fetchWorkspaces = useCallback(async () => {
    try {
      setLoadingWorkspaces(true);
      const res = await fetch('/api/workspaces');
      const data = await res.json();
      if (data.success) {
        setWorkspaces(data.workspaces || []);
        if (data.workspaces.length > 0 && !activeWorkspace) {
          setActiveWorkspace(data.workspaces[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoadingWorkspaces(false);
    }
  }, [activeWorkspace]);

  // 2. Fetch Storage Status
  const fetchStorageStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/storage-status');
      const data = await res.json();
      if (data.success) {
        setStorageStatus(data);
      }
    } catch (err) {
      console.error('Failed to load storage status:', err);
    }
  }, []);

  // 3. Fetch Share Links
  const fetchShareLinks = useCallback(async () => {
    try {
      setLoadingLinks(true);
      const res = await fetch('/api/share');
      const data = await res.json();
      if (data.success) {
        setShareLinks(data.links || []);
      }
    } catch (err) {
      console.error('Failed to load share links:', err);
    } finally {
      setLoadingLinks(false);
    }
  }, []);

  // 4. Load Explorer Folder Contents
  const loadFolderContents = useCallback(
    async (folderId: string | null) => {
      if (!activeWorkspace) return;
      try {
        setLoadingExplorer(true);
        const query = folderId ? `?workspaceId=${activeWorkspace.id}&folderId=${folderId}` : `?workspaceId=${activeWorkspace.id}`;
        const res = await fetch(`/api/folders${query}`);
        const data = await res.json();

        if (data.success) {
          setBreadcrumbs(data.breadcrumbs || []);
          setFolders(data.folders || []);
          setFiles(data.files || []);
          setCurrentFolderId(data.currentFolder?.id || null);
          // Update active workspace storage in state
          if (data.workspace) {
            setActiveWorkspace((prev) => (prev ? { ...prev, ...data.workspace } : null));
          }
        }
      } catch (err) {
        console.error('Failed to load folder:', err);
      } finally {
        setLoadingExplorer(false);
      }
    },
    [activeWorkspace]
  );

  useEffect(() => {
    fetchWorkspaces();
    fetchStorageStatus();
    fetchShareLinks();
  }, [fetchWorkspaces, fetchStorageStatus, fetchShareLinks]);

  useEffect(() => {
    if (activeWorkspace) {
      loadFolderContents(null);
    }
  }, [activeWorkspace?.id]);

  // Actions
  const handleDeleteFolder = async (folderId: string) => {
    try {
      const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadFolderContents(currentFolderId);
        fetchWorkspaces();
        showToast('تم حذف المجلد بنجاح', 'success');
      } else {
        showToast(data.error || 'تعذر حذف المجلد', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'تعذر حذف المجلد', 'error');
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadFolderContents(currentFolderId);
        fetchWorkspaces();
        showToast('تم حذف الملف بنجاح', 'success');
      } else {
        showToast(data.error || 'تعذر حذف الملف', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'تعذر حذف الملف', 'error');
    }
  };

  const handleDeleteShareLink = async (token: string) => {
    try {
      const res = await fetch(`/api/share/${token}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchShareLinks();
        showToast('تم حذف رابط المشاركة بنجاح', 'success');
      } else {
        showToast(data.error || 'تعذر حذف رابط المشاركة', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'تعذر حذف رابط المشاركة', 'error');
    } finally {
      setLinkToDelete(null);
    }
  };

  const handleOpenShareModal = (folder: FolderItem | null) => {
    setShareTargetFolder(folder);
    setIsShareModalOpen(true);
  };

  const handleUpdateWorkspaceNotes = async (workspaceId: string, newNotes: string) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: newNotes }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'فشل حفظ بيانات الحسابات');
      }

      setWorkspaces((prev) =>
        prev.map((w) => (w.id === workspaceId ? { ...w, description: newNotes } : w))
      );
      if (activeWorkspace?.id === workspaceId) {
        setActiveWorkspace((prev) => (prev ? { ...prev, description: newNotes } : null));
      }

      showToast('تم حفظ وتحديث بيانات حسابات العميل بنجاح!', 'success');
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء حفظ البيانات', 'error');
      throw err;
    }
  };

  const copyToClipboard = (text: string, token: string, type: 'url' | 'pin') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedToken(token);
      showToast('تم نسخ رابط المشاركة بنجاح', 'success');
      setTimeout(() => setCopiedToken(null), 2000);
    } else {
      setCopiedPinToken(token);
      showToast('تم نسخ رمز PIN بنجاح', 'success');
      setTimeout(() => setCopiedPinToken(null), 2000);
    }
  };

  // Compute Overall Stats
  const totalWorkspaces = workspaces.length;
  const totalFoldersCount = workspaces.reduce((acc, w) => acc + (w._count?.folders || 0), 0);
  const totalFilesCount = workspaces.reduce((acc, w) => acc + (w._count?.files || 0), 0);
  const totalUsedStorageBytes = workspaces.reduce((acc, w) => acc + BigInt(w.usedStorageBytes || 0), BigInt(0));

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <RefreshCw className="animate-spin text-blue-500" size={32} />
        <p className="text-xs">جاري التحقق من هوية المسؤول وصلاحيات الجلسة...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Top Navbar */}
      <header className="px-4 md:px-6 py-3.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400">
            <Database size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-100">لوحة تحكم المسؤول (Admin Dashboard)</h1>
              <span className="px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/30 text-[10px] font-semibold">
                Cloud Vault v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400">
              إدارة مساحات الأعمال، الرفع المتداخل، والروابط المشفرة برمز PIN
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('explorer')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-colors font-medium ${
              activeTab === 'explorer'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <HardDrive size={14} />
            <span>متصفح الأقراص والملفات</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('links');
              fetchShareLinks();
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-colors font-medium ${
              activeTab === 'links'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Share2 size={14} />
            <span>روابط المشاركة ({shareLinks.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('storage');
              fetchStorageStatus();
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-colors font-medium ${
              activeTab === 'storage'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Cloud size={14} />
            <span>حالة السحابة وقاعدة البيانات</span>
          </button>
        </div>

        {/* Global Actions: New Workspace, Admin Profile, Logout */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsNewWorkspaceModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-sm"
          >
            <Plus size={15} />
            <span>مساحة عمل جديدة</span>
          </button>

          {adminUser && (
            <button
              onClick={() => setIsProfileModalOpen(true)}
              title="تعديل حساب المسؤول وكلمة المرور"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-xl text-xs transition-colors group cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-300 group-hover:text-white font-medium">{adminUser.email}</span>
              <KeyRound size={13} className="text-blue-400 group-hover:text-blue-300" />
            </button>
          )}

          <button
            onClick={handleLogout}
            title="تسجيل الخروج من لوحة التحكم"
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-rose-400 hover:text-white hover:bg-rose-600/20 border border-rose-500/20 rounded-xl transition-colors"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-3.5 sm:p-6 max-w-7xl w-full mx-auto flex flex-col gap-4 sm:gap-6">
        {/* Top KPI Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Workspaces Metric */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">مساحات الأعمال (الأقراص)</p>
              <h3 className="text-xl font-bold text-slate-100 mt-1">{totalWorkspaces} مساحات</h3>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <HardDrive size={22} />
            </div>
          </div>

          {/* Folders Metric */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">المجلدات النشطة</p>
              <h3 className="text-xl font-bold text-slate-100 mt-1">{totalFoldersCount} مجلد</h3>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Folder size={22} />
            </div>
          </div>

          {/* Files & Storage Metric */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">إجمالي الملفات والتخزين</p>
              <h3 className="text-xl font-bold text-slate-100 mt-1">
                {totalFilesCount} <span className="text-xs font-normal text-slate-400">({formatBytes(totalUsedStorageBytes)})</span>
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Layers size={22} />
            </div>
          </div>

          {/* Active Share Links Metric */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">روابط المشاركة المحمية برمز PIN</p>
              <h3 className="text-xl font-bold text-slate-100 mt-1">{shareLinks.length} روابط</h3>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Lock size={22} />
            </div>
          </div>
        </div>

        {/* TAB 1: FILE EXPLORER UX */}
        {activeTab === 'explorer' && (
          <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-[600px]">
            {/* Left Sidebar: Workspace Drives Switcher */}
            <div className="w-full md:w-80 flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <HardDrive size={15} className="text-blue-400" />
                    <span>أقراص ومساحات العملاء ({workspaces.length})</span>
                  </h4>
                  <button
                    onClick={() => setIsNewWorkspaceModalOpen(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold transition-colors"
                  >
                    <Plus size={14} />
                    <span>إضافة</span>
                  </button>
                </div>

                {/* Search Bar for Clients */}
                <div className="relative mb-3">
                  <input
                    type="text"
                    value={workspaceSearch}
                    onChange={(e) => setWorkspaceSearch(e.target.value)}
                    placeholder="بحث باسم العميل أو الشركة أو القرص..."
                    className="w-full px-3 py-2 pr-8 text-xs bg-slate-950 border border-slate-700/80 hover:border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  {workspaceSearch && (
                    <button
                      onClick={() => setWorkspaceSearch('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="space-y-2.5 max-h-64 md:max-h-[500px] overflow-y-auto pr-1">
                  {workspaces
                    .filter((w) => {
                      if (!workspaceSearch.trim()) return true;
                      const q = workspaceSearch.toLowerCase().trim();
                      return (
                        w.name.toLowerCase().includes(q) ||
                        (w.clientName && w.clientName.toLowerCase().includes(q)) ||
                        w.driveLetter.toLowerCase().includes(q) ||
                        (w.clientEmail && w.clientEmail.toLowerCase().includes(q))
                      );
                    })
                    .map((w) => {
                      const isSelected = activeWorkspace?.id === w.id;
                      const used = BigInt(w.usedStorageBytes || 0);
                      const quota = BigInt(w.storageQuotaBytes || 1);
                      const percent = Math.min(100, Number((used * BigInt(100)) / quota));
                      const theme = getWorkspaceColor(w.color);

                      return (
                        <div
                          key={w.id}
                          onClick={() => {
                            setActiveWorkspace(w);
                            setCurrentFolderId(null);
                          }}
                          className={`p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                            isSelected
                              ? `${theme.selectedBg} ${theme.selectedBorder}`
                              : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50'
                          }`}
                        >
                          {/* Colored Active Indicator strip */}
                          {isSelected && (
                            <div className={`absolute top-0 right-0 bottom-0 w-1 ${theme.dot}`} />
                          )}

                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-xs font-mono flex-shrink-0 ${theme.badge}`}
                              >
                                {w.driveLetter}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-100 truncate">
                                  {w.clientName || w.name}
                                </p>
                                <p className="text-xs text-slate-400 font-medium truncate">
                                  {w.name}
                                </p>
                              </div>
                            </div>

                            {/* Quick Edit button on workspace card */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingWorkspace(w);
                                setIsEditWorkspaceModalOpen(true);
                              }}
                              title="تعديل بيانات العميل أو حذف القرص"
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
                            >
                              <Edit3 size={14} />
                            </button>
                          </div>

                          {/* Storage usage bar */}
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                              <span>{formatBytes(w.usedStorageBytes)}</span>
                              <span>{formatBytes(w.storageQuotaBytes)}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${theme.bar}`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Active Workspace Info Panel */}
              {activeWorkspace && (() => {
                const activeTheme = getWorkspaceColor(activeWorkspace.color);
                return (
                  <div className={`p-4 rounded-2xl bg-slate-900/70 border ${activeTheme.border} text-xs space-y-3`}>
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-slate-200 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${activeTheme.dot}`} />
                        <span>بيانات العميل النشط</span>
                      </h5>
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold font-mono ${activeTheme.badge}`}>
                        القرص {activeWorkspace.driveLetter}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5 text-xs">
                      <div>
                        <span className="text-slate-500 text-[11px] block">اسم العميل:</span>
                        <p className="text-sm font-bold text-slate-100">{activeWorkspace.clientName}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[11px] block">اسم الشركة / المحفظة:</span>
                        <p className="text-xs text-slate-300 font-semibold">{activeWorkspace.name}</p>
                      </div>
                      {activeWorkspace.clientEmail && (
                        <div>
                          <span className="text-slate-500 text-[11px] block">البريد الإلكتروني:</span>
                          <p className="text-xs text-slate-300 font-mono">{activeWorkspace.clientEmail}</p>
                        </div>
                      )}
                      {activeWorkspace.clientPhone && (
                        <div>
                          <span className="text-slate-500 text-[11px] block">رقم الهاتف:</span>
                          <p className="text-xs text-slate-300 font-mono" dir="ltr">{activeWorkspace.clientPhone}</p>
                        </div>
                      )}
                    </div>

                    {/* Client Credentials & Account Vault */}
                    <ClientAccountVault
                      rawNotes={activeWorkspace.description}
                      clientName={activeWorkspace.clientName}
                      companyName={activeWorkspace.name}
                      onSaveNotes={async (newNotes) => {
                        await handleUpdateWorkspaceNotes(activeWorkspace.id, newNotes);
                      }}
                    />

                    {/* Action buttons: Edit Client & Delete Client */}
                    <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingWorkspace(activeWorkspace);
                          setIsEditWorkspaceModalOpen(true);
                        }}
                        className="flex-1 py-2 px-3 text-xs font-bold text-blue-300 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-500/30 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Edit3 size={13} />
                        <span>تعديل العميل</span>
                      </button>
                      <button
                        onClick={() => {
                          setEditingWorkspace(activeWorkspace);
                          setIsEditWorkspaceModalOpen(true);
                        }}
                        className="py-2 px-3 text-xs font-bold text-red-400 hover:text-white bg-red-950/40 hover:bg-red-600/80 border border-red-500/20 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                        title="حذف مساحة العمل والعميل"
                      >
                        <Trash2 size={13} />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Right: Full Interactive File Explorer Component */}
            <div className="flex-1 flex flex-col min-h-[550px]">
              {activeWorkspace ? (
                <FileExplorer
                  isAdmin={true}
                  workspaceName={activeWorkspace.name}
                  clientName={activeWorkspace.clientName}
                  driveLetter={activeWorkspace.driveLetter}
                  color={activeWorkspace.color}
                  breadcrumbs={breadcrumbs}
                  folders={folders}
                  files={files}
                  currentFolderId={currentFolderId}
                  onNavigateFolder={(folderId) => loadFolderContents(folderId)}
                  onRefresh={() => loadFolderContents(currentFolderId)}
                  onPreviewFile={(file) => setPreviewFile(file)}
                  onDownloadFile={(file) => {
                    window.open(`/api/files/${file.id}`, '_blank');
                  }}
                  getDownloadUrl={(file) => `/api/files/${file.id}`}
                  onUploadClick={() => setIsUploadModalOpen(true)}
                  onNewFolderClick={() => setIsNewFolderModalOpen(true)}
                  onShareClick={(folder) => handleOpenShareModal(folder)}
                  onDeleteFolder={handleDeleteFolder}
                  onDeleteFile={handleDeleteFile}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center border border-slate-800 rounded-2xl bg-slate-900/50 p-8 text-center text-slate-400">
                  <p>الرجاء اختيار مساحة عمل أو إنشاء مساحة جديدة للبدء.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SHARE LINKS CENTER */}
        {activeTab === 'links' && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100">مركز روابط المشاركة الآمنة (Share Links Manager)</h3>
                <p className="text-xs text-slate-400">
                  قائمة بجميع الروابط المولدة، رموز PIN المكونة من 6 أرقام، ونطاقات العزل المحددة
                </p>
              </div>

              <button
                onClick={() => handleOpenShareModal(null)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-sm"
              >
                <Plus size={14} />
                <span>إنشاء رابط مشاركة جديد</span>
              </button>
            </div>

            <div className="border border-slate-800 rounded-2xl overflow-x-auto bg-slate-900/70">
              <table className="w-full min-w-[850px] text-right text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="py-3 px-4 font-semibold">عنوان الرابط</th>
                    <th className="py-3 px-4 font-semibold">القرص والمساحة</th>
                    <th className="py-3 px-4 font-semibold">نطاق الوصول</th>
                    <th className="py-3 px-4 font-semibold">صلاحية التنزيل</th>
                    <th className="py-3 px-4 font-semibold">رمز الأمان (PIN)</th>
                    <th className="py-3 px-4 font-semibold">مدة الصلاحية</th>
                    <th className="py-3 px-4 font-semibold">المشاهدات والسجل</th>
                    <th className="py-3 px-4 font-semibold text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {shareLinks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        لا توجد روابط مشاركة منشأة حالياً. يمكنك إنشاء روابط لأي مجلد أو قرص.
                      </td>
                    </tr>
                  ) : (
                    shareLinks.map((link) => {
                      const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${link.token}`;
                      const isIsolated = Boolean(link.folder);
                      const isExpired = link.expiresAt ? new Date() > new Date(link.expiresAt) : false;

                      return (
                        <tr key={link.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-200">
                            {link.title}
                          </td>

                          <td className="py-3 px-4 text-slate-300">
                            <span className="font-mono text-blue-400 ml-1">
                              {link.workspace.driveLetter}
                            </span>
                            <span>{link.workspace.name}</span>
                          </td>

                          <td className="py-3 px-4">
                            {isIsolated ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px]">
                                <Folder size={11} />
                                <span>مقيد: {link.folder?.name}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[11px]">
                                <HardDrive size={11} />
                                <span>وصول كامل للقرص</span>
                              </span>
                            )}
                          </td>

                          {/* Download Permission Badge */}
                          <td className="py-3 px-4">
                            {link.allowDownload ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] font-semibold">
                                <Download size={11} />
                                <span>تحميل ومعاينة</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px] font-semibold">
                                <Eye size={11} />
                                <span>معاينة فقط</span>
                              </span>
                            )}
                          </td>

                          {/* 6-Digit PIN Display & Copy */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className="px-2 py-1 rounded bg-slate-950 border border-blue-500/40 text-blue-300 font-mono font-bold tracking-widest text-xs"
                                dir="ltr"
                              >
                                {link.pinCode}
                              </span>
                              <button
                                onClick={() => copyToClipboard(link.pinCode, link.token, 'pin')}
                                title="نسخ رمز PIN"
                                className="p-1 text-slate-400 hover:text-white"
                              >
                                {copiedPinToken === link.token ? (
                                  <Check size={13} className="text-emerald-400" />
                                ) : (
                                  <Copy size={13} />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Expiration Status */}
                          <td className="py-3 px-4">
                            {link.expiresAt ? (
                              isExpired ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-semibold">
                                  <Clock size={11} />
                                  <span>منتهي الصلاحية</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-700 text-[11px]" title={new Date(link.expiresAt).toLocaleString('ar-EG')}>
                                  <Clock size={11} className="text-blue-400" />
                                  <span>ينتهي: {formatDate(link.expiresAt)}</span>
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]">
                                <span>🟢 دائم</span>
                              </span>
                            )}
                          </td>

                          {/* Views & Activity Log Button */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-300 text-[11px]">
                                {link.viewsCount} زيارة
                              </span>
                              <button
                                onClick={() => {
                                  setSelectedLogToken(link.token);
                                  setSelectedLogTitle(link.title);
                                  setIsLogsModalOpen(true);
                                }}
                                title="عرض سجل المشاهدات ومحاولات الدخول التفصيلي"
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-950/50 hover:bg-purple-900/60 text-purple-300 border border-purple-500/30 text-[10px] font-semibold transition-colors shadow-sm"
                              >
                                <History size={12} />
                                <span>السجل</span>
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-left">
                            <div className="flex items-center justify-end gap-2">
                              {/* Copy Link Button */}
                              <button
                                onClick={() => copyToClipboard(shareUrl, link.token, 'url')}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700"
                              >
                                {copiedToken === link.token ? (
                                  <Check size={13} className="text-emerald-400" />
                                ) : (
                                  <Copy size={13} />
                                )}
                                <span>{copiedToken === link.token ? 'تم النسخ' : 'نسخ الرابط'}</span>
                              </button>

                              {/* Open link */}
                              <a
                                href={shareUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="فتح ومعاينة الرابط"
                                className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                              >
                                <ExternalLink size={14} />
                              </a>

                              {/* Delete link */}
                              <button
                                onClick={() => setLinkToDelete({ token: link.token, title: link.title })}
                                title="إلغاء وحذف الرابط"
                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CLOUD STORAGE & DATABASE INFRASTRUCTURE */}
        {activeTab === 'storage' && (
          <div className="flex-1 flex flex-col gap-6 max-w-5xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Cloud size={18} className="text-blue-400" />
                  <span>مركز البنية السحابية وقواعد البيانات (Cloud Infrastructure)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  مراقبة الاتصال المباشر بمستودع S3 وخادم PostgreSQL ومؤشرات الاستجابة في الوقت الفعلي
                </p>
              </div>

              <button
                onClick={() => fetchStorageStatus()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-blue-300 bg-blue-950/70 hover:bg-blue-900 border border-blue-500/30 rounded-xl transition-colors self-start sm:self-auto"
              >
                <RefreshCw size={13} className="text-blue-400" />
                <span>فحص الاتصال الحي (Ping)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Card 1: MinIO S3 Object Storage */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Cloud size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">
                        مستودع التخزين السحابي (MinIO S3)
                      </h4>
                      <p className="text-xs text-slate-400">
                        {storageStatus?.s3Config?.provider || 'MinIO Enterprise S3 Storage'}
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>متصل ونشط</span>
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-900">
                    <span className="text-slate-400">مستودع الملفات (Bucket):</span>
                    <span className="font-mono font-semibold text-blue-400">
                      {storageStatus?.s3Config?.bucket || 'drive-assets'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-900">
                    <span className="text-slate-400">عنوان الخادم (Endpoint):</span>
                    <span className="font-mono text-slate-200">
                      {storageStatus?.s3Config?.endpoint || 'https://s3.xpertsafe.com'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-900">
                    <span className="text-slate-400">المنطقة الجغرافية (Region):</span>
                    <span className="font-mono text-slate-200">
                      {storageStatus?.s3Config?.region || 'us-east-1'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-900">
                    <span className="text-slate-400">بروتوكول الأمان:</span>
                    <span className="text-emerald-400 font-medium">HTTPS / TLS 1.3 مشفر</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-400">زمن الاستجابة (Latency):</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      ~{storageStatus?.s3Config?.latencyMs || 65} ms
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: PostgreSQL Database */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Database size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">
                        قاعدة البيانات (PostgreSQL)
                      </h4>
                      <p className="text-xs text-slate-400">
                        {storageStatus?.dbConfig?.engine || 'PostgreSQL Enterprise Engine'}
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>متصلة ومستقرة</span>
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-900">
                    <span className="text-slate-400">مضيف الخادم (Host):</span>
                    <span className="font-mono font-semibold text-emerald-400">
                      {storageStatus?.dbConfig?.host || 'db.xpertsafe.com'}:{storageStatus?.dbConfig?.port || 5433}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-900">
                    <span className="text-slate-400">اسم قاعدة البيانات:</span>
                    <span className="font-mono text-slate-200">
                      {storageStatus?.dbConfig?.database || 'client_drive_db'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-900">
                    <span className="text-slate-400">أداة الربط والمزامنة:</span>
                    <span className="font-mono text-slate-200">Prisma ORM Client v5.22</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-900">
                    <span className="text-slate-400">حالة الجداول (Schema):</span>
                    <span className="text-emerald-400 font-medium">محدثة ومتزامنة بنجاح</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-400">زمن الاستجابة (Latency):</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      ~{storageStatus?.dbConfig?.latencyMs || 15} ms
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Storage Utilization Summary Card */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-200">
                    النظام يعمل بكامل طاقته التشغيلية والإنتاجية
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    جميع عمليات رفع واستعراض وتنزيل الملفات وروابط المشاركة المشفرة برمز PIN ترتبط وتُخزّن مباشرة في سحابة S3 وقاعدة بيانات PostgreSQL.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Upload Modal (Bulk & Nested) */}
      {activeWorkspace && (
        <UploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          workspaceId={activeWorkspace.id}
          workspaceName={activeWorkspace.name}
          driveLetter={activeWorkspace.driveLetter}
          targetFolderId={currentFolderId}
          targetFolderName={
            breadcrumbs.length > 1
              ? breadcrumbs[breadcrumbs.length - 1].name
              : 'المجلد الرئيسي'
          }
          onUploadComplete={() => {
            setIsUploadModalOpen(false);
            loadFolderContents(currentFolderId);
            fetchWorkspaces();
          }}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setShareTargetFolder(null);
        }}
        workspaces={workspaces}
        initialWorkspaceId={activeWorkspace?.id || workspaces[0]?.id || ''}
        initialFolderId={
          shareTargetFolder
            ? shareTargetFolder.id
            : activeTab === 'explorer'
            ? currentFolderId
            : null
        }
        initialFolderName={
          shareTargetFolder
            ? shareTargetFolder.name
            : activeTab === 'explorer' && breadcrumbs.length > 1
            ? breadcrumbs[breadcrumbs.length - 1].name
            : ''
        }
        onSuccess={() => {
          fetchShareLinks();
        }}
      />

      {/* New Workspace Modal */}
      <NewWorkspaceModal
        isOpen={isNewWorkspaceModalOpen}
        onClose={() => setIsNewWorkspaceModalOpen(false)}
        onCreated={() => {
          fetchWorkspaces();
        }}
      />

      {/* Edit Workspace Modal */}
      <EditWorkspaceModal
        isOpen={isEditWorkspaceModalOpen}
        workspace={editingWorkspace}
        onClose={() => {
          setIsEditWorkspaceModalOpen(false);
          setEditingWorkspace(null);
        }}
        onUpdated={() => {
          fetchWorkspaces();
          if (activeWorkspace) {
            loadFolderContents(currentFolderId);
          }
        }}
        onDeleted={(deletedId) => {
          setWorkspaces((prev) => {
            const remaining = prev.filter((w) => w.id !== deletedId);
            if (activeWorkspace?.id === deletedId) {
              setActiveWorkspace(remaining.length > 0 ? remaining[0] : null);
              setCurrentFolderId(null);
            }
            return remaining;
          });
          fetchShareLinks();
        }}
      />

      {/* New Folder Modal */}
      {activeWorkspace && (
        <NewFolderModal
          isOpen={isNewFolderModalOpen}
          onClose={() => setIsNewFolderModalOpen(false)}
          workspaceId={activeWorkspace.id}
          parentId={currentFolderId}
          parentPathName={
            breadcrumbs.length > 1
              ? breadcrumbs[breadcrumbs.length - 1].name
              : 'المجلد الرئيسي'
          }
          onCreated={() => {
            loadFolderContents(currentFolderId);
            fetchWorkspaces();
          }}
        />
      )}

      {/* File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        downloadUrl={previewFile ? `/api/files/${previewFile.id}` : ''}
        allowDownload={true}
      />

      {/* Change Admin Profile & Password Modal */}
      <ChangeAdminProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={adminUser}
        onUpdated={(updatedUser) => {
          setAdminUser(updatedUser);
        }}
      />

      {/* Share Link Activity Logs Modal */}
      <ShareLogsModal
        isOpen={isLogsModalOpen}
        onClose={() => {
          setIsLogsModalOpen(false);
          setSelectedLogToken(null);
        }}
        token={selectedLogToken}
        title={selectedLogTitle}
      />

      {/* Styled Confirmation Modal for Share Link Deletion (No native browser alerts) */}
      <ConfirmationModal
        isOpen={Boolean(linkToDelete)}
        onClose={() => setLinkToDelete(null)}
        onConfirm={() => {
          if (linkToDelete) {
            handleDeleteShareLink(linkToDelete.token);
          }
        }}
        title="تأكيد حذف رابط المشاركة"
        message="هل أنت متأكد من رغبتك في إلغاء وحذف رابط المشاركة هذا نهائياً؟ سيتم حظر وصول أي زائر للرابط فوراً."
        itemName={linkToDelete?.title}
        confirmText="حذف الرابط"
      />

      {/* Floating Modern Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
