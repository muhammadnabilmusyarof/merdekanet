import React from 'react';
import { Trophy, Award, MapPin, Calendar, FileSpreadsheet, Sparkles } from 'lucide-react';

export default function WinnersList({ winners, onSwitchToStage }) {
  const handleExportWinners = () => {
    if (winners.length === 0) {
      alert('Belum ada pemenang yang tercatat!');
      return;
    }
    const headers = ['Nomor Nota', 'Nama Pemenang', 'Hadiah', 'No HP', 'Alamat/RT', 'Waktu Menang'];
    const rows = winners.map((w) => [
      `"${w.receipt_number}"`,
      `"${w.member_name}"`,
      `"${w.prize_name}"`,
      `"${w.phone_number || '-'}"`,
      `"${w.address_rt || '-'}"`,
      `"${new Date(w.won_at).toLocaleString('id-ID')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Daftar_Pemenang_Undian_Merdeka_Net_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold mb-2">
            <Trophy className="w-3.5 h-3.5" />
            <span>REKAPITULASI RESMI</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Daftar Pemenang Undian Merdeka Net
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Total pemenang sah yang telah berhasil diundi melalui siaran langsung TikTok Live.
          </p>
        </div>

        {winners.length > 0 && (
          <button
            onClick={handleExportWinners}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-900/40 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Unduh Laporan Pemenang (.CSV)</span>
          </button>
        )}
      </div>

      {/* Winners Cards or Empty State */}
      {winners.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/60 border border-slate-800 rounded-3xl p-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-400">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            Belum Ada Pemenang yang Diundi
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto mb-6">
            Proses pengundian live belum menghasilkan pemenang. Buka layar live untuk mulai mengacak nota pelanggan.
          </p>
          <button
            onClick={onSwitchToStage}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500 hover:from-blue-500 hover:to-amber-400 text-white font-bold text-sm rounded-xl cursor-pointer shadow-lg shadow-blue-900/30"
          >
            Buka Panggung Undian Live
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {winners.map((w, index) => (
            <div
              key={w.id || index}
              className="p-5 rounded-2xl bg-slate-900/90 border border-amber-500/30 hover:border-amber-400/60 transition-all shadow-xl relative overflow-hidden"
            >
              {/* Golden accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-300 to-blue-500"></div>

              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-sm shrink-0 border border-amber-500/30">
                    #{index + 1}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                      NOMOR KUPON PEMENANG
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono-num text-amber-300">
                      {String(w.receipt_number || '').replace(/^MN-2026-/i, '')}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-bold shadow-sm">
                    {w.prize_name}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Sah Terpilih di Roda Undian
                </span>
                <span className="flex items-center gap-1 text-slate-500 text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  {new Date(w.won_at).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
