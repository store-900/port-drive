'use client';

import React, { useState, useMemo } from 'react';
import {
  Folder,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  RotateCw,
  Search,
  LayoutGrid,
  List,
  Download,
  Share2,
  Trash2,
  Eye,
  HardDrive,
  FolderPlus,
  Upload,
  FolderUp,
  FileUp,
  CheckCircle2,
  Layers,
  Archive,
  Info,
  Calendar,
  RefreshCw,
  MoreVertical,
  X,
} from 'lucide-react';
import { formatBytes, formatDate } from '@/lib/utils';
import { FileIcon } from './FileIcon';
import { ConfirmationModal } from './ConfirmationModal';

export const WhatsAppIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 14,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.457h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.411z" />
  </svg>
);

export interface FolderItem {
  id: string;
  name: string;
  path: string;
  color?: string | null;
  _count?: {
    children: number;
    files: number;
  };
}

export interface FileItem {
  id: string;
  name: string;
  size: string | number;
  mimeType: string;
  extension: string;
  createdAt: string;
  storageDriver?: string;
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

interface FileExplorerProps {
  isAdmin?: boolean;
  workspaceName: string;
  clientName?: string;
  driveLetter: string;
  color?: string;
  breadcrumbs: BreadcrumbItem[];
  folders: FolderItem[];
  files: FileItem[];
  currentFolderId: string | null;
  onNavigateFolder: (folderId: string | null) => void;
  onRefresh: () => void;
  onPreviewFile: (file: FileItem) => void;
  onDownloadFile: (file: FileItem) => void;
  onDownloadZip?: () => void;
  getDownloadUrl?: (file: FileItem) => string;
  // Admin specific actions
  onUploadClick?: () => void;
  onNewFolderClick?: () => void;
  onShareClick?: (folder: FolderItem | null) => void;
  onDeleteFolder?: (folderId: string) => void;
  onDeleteFile?: (fileId: string) => void;
  allowDownload?: boolean;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  isAdmin = false,
  workspaceName,
  clientName,
  driveLetter,
  color = 'blue',
  breadcrumbs,
  folders,
  files,
  currentFolderId,
  onNavigateFolder,
  onRefresh,
  onPreviewFile,
  onDownloadFile,
  onDownloadZip,
  getDownloadUrl,
  onUploadClick,
  onNewFolderClick,
  onShareClick,
  onDeleteFolder,
  onDeleteFile,
  allowDownload = true,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [sharingFileId, setSharingFileId] = useState<string | null>(null);
  const [openMenuFileId, setOpenMenuFileId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'folder' | 'file';
    id: string;
    name: string;
  } | null>(null);

  const activeMenuFile = useMemo(() => {
    return openMenuFileId ? files.find((f) => f.id === openMenuFileId) || null : null;
  }, [openMenuFileId, files]);

  const driveColors: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
  };
  const activeDriveColor = driveColors[color] || driveColors.blue;

  // Share file to WhatsApp (native file share if mobile, direct wa.me fallback)
  const handleShareWhatsApp = async (file: FileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sharingFileId) return;

    setSharingFileId(file.id);

