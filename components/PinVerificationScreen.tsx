'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Lock,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Unlock,
  CheckCircle2,
} from 'lucide-react';

interface ShareInfo {
  title: string;
  workspaceName: string;
  clientName: string;
  driveLetter: string;
  color?: string;
  isSubfolderIsolated: boolean;
  folderName: string | null;
  requiresPin: boolean;
  allowDownload: boolean;
}

interface PinVerificationScreenProps {
  token: string;
  shareInfo: ShareInfo;
  onVerified: (sessionToken: string, updatedInfo: any) => void;
}

export const PinVerificationScreen: React.FC<PinVerificationScreenProps> = ({
  token,
  shareInfo,
  onVerified,
}) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Auto-focus first input on load
    inputRefs.current[0]?.focus();
  }, []);

  const handleDigitChange = (index: number, val: string) => {
    setError(null);
    const cleaned = val.replace(/\D/g, '');

    // Handle paste of full 6-digit code inside single input
    if (cleaned.length >= 6) {
      const newDigits = cleaned.slice(0, 6).split('');
      setDigits(newDigits);
      inputRefs.current[5]?.focus();
      triggerVerification(newDigits.join(''));
      return;
    }

    const singleDigit = cleaned.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = singleDigit;
    setDigits(newDigits);

    // Auto-advance to next input
    if (singleDigit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // If 6th digit entered, auto verify
    if (index === 5 && singleDigit) {
      const fullPin = newDigits.join('');
      if (fullPin.length === 6) {
        triggerVerification(fullPin);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setError(null);
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    if (pastedData.length >= 6) {
      const newDigits = pastedData.slice(0, 6).split('');
      setDigits(newDigits);
      inputRefs.current[5]?.focus();
      triggerVerification(newDigits.join(''));
    } else if (pastedData.length > 0) {
      const newDigits = [...digits];
      for (let i = 0; i < Math.min(pastedData.length, 6); i++) {
        newDigits[i] = pastedData[i];
      }
      setDigits(newDigits);
      const nextIndex = Math.min(pastedData.length, 5);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'Enter') {
      const fullPin = digits.join('');
      if (fullPin.length === 6) {
        triggerVerification(fullPin);
      }
    }
  };

  const triggerVerification = async (pinCode: string) => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/share/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinCode }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'رمز الأمان (PIN) غير صحيح');
      }

      onVerified(data.sessionToken, data.shareInfo);
    } catch (err: any) {
      setError(err.message || 'رمز الأمان (PIN) غير صحيح! يرجى التأكد والمحاولة مجدداً.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const isComplete = digits.every((d) => d !== '');

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden selection:bg-blue-500/30">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 -right-24 w-[450px] h-[450px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 -left-24 w-[450px] h-[450px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Glass Card */}
      <div
        className={`w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl shadow-2xl p-6 sm:p-9 relative z-10 text-center flex flex-col items-center transition-all ${
          shake ? 'animate-in shake duration-300 ring-2 ring-red-500/40' : ''
        }`}
      >
        {/* Glow Avatar Badge */}
        <div className="relative mb-5">
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-tr from-blue-600/20 via-blue-500/15 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-xl shadow-blue-500/10">
            <KeyRound size={30} className="stroke-[2.2]" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <ShieldCheck size={14} />
          </div>
        </div>

        {/* Link / Portfolio Title */}
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 mb-1.5 tracking-tight leading-snug">
          {shareInfo.title}
        </h1>

        {shareInfo.clientName && (
          <p className="text-xs font-medium text-slate-400 mb-4 flex items-center gap-1.5 justify-center">
            <span>العميل:</span>
            <span className="text-slate-300 font-semibold">{shareInfo.clientName}</span>
          </p>
        )}

        {/* Secure Encryption Tag */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-xs font-medium text-blue-300 mb-6">
          <Lock size={12} className="text-blue-400" />
          <span>محفظة أعمال مشفرة وآمنة برمز PIN</span>
        </div>

        {/* PIN Input Section */}
        <div className="w-full bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 sm:p-6 mb-6 shadow-inner">
          <div className="flex items-center justify-between mb-4">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Lock size={13} className="text-blue-400" />
              <span>أدخل رمز الأمان (6 أرقام)</span>
            </label>

            {/* Show / Hide Toggle */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 font-medium"
              tabIndex={-1}
            >
              {showPassword ? (
                <>
                  <EyeOff size={13} className="text-slate-400" />
                  <span>إخفاء الرمز</span>
                </>
              ) : (
                <>
                  <Eye size={13} className="text-blue-400" />
                  <span>إظهار الأرقام</span>
                </>
              )}
            </button>
          </div>

          {/* 6 High-End Styled Digit Boxes */}
          <div
            className="grid grid-cols-6 gap-2 sm:gap-2.5 mb-2"
            dir="ltr"
            onPaste={handlePaste}
          >
            {digits.map((digit, idx) => {
              const isFilled = digit !== '';
              return (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type={showPassword ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  disabled={loading}
                  className={`w-full h-14 sm:h-16 text-center text-2xl sm:text-3xl font-extrabold font-mono rounded-xl sm:rounded-2xl transition-all outline-none ${
                    isFilled
                      ? 'bg-blue-600/15 border-2 border-blue-500 text-blue-200 shadow-md shadow-blue-500/10'
                      : 'bg-slate-900 border border-slate-700/80 text-slate-200 hover:border-slate-600'
                  } focus:border-blue-400 focus:bg-slate-900 focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50`}
                />
              );
            })}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center justify-center gap-2 animate-in fade-in">
              <AlertCircle size={15} className="text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => triggerVerification(digits.join(''))}
          disabled={!isComplete || loading}
          className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/25 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 mb-6"
        >
          {loading ? (
            <>
              <RefreshCw size={17} className="animate-spin text-white" />
              <span>جاري التحقق وفك التشفير...</span>
            </>
          ) : (
            <>
              <Unlock size={17} />
              <span>فك التشفير واستعراض الملفات</span>
            </>
          )}
        </button>

        {/* Trust & Security Footer Watermark */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>تشفير آمن من طرف لآخر • منصة المحافظ السحابية</span>
        </div>
      </div>
    </div>
  );
};
