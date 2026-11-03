'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  FileCode,
  Calendar,
  HardDrive,
  Maximize2,
  File,
  RefreshCw,
} from 'lucide-react';
import { formatBytes, formatDate, getFileCategory } from '@/lib/utils';
import { FileIcon } from './FileIcon';
import { WhatsAppIcon } from './FileExplorer';

interface FileItem {
  id: string;
  name: string;
  size: string | number;
  mimeType: string;
  extension: string;
  createdAt: string;
  storageDriver?: string;
}

interface FilePreviewModalProps {
  file: FileItem | null;
  onClose: () => void;
  downloadUrl: string;
  previewUrl?: string;
  allowDownload?: boolean;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  onClose,
  downloadUrl,
  previewUrl,
  allowDownload = true,
}) => {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [sharingWa, setSharingWa] = useState(false);
  const viewUrl = previewUrl || downloadUrl;

  const handleWhatsAppShare = async () => {
    if (!file || sharingWa) return;
    setSharingWa(true);
    try {
      const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${window.location.origin}${downloadUrl}`;

      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          const res = await fetch(downloadUrl);
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
              setSharingWa(false);
              return;
            }
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            setSharingWa(false);
            return;
          }
        }
      }

      // Direct WhatsApp Web / App intent with clean data-only message
      const message = [
        `📄 *الملف:* ${file.name}`,
        `📦 *الحجم:* ${formatBytes(file.size)}`,
        `🔗 *رابط التحميل المباشر:*`,
        fullUrl,
      ].join('\n');

      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    } catch (err) {
      console.error('Error sharing to WhatsApp:', err);
    } finally {
      setSharingWa(false);
    }
  };

  useEffect(() => {
    if (!file) {
      setTextContent(null);
      return;
    }

    const category = getFileCategory(file.extension, file.mimeType);
    if (category === 'code' || file.extension === 'txt' || file.extension === 'json') {
      setLoadingText(true);
      fetch(viewUrl)
        .then((res) => res.text())
        .then((data) => {
          setTextContent(data);
          setLoadingText(false);
        })
        .catch(() => {
          setTextContent('تعذر تحميل محتوى الملف النصي للمعاينة.');
          setLoadingText(false);
        });
    } else {
      setTextContent(null);
    }
  }, [file, viewUrl]);

  if (!file) return null;

  const category = getFileCategory(file.extension, file.mimeType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3 min-w-0">
            <FileIcon extension={file.extension} mimeType={file.mimeType} size={28} />
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-100 truncate">{file.name}</h3>
              <p className="text-xs text-slate-400">
                {formatBytes(file.size)} • {file.extension.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleWhatsAppShare}
              disabled={sharingWa}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm"
              title="إرسال إلى واتساب"
            >
              {sharingWa ? (
                <RefreshCw size={14} className="animate-spin text-white" />
              ) : (
                <WhatsAppIcon size={14} />
              )}
              <span className="hidden sm:inline">إرسال واتساب</span>
            </button>

            {allowDownload && (
              <a
                href={downloadUrl}
                download={file.name}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-sm"
              >
                <Download size={14} />
                <span>تحميل الملف</span>
              </a>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-slate-950/60 min-h-[300px]">
          {category === 'image' && (
            <div className="max-w-full max-h-[60vh] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={viewUrl}
                alt={file.name}
                className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-lg border border-slate-800"
              />
            </div>
          )}

          {category === 'pdf' && (
            <div className="w-full h-[65vh]">
              <iframe
                src={`${viewUrl}#toolbar=0`}
                className="w-full h-full rounded-lg border border-slate-800 bg-white"
                title={file.name}
              />
            </div>
          )}

          {category === 'video' && (
            <div className="max-w-full">
              <video controls className="max-h-[60vh] max-w-full rounded-lg shadow-lg">
                <source src={viewUrl} type={file.mimeType} />
                متصفحك لا يدعم تشغيل هذا الفيديو.
              </video>
            </div>
          )}

          {category === 'audio' && (
            <div className="w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-400">
                <FileIcon extension="mp3" size={32} />
              </div>
              <p className="text-sm font-medium text-slate-200">{file.name}</p>
              <audio controls className="w-full">
                <source src={viewUrl} type={file.mimeType} />
                متصفحك لا يدعم تشغيل هذا الصوت.
              </audio>
            </div>
          )}

          {(category === 'code' || file.extension === 'txt' || file.extension === 'json') && (
            <div className="w-full h-[60vh] flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-slate-800/80 text-xs text-slate-400 font-mono border-b border-slate-700/60 flex items-center justify-between">
                <span>{file.name}</span>
                <span>{file.mimeType}</span>
              </div>
              <pre className="flex-1 p-4 font-mono text-xs text-slate-300 overflow-auto bg-slate-950/80 leading-relaxed whitespace-pre-wrap">
                {loadingText ? 'جاري قراءة محتوى الملف...' : textContent}
              </pre>
            </div>
          )}

          {category === 'archive' && (
            <div className="text-center p-8 max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                <FileIcon extension="zip" size={32} />
              </div>
              <h4 className="text-base font-semibold text-slate-200 mb-2">ملف مضغوط ({file.extension.toUpperCase()})</h4>
              <p className="text-xs text-slate-400 mb-6">
                هذا الملف عبارة عن أرشيف مضغوط، يمكنك تحميله واستخراج محتوياته على جهازك المحلي.
              </p>
              {allowDownload && (
                <a
                  href={downloadUrl}
                  download={file.name}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-md"
                >
                  <Download size={16} />
                  <span>تنزيل الأرشيف ({formatBytes(file.size)})</span>
                </a>
              )}
            </div>
          )}

          {category === 'document' && !['pdf', 'txt'].includes(file.extension) && (
            <div className="text-center p-8 max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <FileIcon extension={file.extension} size={32} />
              </div>
              <h4 className="text-base font-semibold text-slate-200 mb-2">مستند مكتبي ({file.extension.toUpperCase()})</h4>
              <p className="text-xs text-slate-400 mb-6">
                يمكنك تحميل هذا الملف لفتحه بواسطة برامج Office المتوافقة أو مستعرض المستندات على جهازك.
              </p>
              {allowDownload && (
                <a
                  href={downloadUrl}
                  download={file.name}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-md"
                >
                  <Download size={16} />
                  <span>تنزيل المستند ({formatBytes(file.size)})</span>
                </a>
              )}
            </div>
          )}

          {category === 'other' && (
            <div className="text-center p-8 max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400">
                <File size={32} />
              </div>
              <h4 className="text-base font-semibold text-slate-200 mb-2">{file.name}</h4>
              <p className="text-xs text-slate-400 mb-6">
                لا تتوفر معاينة مباشرة لهذا النوع من الملفات ({file.mimeType}).
              </p>
              {allowDownload && (
                <a
                  href={downloadUrl}
                  download={file.name}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-md"
                >
                  <Download size={16} />
                  <span>تحميل الملف ({formatBytes(file.size)})</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <HardDrive size={13} className="text-slate-500" />
              <span>الحجم: {formatBytes(file.size)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-500" />
              <span>تاريخ الإضافة: {formatDate(file.createdAt)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