    try {
      const rawUrl = getDownloadUrl ? getDownloadUrl(file) : `/api/files/${file.id}`;
      const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${window.location.origin}${rawUrl}`;

      // 1. Mobile Web Share API: try downloading the blob and sharing the actual file into WhatsApp directly
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          const res = await fetch(rawUrl);
          if (res.ok) {
            const blob = await res.blob();
            const shareFile = new window.File([blob], file.name, {
              type: file.mimeType || 'application/octet-stream',
            });
            if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
              await navigator.share({
                files: [shareFile],
                title: file.name,
                text: `📄 ملف: ${file.name}`,
              });
              setSharingFileId(null);
              return;
            }
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            setSharingFileId(null);
            return;
          }
        }
      }

      // 2. Direct WhatsApp Web / App intent with clean data-only message
      const parts = [
        `📄 *الملف:* ${file.name}`,
        `📦 *الحجم:* ${formatBytes(file.size)}`,
      ];
      if (clientName) parts.push(`👤 *العميل:* ${clientName}`);
      if (workspaceName) parts.push(`🏢 *المحفظة:* ${workspaceName}`);
      parts.push(`🔗 *رابط التحميل المباشر:*`);
      parts.push(fullUrl);

      const message = parts.join('\n');

      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    } catch (err) {
      console.error('WhatsApp share error:', err);
    } finally {
      setSharingFileId(null);
    }
  };

  // Filter items by search query
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folders;
    return folders.filter((f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [folders, searchQuery]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    return files.filter((f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [files, searchQuery]);

  // Navigate up one level in breadcrumbs
  const handleNavigateUp = () => {
    if (breadcrumbs.length <= 1) return;
    const parentBreadcrumb = breadcrumbs[breadcrumbs.length - 2];
    onNavigateFolder(parentBreadcrumb.id);
  };

  const totalItemsCount = filteredFolders.length + filteredFiles.length;
  const totalFilesSizeBytes = files.reduce((acc, f) => acc + Number(f.size || 0), 0);

  return (
    <div className="flex flex-col h-full bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Top Address & Actions Bar */}
      <div className="p-2.5 sm:p-3 bg-slate-950/80 border-b border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 sm:gap-3">
        {/* Navigation buttons & Breadcrumbs address bar */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleNavigateUp}
              disabled={breadcrumbs.length <= 1}
              title="الانتقال للمجلد الأعلى"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ArrowUp size={15} />
            </button>
            <button
              onClick={onRefresh}
              title="تحديث المحتويات"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RotateCw size={15} />
            </button>
          </div>

          {/* Breadcrumb Trail Address Bar */}
          <div className="flex-1 flex items-center px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] sm:text-xs overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Root Icon / Drive Indicator */}
            {isAdmin ? (
              <span className={`flex items-center gap-1 sm:gap-1.5 font-bold flex-shrink-0 ml-1 px-1.5 sm:px-2 py-0.5 rounded-lg border text-[11px] sm:text-xs ${activeDriveColor}`}>
                <HardDrive size={12} />
                <span>القرص ({driveLetter})</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 sm:gap-1.5 font-bold text-blue-400 flex-shrink-0 ml-1 text-[11px] sm:text-xs">
                <Folder size={13} />
                <span>المجلد الرئيسي</span>
              </span>
            )}

            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              const displayName =
                idx === 0
                  ? isAdmin
                    ? crumb.name.replace(`${workspaceName} (${driveLetter})`, `القرص (${driveLetter})`)
                    : 'المجلد الرئيسي'
                  : crumb.name;

              return (
                <React.Fragment key={idx}>
                  <ChevronLeft size={13} className="text-slate-600 flex-shrink-0 mx-1" />
                  <button
                    onClick={() => onNavigateFolder(crumb.id)}
                    className={`font-medium transition-colors flex items-center gap-1 ${
                      isLast
                        ? 'text-slate-100 font-semibold cursor-default pointer-events-none'
                        : 'text-slate-400 hover:text-blue-400 cursor-pointer'
                    }`}
                  >
                    {displayName}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Search, View Mode, and Explorer Actions */}
        <div className="flex items-center justify-between md:justify-end gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
          {/* Quick Search */}
          <div className="relative flex-1 sm:w-44 md:w-48 sm:flex-initial min-w-[110px]">
            <Search
              size={13}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />
            <input
              type="text"
              placeholder="بحث في المجلد..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-2.5 pr-7 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded-xl flex-shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="عرض كأيقونات شبكية"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="عرض كقائمة مفصلة"
            >
              <List size={14} />
            </button>
          </div>

          {/* Actions group */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            {/* Download Entire Folder as ZIP */}
            {allowDownload && onDownloadZip && files.length > 0 && (
              <button
                onClick={onDownloadZip}
                className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors"
                title="تنزيل جميع ملفات هذا المجلد كأرشيف ZIP"
              >
                <Archive size={14} className="text-orange-400" />
                <span className="hidden md:inline">تحميل ZIP</span>
              </button>
            )}

            {/* Admin Specific Actions */}
            {isAdmin && (
              <>
                {onNewFolderClick && (
                  <button
                    onClick={onNewFolderClick}
                    title="مجلد جديد"
                    className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors"
                  >
                    <FolderPlus size={14} className="text-amber-400" />
                    <span className="hidden md:inline">مجلد جديد</span>
                  </button>
                )}

                {onUploadClick && (
                  <button
                    onClick={onUploadClick}
                    title="رفع محتويات"
                    className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-sm flex-shrink-0"
                  >
                    <Upload size={14} />
                    <span>رفع <span className="hidden sm:inline">محتويات</span></span>
                  </button>
                )}

                {onShareClick && (
                  <button
                    onClick={() => onShareClick(null)}
                    className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-600/40 rounded-xl transition-colors flex-shrink-0"
                    title="مشاركة هذا المجلد وإنشاء رمز PIN"
                  >
                    <Share2 size={14} />
                    <span className="hidden md:inline">مشاركة المجلد</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Files & Folders Viewport */}
      <div className="flex-1 overflow-y-auto p-5 relative">
        {/* Invisible backdrop to dismiss open dropdown menu */}
        {openMenuFileId && (
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpenMenuFileId(null)}
          />
        )}
        {totalItemsCount === 0 ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-500 mb-4">
              <Folder size={32} />
            </div>
            <h4 className="text-sm font-semibold text-slate-300 mb-1">هذا المجلد فارغ حالياً</h4>
            <p className="text-xs text-slate-500 max-w-sm">
              {searchQuery
                ? 'لم يتم العثور على أي نتائج مطابقة لكلمة البحث في هذا المجلد.'
                : isAdmin
                ? 'يمكنك البدء برفع مجلد كامل بهيكليته أو إنشاء مجلدات فرعية جديدة.'
                : 'لا توجد ملفات أو مجلدات فرعية متوفرة في هذا المسار.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View Mode */
          <div className="space-y-6">
            {/* Subfolders Section */}
            {filteredFolders.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Folder size={14} className="text-amber-400" />
                  <span>المجلدات ({filteredFolders.length})</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3.5">
                  {filteredFolders.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => onNavigateFolder(folder.id)}
                      className="group relative p-4 rounded-2xl bg-slate-950/70 hover:bg-slate-900 border border-slate-800/80 hover:border-blue-500/50 transition-all cursor-pointer flex items-center justify-between shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform flex-shrink-0">
                          <Folder size={24} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-xs sm:text-sm font-bold text-slate-200 group-hover:text-blue-300 transition-colors line-clamp-2 leading-snug break-words"
                            title={folder.name}
                          >
                            {folder.name}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1 font-medium flex items-center gap-1.5">
                            <span>{folder._count?.children || 0} مجلد</span>
                            <span className="text-slate-600">•</span>
                            <span>{folder._count?.files || 0} ملف</span>
                          </p>
                        </div>
                      </div>

                      {isAdmin && (
                        <div
                          className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0 mr-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {onShareClick && (
                            <button
                              onClick={() => onShareClick(folder)}
                              title="مشاركة هذا المجلد برمز PIN"
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <Share2 size={14} />
                            </button>
                          )}
                          {onDeleteFolder && (
                            <button
                              onClick={() => {
                                setDeleteTarget({
                                  type: 'folder',
                                  id: folder.id,
                                  name: folder.name,
                                });
                              }}
                              title="حذف المجلد"
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Files Section */}
            {filteredFiles.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Layers size={14} className="text-blue-400" />
                  <span>الملفات ({filteredFiles.length})</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5">
                  {filteredFiles.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => onPreviewFile(file)}
                      className="group relative p-3 sm:p-4 rounded-2xl bg-slate-950/70 hover:bg-slate-900 border border-slate-800/80 hover:border-blue-500/50 transition-all cursor-pointer flex flex-col items-center text-center shadow-sm hover:shadow-md"
                    >
                      {/* File Icon thumbnail */}
                      <div className="w-12 h-12 sm:w-13 sm:h-13 p-2 sm:p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-center mb-2 sm:mb-2.5 group-hover:scale-105 transition-transform shadow-inner">
                        <FileIcon extension={file.extension} mimeType={file.mimeType} size={26} />
                      </div>

                      {/* File Name */}
                      <p
                        className="text-xs font-semibold text-slate-200 group-hover:text-blue-300 w-full line-clamp-2 leading-snug break-words [overflow-wrap:anywhere] mb-1.5 min-h-[2.5rem] flex items-center justify-center text-center"
                        title={file.name}
                      >
                        {file.name}
                      </p>

                      {/* File Size */}
                      <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono">
                        {formatBytes(file.size)}
                      </span>

                      {/* 3-Dots Dropdown Menu Trigger */}
                      <div
                        className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 z-20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuFileId(openMenuFileId === file.id ? null : file.id);
                          }}
                          title="خيارات الملف"
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                            openMenuFileId === file.id
                              ? 'bg-slate-800 text-blue-400 border border-slate-700'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800/60 opacity-90 sm:opacity-0 sm:group-hover:opacity-100'
                          }`}
                        >
                          <MoreVertical size={15} />
                        </button>

