'use client';

import React, { useState } from 'react';
import { X, HardDrive, Plus, Shield, Sparkles, Check, KeyRound } from 'lucide-react';

interface NewWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const NewWorkspaceModal: React.FC<NewWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [driveLetter, setDriveLetter] = useState('D:');
  const [color, setColor] = useState('blue');
  const [storageQuotaGB, setStorageQuotaGB] = useState('20');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          clientName,
          clientEmail,
          clientPhone,
          driveLetter,
          color,
          storageQuotaGB: parseInt(storageQuotaGB) || 20,
          description,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'تعذر إنشاء مساحة العمل');
      }

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الإنشاء');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <HardDrive size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                إنشاء مساحة أعمال جديدة (Workspace / Bucket)
              </h3>
              <p className="text-xs text-slate-400">
                تخصيص قرص تخزيني مستقل لكل عميل
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              اسم مساحة العمل / القرص *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: محفظة مجموعة الشايع القابضة"
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                اسم العميل أو جهة الأعمال *
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="مثال: م. فهد السبيعي"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                حرف القرص التخزيني (Drive Letter)
              </label>
              <select
                value={driveLetter}
                onChange={(e) => setDriveLetter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
              >
                {['C:', 'D:', 'E:', 'F:', 'G:', 'H:', 'Z:'].map((letter) => (
                  <option key={letter} value={letter}>
                    القرص ({letter})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                البريد الإلكتروني للعميل
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@company.com"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                المساحة المخصصة (بالجيجابايت GB)
              </label>
              <input
                type="number"
                min="1"
                max="5000"
                value={storageQuotaGB}
                onChange={(e) => setStorageQuotaGB(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Color theme */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              لون تمييز القرص
            </label>
            <div className="flex items-center gap-3">
              {[
                { name: 'blue', bg: 'bg-blue-500' },
                { name: 'emerald', bg: 'bg-emerald-500' },
                { name: 'purple', bg: 'bg-purple-500' },
                { name: 'amber', bg: 'bg-amber-500' },
                { name: 'rose', bg: 'bg-rose-500' },
                { name: 'indigo', bg: 'bg-indigo-500' },
              ].map((c) => (
                <button
                  type="button"
                  key={c.name}
                  onClick={() => setColor(c.name)}
                  className={`w-8 h-8 rounded-full ${c.bg} transition-all flex items-center justify-center ${
                    color === c.name
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110 shadow-lg'
                      : 'opacity-60 hover:opacity-100 hover:scale-105'
                  }`}
                >
                  {color === c.name && <Check size={14} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <KeyRound size={13} className="text-indigo-400" />
                <span>بيانات الحسابات والملاحظات (نوت باد العميل)</span>
              </label>
              <span className="text-[10px] text-slate-400">الصق من واتساب مباشرة</span>
            </div>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="الصق بيانات الحسابات من واتساب كما هي، مثلاً:&#10;نخبة الجمرة&#10;الرقم المميز : 3119606437&#10;كلمه المرور : Aa@123456&#10;الرقم المسجل : 0569036308&#10;رقم الهويه : 1193023585 سالم المهري&#10;الإقرارات : اقرار الربع الثالث غير مقدم"
              className="w-full p-3 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed resize-y"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              💡 سيتعرف النظام تلقائياً على الأرقام وكلمات المرور ويتيح نسخها بنقرة واحدة وإخفاء كلمات المرور بأمان.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 text-xs font-semibold text-slate-400 hover:text-white"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="py-2.5 px-6 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>{loading ? 'جاري الإنشاء...' : 'إنشاء مساحة العمل'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
