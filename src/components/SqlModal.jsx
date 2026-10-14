import React, { useState } from 'react';
import { X, Copy, Check, Database, ExternalLink, Terminal, ShieldAlert } from 'lucide-react';
import { SUPABASE_SETUP_SQL } from '../lib/constants';

export default function SqlModal({ isOpen, onClose, isUsingSupabase, supabaseError, onRefresh }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative max-w-2xl w-full bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-7 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                Koneksi Database Supabase Realtime
              </h3>
              <p className="text-xs text-slate-400">
                Langkah 1x setup tabel di Supabase Dashboard
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Indicator */}
        <div className="my-4 p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isUsingSupabase ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            ></span>
            <span className="text-xs font-semibold text-slate-200">
              Status:{' '}
              {isUsingSupabase
                ? '✅ Terhubung Penuh ke Supabase Realtime!'
                : '⚠️ Tabel belum dibuat di Supabase (saat ini menggunakan mode Realtime Tab-Sync)'}
            </span>
          </div>

          <button
            onClick={onRefresh}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Cek Ulang Koneksi
          </button>
        </div>

        {/* Step-by-step instruction */}
        <div className="space-y-2 text-xs sm:text-sm text-slate-300">
          <p className="font-semibold text-white">Cara Mengaktifkan Database Supabase:</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-400 text-xs pl-1">
            <li>
              Buka link Dashboard Supabase Anda:{' '}
              <a
                href="https://supabase.com/dashboard/project/dbzouczghymsdsfkuvur"
                target="_blank"
                rel="noreferrer"
                className="text-rose-400 underline font-mono inline-flex items-center gap-1"
              >
                dbzouczghymsdsfkuvur.supabase.co <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>Klik menu <strong>SQL Editor</strong> di sidebar sebelah kiri.</li>
            <li>Klik <strong>New Query</strong>, lalu tempelkan (Paste) script SQL di bawah ini.</li>
            <li>Klik tombol hijau <strong>RUN</strong>. Setelah sukses, klik tombol "Cek Ulang Koneksi" di atas!</li>
          </ol>
        </div>

        {/* SQL Script Box */}
        <div className="mt-3 relative flex-1 min-h-[160px] max-h-[220px] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 font-mono">
              <Terminal className="w-3 h-3" /> setup_schema.sql
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin!' : 'Salin SQL'}</span>
            </button>
          </div>
          <pre className="p-3 text-[11px] font-mono text-emerald-400/90 overflow-y-auto flex-1 select-all whitespace-pre leading-relaxed">
            {SUPABASE_SETUP_SQL}
          </pre>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
          >
            Tutup
          </button>
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-900/40"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Berhasil Disalin!' : 'Salin Script SQL'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