                        {/* Dropdown Menu Popup (Desktop Only) */}
                        {openMenuFileId === file.id && (
                          <div
                            className="hidden sm:block absolute top-8 left-0 z-30 min-w-[170px] bg-slate-900/98 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-150 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Preview */}
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuFileId(null);
                                onPreviewFile(file);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-blue-400 hover:bg-slate-800/70 transition-colors text-right"
                            >
                              <Eye size={14} className="text-blue-400 flex-shrink-0" />
                              <span>معاينة الملف</span>
                            </button>

                            {/* Download */}
                            {allowDownload && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuFileId(null);
                                  onDownloadFile(file);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-sky-400 hover:bg-slate-800/70 transition-colors text-right"
                              >
                                <Download size={14} className="text-sky-400 flex-shrink-0" />
                                <span>تحميل الملف</span>
                              </button>
                            )}

                            {/* WhatsApp Share */}
                            <button
                              type="button"
                              onClick={(e) => {
                                setOpenMenuFileId(null);
                                handleShareWhatsApp(file, e);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 transition-colors text-right"
                            >
                              {sharingFileId === file.id ? (
                                <RefreshCw size={14} className="animate-spin text-emerald-400 flex-shrink-0" />
                              ) : (
                                <WhatsAppIcon size={14} className="text-emerald-400 flex-shrink-0" />
                              )}
                              <span>إرسال عبر واتساب</span>
                            </button>

                            {/* Delete (Admin only) */}
                            {isAdmin && onDeleteFile && (
                              <>
                                <div className="my-1 border-t border-slate-800" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuFileId(null);
                                    setDeleteTarget({
                                      type: 'file',
                                      id: file.id,
                                      name: file.name,
                                    });
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-right"
                                >
                                  <Trash2 size={14} className="text-red-400 flex-shrink-0" />
                                  <span>حذف الملف</span>
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* List View Mode (Details Table) */
          <div className="border border-slate-800/80 rounded-xl overflow-x-auto bg-slate-950/40">
            <table className="w-full min-w-[560px] text-right text-xs">
              <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">الاسم</th>
                  <th className="py-2.5 px-4 font-semibold w-28">النوع</th>
                  <th className="py-2.5 px-4 font-semibold w-28">الحجم</th>
                  <th className="py-2.5 px-4 font-semibold w-40">تاريخ الإضافة</th>
                  <th className="py-2.5 px-4 font-semibold w-24 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {/* Folders in list */}
                {filteredFolders.map((folder) => (
                  <tr
                    key={folder.id}
                    onClick={() => onNavigateFolder(folder.id)}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <Folder size={18} className="text-amber-400 flex-shrink-0" />
                        <span className="font-medium text-slate-200 group-hover:text-blue-400">
                          {folder.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400">مجلد ملفات</td>
                    <td className="py-2.5 px-4 text-slate-500 font-mono">
                      {folder._count?.files || 0} ملف
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">-</td>
                    <td className="py-2.5 px-4 text-left" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {isAdmin && onShareClick && (
                          <button
                            onClick={() => onShareClick(folder)}
                            title="مشاركة هذا المجلد برمز PIN"
                            className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                          >
                            <Share2 size={14} />
                          </button>
                        )}
                        {isAdmin && onDeleteFolder && (
                          <button
                            onClick={() => {
                              setDeleteTarget({
                                type: 'folder',
                                id: folder.id,
                                name: folder.name,
                              });
                            }}
                            title="حذف المجلد"
                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Files in list */}
                {filteredFiles.map((file) => (
                  <tr
                    key={file.id}
                    onClick={() => onPreviewFile(file)}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileIcon extension={file.extension} mimeType={file.mimeType} size={18} />
                        <span
                          className="font-medium text-slate-200 group-hover:text-blue-400 truncate max-w-xs sm:max-w-md md:max-w-lg inline-block"
                          title={file.name}
                        >
                          {file.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 font-mono uppercase">
                      {file.extension}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 font-mono">
                      {formatBytes(file.size)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">
                      {formatDate(file.createdAt)}
                    </td>
                    <td className="py-2.5 px-4 text-left" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onPreviewFile(file)}
                          title="معاينة"
                          className="p-1 text-slate-400 hover:text-blue-400"
                        >
                          <Eye size={14} />
                        </button>
                        {allowDownload && (
                          <button
                            type="button"
                            onClick={() => onDownloadFile(file)}
                            title="تحميل"
                            className="p-1 text-slate-400 hover:text-emerald-400"
                          >
                            <Download size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleShareWhatsApp(file, e)}
                          title="إرسال عبر واتساب"
                          disabled={sharingFileId === file.id}
                          className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/15 rounded transition-colors"
                        >
                          {sharingFileId === file.id ? (
                            <RefreshCw size={14} className="animate-spin text-emerald-400" />
                          ) : (
                            <WhatsAppIcon size={14} />
                          )}
                        </button>
                        {isAdmin && onDeleteFile && (
                          <button
                            onClick={() => {
                              setDeleteTarget({
                                type: 'file',
                                id: file.id,
                                name: file.name,
                              });
                            }}
                            title="حذف الملف"
                            className="p-1 text-slate-400 hover:text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Explorer Bottom Status Bar */}
      <div className="px-5 py-2.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span>{folders.length} مجلدات</span>
          <span>•</span>
          <span>{files.length} ملفات</span>
          <span>•</span>
          <span className="font-mono">إجمالي الحجم: {formatBytes(totalFilesSizeBytes)}</span>
        </div>

        <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
          <span>Drive: {driveLetter}</span>
        </div>
      </div>

      {/* Mobile Action Sheet (Bottom Drawer) */}
      {activeMenuFile && (
        <div className="fixed inset-0 z-50 sm:hidden flex flex-col justify-end">
          {/* Dark blur backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setOpenMenuFileId(null)}
          />
          {/* Drawer panel */}
          <div
            className="relative z-10 w-full bg-slate-900 border-t border-slate-700/80 rounded-t-3xl p-5 shadow-2xl animate-in slide-in-from-bottom duration-200 space-y-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto" />

            {/* File info */}
            <div className="flex items-center gap-3 p-3 bg-slate-950/80 border border-slate-800 rounded-2xl">
              <FileIcon extension={activeMenuFile.extension} mimeType={activeMenuFile.mimeType} size={30} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-100 break-words line-clamp-2" title={activeMenuFile.name}>
                  {activeMenuFile.name}
                </p>
                <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                  {formatBytes(activeMenuFile.size)}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpenMenuFileId(null);
                  onPreviewFile(activeMenuFile);
                }}
                className="w-full flex items-center gap-3 p-3 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors text-right"
              >
                <Eye size={16} className="text-blue-400 flex-shrink-0" />
                <span>معاينة الملف</span>
              </button>

              {allowDownload && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenuFileId(null);
                    onDownloadFile(activeMenuFile);
                  }}
                  className="w-full flex items-center gap-3 p-3 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors text-right"
                >
                  <Download size={16} className="text-sky-400 flex-shrink-0" />
                  <span>تحميل الملف</span>
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  setOpenMenuFileId(null);
                  handleShareWhatsApp(activeMenuFile, e);
                }}
                className="w-full flex items-center gap-3 p-3 text-xs font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-950/50 border border-emerald-500/30 rounded-xl transition-colors text-right"
              >
                {sharingFileId === activeMenuFile.id ? (
                  <RefreshCw size={16} className="animate-spin text-emerald-400 flex-shrink-0" />
                ) : (
                  <WhatsAppIcon size={16} className="text-emerald-400 flex-shrink-0" />
                )}
                <span>إرسال عبر واتساب</span>
              </button>

              {isAdmin && onDeleteFile && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenuFileId(null);
                    setDeleteTarget({
                      type: 'file',
                      id: activeMenuFile.id,
                      name: activeMenuFile.name,
                    });
                  }}
                  className="w-full flex items-center gap-3 p-3 text-xs font-semibold text-red-400 hover:text-red-300 bg-red-950/40 border border-red-500/20 rounded-xl transition-colors text-right"
                >
                  <Trash2 size={16} className="text-red-400 flex-shrink-0" />
                  <span>حذف الملف</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setOpenMenuFileId(null)}
              className="w-full py-2.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-950 border border-slate-800 rounded-xl transition-colors text-center"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Styled Confirmation Modal (No native browser popups) */}
      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'folder' && onDeleteFolder) {
            onDeleteFolder(deleteTarget.id);
          } else if (deleteTarget.type === 'file' && onDeleteFile) {
            onDeleteFile(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
        title={deleteTarget?.type === 'folder' ? 'تأكيد حذف المجلد' : 'تأكيد حذف الملف'}
        message={
          deleteTarget?.type === 'folder'
            ? `هل أنت متأكد من رغبتك في حذف المجلد وجميع الملفات والمجلدات الفرعية داخله نهائياً؟`
            : `هل أنت متأكد من رغبتك في حذف هذا الملف نهائياً من مساحة التخزين؟`
        }
        itemName={deleteTarget?.name}
        confirmText="حذف نهائي"
      />
    </div>
  );
};
