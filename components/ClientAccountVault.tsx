'use client';

import React, { useState, useMemo } from 'react';
import {
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  Edit3,
  FileText,
  Lock,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from 'lucide-react';
import { WhatsAppIcon } from './FileExplorer';

export interface ParsedAccountEntry {
  type: 'credential' | 'note' | 'header';
  label: string;
  value: string;
  isSecret: boolean;
}

export function parseAccountDetails(rawText: string | null | undefined): ParsedAccountEntry[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const entries: ParsedAccountEntry[] = [];

  for (const line of lines) {
    // Check for separator like : or ：
    const colonIndex = line.indexOf(':') !== -1 ? line.indexOf(':') : line.indexOf('：');

    if (colonIndex > 0) {
      const label = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      if (value) {
        const isSecret = /مرور|باسوورد|باسورد|password|pass|secret|رمز|pin/i.test(label);
        entries.push({
          type: 'credential',
          label,
          value,
          isSecret,
        });
      } else {
        entries.push({
          type: 'header',
          label,
          value: '',
          isSecret: false,
        });
      }
    } else {
      // General Note / Description line
      entries.push({
        type: 'note',
        label: '',
        value: line,
        isSecret: false,
      });
    }
  }

  return entries;
}

interface ClientAccountVaultProps {
  rawNotes: string | null | undefined;
  clientName: string;
  companyName?: string;
  onSaveNotes: (newNotes: string) => Promise<void>;
}

export const ClientAccountVault: React.FC<ClientAccountVaultProps> = ({
  rawNotes,
  clientName,
  companyName,
  onSaveNotes,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftNotes, setDraftNotes] = useState(rawNotes || '');
  const [saving, setSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [viewStyle, setViewStyle] = useState<'cards' | 'raw'>('cards');
  const [isExpanded, setIsExpanded] = useState(true);

  // Sync draft notes whenever rawNotes changes externally
  React.useEffect(() => {
    setDraftNotes(rawNotes || '');
  }, [rawNotes]);

  const parsedEntries = useMemo(() => parseAccountDetails(rawNotes), [rawNotes]);
  const hasContent = Boolean(rawNotes && rawNotes.trim().length > 0);

  const handleCopy = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === keyId ? null : prev));
    }, 2000);
  };

  const handleCopyAll = () => {
    if (!rawNotes) return;
    navigator.clipboard.writeText(rawNotes);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const toggleSecret = (idx: number) => {
    setRevealedSecrets((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveNotes(draftNotes.trim());
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleShareWhatsApp = () => {
    if (!rawNotes) return;
    const message = [
      `🔐 *بيانات الحسابات والاعتماد:*`,
      `👤 *العميل:* ${clientName}${companyName ? ` (${companyName})` : ''}`,
      '───────────────────',
      rawNotes,
      '───────────────────',
      '🔒 _سجل مشفر ومحفوظ بأمان_',
    ].join('\n');

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="rounded-xl bg-slate-950/80 border border-slate-800/90 overflow-hidden text-xs">
      {/* Header bar */}
      <div className="px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-2 cursor-pointer select-none flex-1"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
            <KeyRound size={13} />
          </div>
          <div>
            <h6 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
              <span>بيانات الحسابات والملاحظات</span>
              {hasContent && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              )}
            </h6>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {hasContent && !isEditing && (
            <>
              {/* WhatsApp Share */}
              <button
                type="button"
                onClick={handleShareWhatsApp}
                title="إرسال البيانات عبر واتساب"
                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <WhatsAppIcon size={13} />
              </button>

              {/* Copy All */}
              <button
                type="button"
                onClick={handleCopyAll}
                title="نسخ كامل البيانات"
                className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
              >
                {copiedAll ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>

              {/* View mode toggle (Cards vs Raw Text) */}
              <button
                type="button"
                onClick={() => setViewStyle(viewStyle === 'cards' ? 'raw' : 'cards')}
                title={viewStyle === 'cards' ? 'عرض كنص خام (نوت باد)' : 'عرض كبطاقات منظمة'}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <SlidersHorizontal size={13} />
              </button>
            </>
          )}

          {/* Quick Edit Button */}
          {!isEditing && (
            <button
              type="button"
              onClick={() => {
                setDraftNotes(rawNotes || '');
                setIsEditing(true);
                setIsExpanded(true);
              }}
              className="p-1.5 text-slate-400 hover:text-blue-300 hover:bg-slate-800 rounded-lg transition-colors"
              title="تعديل السجل"
            >
              <Edit3 size={13} />
            </button>
          )}

          {/* Expand / Collapse */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Body Section */}
      {isExpanded && (
        <div className="p-3">
          {isEditing ? (
            /* Editing / Notepad Mode */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">نوت باد العميل (الصق النص من واتساب مباشرة):</span>
                <span className="text-[10px] text-slate-500 font-mono">يدعم التنسيق التلقائي</span>
              </div>

              <textarea
                rows={7}
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                placeholder="الصق بيانات الحسابات من الواتساب هنا، مثلاً:&#10;نخبة الجمرة&#10;الرقم المميز : 3119606437&#10;كلمه المرور : Aa@123456&#10;الرقم المسجل : 0569036308&#10;رقم الهويه : 1193023585 سالم المهري&#10;الإقرارات : اقرار الربع الثالث غير مقدم"
                className="w-full p-3 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed resize-y selection:bg-indigo-600/30"
              />

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 px-3 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} />
                      <span>حفظ بيانات الحسابات</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  className="py-2 px-3 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : !hasContent ? (
            /* Empty State */
            <div className="py-4 px-2 text-center flex flex-col items-center">
              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-2">
                <FileText size={16} />
              </div>
              <p className="text-[11px] text-slate-400 mb-2.5">
                لا توجد بيانات حسابات أو ملاحظات مسجلة لهذا العميل.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDraftNotes('');
                  setIsEditing(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-semibold text-xs transition-colors"
              >
                <Plus size={13} />
                <span>+ إضافة بيانات وحسابات العميل</span>
              </button>
            </div>
          ) : viewStyle === 'raw' ? (
            /* Raw Text Notepad View */
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-200 leading-relaxed whitespace-pre-wrap select-text">
              {rawNotes}
            </div>
          ) : (
            /* Structured Key-Value & Notes Cards */
            <div className="space-y-1.5">
              {parsedEntries.map((entry, idx) => {
                if (entry.type === 'header') {
                  return (
                    <div
                      key={idx}
                      className="pt-2 pb-1 text-[11px] font-bold text-indigo-300 border-b border-slate-800/80 flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      <span>{entry.label}</span>
                    </div>
                  );
                }

                if (entry.type === 'note') {
                  return (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-slate-900/90 border border-slate-800/80 text-[11px] text-slate-300 font-medium leading-relaxed flex items-center justify-between gap-2 group"
                    >
                      <span>{entry.value}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(entry.value, `note-${idx}`)}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-200 transition-opacity p-0.5"
                        title="نسخ"
                      >
                        {copiedKey === `note-${idx}` ? (
                          <Check size={12} className="text-emerald-400" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  );
                }

                // Credential Row with Copy + Show/Hide
                const isRevealed = Boolean(revealedSecrets[idx]);
                const displayValue =
                  entry.isSecret && !isRevealed ? '••••••••' : entry.value;

                return (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-500 font-medium block truncate">
                        {entry.label}
                      </span>
                      <p
                        className={`text-xs font-mono font-semibold truncate ${
                          entry.isSecret && !isRevealed
                            ? 'tracking-widest text-slate-400'
                            : 'text-slate-100'
                        }`}
                        title={entry.value}
                      >
                        {displayValue}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {entry.isSecret && (
                        <button
                          type="button"
                          onClick={() => toggleSecret(idx)}
                          className="p-1 text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800"
                          title={isRevealed ? 'إخفاء' : 'إظهار كلمة المرور'}
                        >
                          {isRevealed ? <EyeOff size={13} /> : <Eye size={13} className="text-indigo-400" />}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCopy(entry.value, `entry-${idx}`)}
                        className="p-1 text-slate-400 hover:text-blue-400 transition-colors rounded-lg hover:bg-slate-800"
                        title="نسخ القيمة"
                      >
                        {copiedKey === `entry-${idx}` ? (
                          <Check size={13} className="text-emerald-400" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
