import React, { useState } from 'react';
import { Search, CheckCircle2, Trophy, AlertCircle, Wifi, MapPin, Calendar } from 'lucide-react';

export default function PublicCheck({ tickets }) {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);

  const cleanQuery = query.trim().toLowerCase();
  const matched = cleanQuery
    ? tickets.filter(
        (t) =>
          (t.receipt_number && t.receipt_number.toLowerCase().includes(cleanQuery)) ||
          (t.member_name && t.member_name.toLowerCase().includes(cleanQuery)) ||
          (t.phone_number && t.phone_number.toLowerCase().includes(cleanQuery))
      )
    : [];

  const handleSearch = (e) => {
    e.preventDefault();
    setSearched(true);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
          <Wifi className="w-3.5 h-3.5" />
          <span>PORTAL CEK NOMOR KUPON</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white">
          Cek Status Nomor Kupon Anda
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
          Pastikan nomor kupon Anda sudah terdaftar di dalam sistem undian resmi sebelum siaran langsung dimulai!
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative max-w-xl mx-auto">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearched(true);
            }}
            placeholder="Ketik Nomor Kupon Anda (contoh: 0001 atau 0421)..."
            className="w-full bg-slate-900 border-2 border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-2xl pl-12 pr-28 py-3.5 text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500 hover:from-blue-500 hover:to-amber-400 text-white font-bold text-xs sm:text-sm rounded-xl cursor-pointer"
          >
            Cari
          </button>
        </div>
      </form>

      {/* Results */}
      {searched && (
        <div className="space-y-4">
          {matched.length === 0 ? (
            <div className="text-center py-10 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-2 opacity-75" />
              <h3 className="text-base font-bold text-white mb-1">
                Nomor Kupon Tidak Ditemukan
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                Nomor "<span className="text-amber-300 font-semibold">{query}</span>" belum terdaftar di dalam sistem undian. Silakan hubungi admin untuk mendaftarkan nomor Anda.
              </p>
            </div>
          ) : (
            matched.map((ticket) => {
              const cleanNum = String(ticket.receipt_number || '').replace(/^MN-2026-/i, '');
              return (
                <div
                  key={ticket.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    ticket.status === 'won'
                      ? 'bg-emerald-950/40 border-emerald-500/50 shadow-xl shadow-emerald-900/20'
                      : 'bg-slate-900/90 border-slate-700/80 shadow-lg'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                        NOMOR KUPON RESMI
                      </span>
                      <span className="text-2xl sm:text-3xl font-black font-mono-num text-amber-300">
                        {cleanNum}
                      </span>
                    </div>

                    <div>
                      {ticket.status === 'won' ? (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
                          <Trophy className="w-4 h-4 text-emerald-400" />
                          <span>MENANG: {ticket.prize_won}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4 text-blue-400" />
                          <span>Resmi Terpasang di Roda Undian</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      <span>Terdaftar: {new Date(ticket.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</span>
                    </span>
                    <span className="text-slate-500 text-[11px]">Status: Terverifikasi Sistem</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
