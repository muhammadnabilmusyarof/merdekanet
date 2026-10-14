import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  Search,
  Trash2,
  Sparkles,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  Hash,
  Layers,
  ArrowRight,
  Play,
  Square,
  ChevronDown,
  ExternalLink,
  Radio,
  Trophy,
  RotateCcw
} from 'lucide-react';
import { sound } from '../lib/audio';
import { broadcastSpinCommand, subscribeSpinCommands } from '../lib/spinSync';

function getNextTicketNumber(ticketList) {
  let maxNum = 0;
  if (Array.isArray(ticketList)) {
    ticketList.forEach((t) => {
      const numStr = String(t.receipt_number || '').replace(/^MN-2026-/i, '');
      const match = numStr.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
  }
  return String(maxNum + 1).padStart(4, '0');
}

export default function AdminInput({
  tickets,
  prizes = [],
  selectedPrize,
  setSelectedPrize,
  onMarkWinner,
  onAddTicket,
  onDeleteTicket,
  onResetAll,
  onPopulateDemo,
  onPopulateRange,
  isUsingSupabase
}) {
  const [singleNumber, setSingleNumber] = useState('');
  const [rangeStart, setRangeStart] = useState('1');
  const [rangeEnd, setRangeEnd] = useState('759');
  const [isRangeOpen, setIsRangeOpen] = useState(false);

  // Live remote wheel spin state
  const [isRolling, setIsRolling] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [lockedWinner, setLockedWinner] = useState(null);

  // Eligible tickets for drawing
  const eligibleTickets = tickets.filter((t) => t.status === 'eligible');

  // Track prize quota usage
  const getPrizeWonCount = (prizeName) => {
    return tickets.filter((t) => t.status === 'won' && t.prize_won === prizeName).length;
  };

  // Realtime subscription in Admin to stay in sync with public wheel and commands
  useEffect(() => {
    const unsubscribe = subscribeSpinCommands((cmd) => {
      if (cmd.type === 'START_SPIN') {
        setIsRolling(true);
        setIsStopping(false);
        setLockedWinner(null);
        if (cmd.prizeId && prizes && setSelectedPrize) {
          const found = prizes.find((p) => p.id === cmd.prizeId);
          if (found) setSelectedPrize(found);
        }
      } else if (cmd.type === 'STOP_SPIN') {
        setIsStopping(true);
        const wTicket = tickets.find((t) => t.id === cmd.winnerId);
        // Sync when deceleration completes on screen (~6.5s)
        setTimeout(() => {
          setIsRolling(false);
          setIsStopping(false);
          if (wTicket) {
            setLockedWinner(wTicket);
          }
        }, 6700);
      } else if (cmd.type === 'CONFIRM_WINNER' || cmd.type === 'CANCEL_WINNER') {
        setIsRolling(false);
        setIsStopping(false);
        setLockedWinner(null);
      } else if (cmd.type === 'SELECT_PRIZE') {
        if (cmd.prizeId && prizes && setSelectedPrize) {
          const found = prizes.find((p) => p.id === cmd.prizeId);
          if (found) setSelectedPrize(found);
        }
      }
    });

    return () => unsubscribe();
  }, [prizes, setSelectedPrize, tickets]);

  // Admin Start Spin Handler
  const handleAdminStartSpin = () => {
    if (eligibleTickets.length === 0) {
      alert('Belum ada nomor kupon yang layak diundi! Silakan masukkan nomor kupon terlebih dahulu.');
      return;
    }

    const wonCount = getPrizeWonCount(selectedPrize?.name);
    if (selectedPrize?.quota && wonCount >= selectedPrize.quota) {
      const confirmExceed = window.confirm(
        `Perhatian: Kuota hadiah "${selectedPrize.name}" sudah terpenuhi (${wonCount}/${selectedPrize.quota} pemenang)!\n\nApakah Anda tetap ingin mengundi hadiah ini lagi?`
      );
      if (!confirmExceed) return;
    }

    setLockedWinner(null);
    setIsRolling(true);
    setIsStopping(false);
    sound.playLeverPull();

    broadcastSpinCommand({
      type: 'START_SPIN',
      prizeId: selectedPrize?.id,
    });
  };

  // Admin Stop Spin Handler
  const handleAdminStopSpin = () => {
    if (!isRolling || isStopping) return;
    setIsStopping(true);

    const chosenWinner = eligibleTickets[Math.floor(Math.random() * eligibleTickets.length)];
    if (!chosenWinner) return;

    broadcastSpinCommand({
      type: 'STOP_SPIN',
      winnerId: chosenWinner.id,
    });

    setTimeout(() => {
      setIsRolling(false);
      setIsStopping(false);
      setLockedWinner(chosenWinner);
    }, 6700);
  };

  // Admin Confirm Winner
  const handleAdminConfirmWinner = () => {
    if (!lockedWinner || !onMarkWinner) return;
    broadcastSpinCommand({
      type: 'CONFIRM_WINNER',
      winnerId: lockedWinner.id,
      prizeName: selectedPrize?.name,
    });
    onMarkWinner(lockedWinner, selectedPrize?.name);
    setLockedWinner(null);
  };

  // Admin Cancel Winner
  const handleAdminCancelWinner = () => {
    broadcastSpinCommand({ type: 'CANCEL_WINNER' });
    setLockedWinner(null);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState(null);

  // Synchronize suggested next number
  useEffect(() => {
    if (!singleNumber) {
      setSingleNumber(getNextTicketNumber(tickets));
    }
  }, [tickets]);

  // Handle single number submit
  const handleAddSingle = async (e) => {
    e.preventDefault();
    const cleanNum = singleNumber.trim().replace(/^MN-2026-/i, '');
    if (!cleanNum) {
      alert('Silakan masukkan nomor kupon!');
      return;
    }

    const paddedNum = cleanNum.length <= 4 && /^\d+$/.test(cleanNum)
      ? cleanNum.padStart(4, '0')
      : cleanNum;

    // Check duplicate
    const isDuplicate = tickets.some(
      (t) => String(t.receipt_number || '').replace(/^MN-2026-/i, '') === paddedNum
    );
    if (isDuplicate) {
      alert(`Nomor "${paddedNum}" sudah terdaftar di dalam sistem undian!`);
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddTicket({ receipt_number: paddedNum, number: paddedNum });
      sound.playNewTicketPing();
      setSuccessToast(`Nomor ${paddedNum} berhasil dimasukkan ke sistem undian!`);
      setTimeout(() => setSuccessToast(null), 3500);

      // Auto increment next number
      const nextVal = /^\d+$/.test(paddedNum)
        ? String(parseInt(paddedNum, 10) + 1).padStart(paddedNum.length, '0')
        : getNextTicketNumber(tickets);
      setSingleNumber(nextVal);
    } catch (err) {
      alert(`Gagal menyimpan nomor: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle range batch submit
  const handleAddRange = async (e) => {
    e.preventDefault();
    const start = parseInt(rangeStart, 10);
    const end = parseInt(rangeEnd, 10);

    if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
      alert('Rentang nomor tidak valid! Pastikan nomor awal lebih kecil dari nomor akhir.');
      return;
    }

    const count = end - start + 1;
    if (count > 5000) {
      alert('Maksimal rentang nomor sekaligus adalah 5.000 nomor.');
      return;
    }

    if (window.confirm(`Muat ${count} nomor kupon (${start} s/d ${end}) ke dalam sistem undian?`)) {
      try {
        setIsSubmitting(true);
        if (onPopulateRange) {
          await onPopulateRange(start, end);
        } else {
          for (let i = start; i <= end; i++) {
            await onAddTicket({ receipt_number: String(i).padStart(4, '0') });
          }
        }
        sound.playNewTicketPing();
        setSuccessToast(`Berhasil memuat ${count} nomor kupon (${start} s/d ${end}) ke sistem undian!`);
        setTimeout(() => setSuccessToast(null), 4000);
      } catch (err) {
        alert(`Gagal memuat rentang nomor: ${err.message}`);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Filtered tickets
  const filteredTickets = tickets.filter((ticket) => {
    const num = String(ticket.receipt_number || '').replace(/^MN-2026-/i, '').toLowerCase();
    const matchesSearch = num.includes(searchQuery.trim().toLowerCase());

    if (filterStatus === 'eligible') return matchesSearch && ticket.status === 'eligible';
    if (filterStatus === 'won') return matchesSearch && ticket.status === 'won';
    return matchesSearch;
  });

  // Export CSV
  const handleExportCSV = () => {
    if (tickets.length === 0) {
      alert('Tidak ada data nomor kupon untuk diexport!');
      return;
    }
    const headers = ['No', 'Nomor Kupon', 'Status', 'Hadiah Menang', 'Waktu Input'];
    const rows = tickets.map((t, idx) => [
      idx + 1,
      `"${String(t.receipt_number || '').replace(/^MN-2026-/i, '')}"`,
      `"${t.status === 'won' ? 'Pemenang' : 'Siap Diundi'}"`,
      `"${t.prize_won || '-'}"`,
      `"${new Date(t.created_at).toLocaleString('id-ID')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Daftar_Nomor_Kupon_Undian_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">{successToast}</span>
        </div>
      )}

      {/* Secret Route Indicator */}
      <div className="bg-slate-900 border border-blue-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
          <span>🔒 Halaman Khusus Panitia: Akses privat via <strong className="text-blue-300 font-mono">/inputnomorkupon</strong> (Tersembunyi dari publik)</span>
        </div>
        <a
          href="/"
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg font-bold transition-all inline-flex items-center gap-1 border border-amber-500/30"
        >
          ← Kembali ke Panggung Live
        </a>
      </div>

      {/* REALTIME REMOTE CONTROL DECK (Putar Roda Undian dari Admin) */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950/60 to-slate-900 border-2 border-blue-500/40 rounded-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 pb-4 border-b border-blue-500/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-blue-900/40">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  KONTROL PUTAR RODA UNDIAN (LIVE ADMIN)
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Realtime Terhubung
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Tombol putar dan kunci nomor di layar publik OBS/proyektor dikendalikan langsung dari panel ini.
              </p>
            </div>
          </div>

          {/* Link to open Public Stage */}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-2 transition-all shadow-md self-stretch md:self-auto justify-center"
            title="Buka Layar Publik OBS di Tab Baru"
          >
            <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
            <span>Buka Layar Publik (OBS) ↗</span>
          </a>
        </div>

        {/* Prize Selector & Big Control Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Prize Picker */}
          <div className="md:col-span-5">
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Pilih Hadiah yang Akan Diundi
            </label>
            <div className="relative">
              <select
                value={selectedPrize?.id}
                onChange={(e) => {
                  const found = prizes?.find((p) => p.id === e.target.value);
                  if (found && setSelectedPrize) {
                    setSelectedPrize(found);
                    broadcastSpinCommand({ type: 'SELECT_PRIZE', prizeId: found.id });
                    sound.playTick(700);
                  }
                }}
                disabled={isRolling}
                className="w-full bg-slate-950 border border-amber-500/40 text-white text-xs sm:text-sm rounded-xl px-3.5 py-3 pr-8 appearance-none focus:outline-none focus:border-amber-400 cursor-pointer font-bold shadow-inner"
              >
                {prizes?.map((p) => {
                  const wonCount = tickets.filter((t) => t.status === 'won' && t.prize_won === p.name).length;
                  const isFull = p.quota && wonCount >= p.quota;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.icon} {p.badge}: {p.name} ({wonCount}/{p.quota || 1}{isFull ? ' - PENUH' : ''})
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-4 h-4 text-amber-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Main Action Button */}
          <div className="md:col-span-7 flex flex-col gap-1.5">
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              Eksekusi Putaran Roda
            </label>
            {!isRolling ? (
              <button
                onClick={handleAdminStartSpin}
                disabled={eligibleTickets.length === 0}
                className="w-full py-3.5 px-6 rounded-xl font-extrabold text-sm sm:text-base tracking-wider flex items-center justify-center gap-2.5 shadow-xl shadow-blue-900/40 bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500 hover:from-blue-500 hover:to-amber-400 text-white hover:scale-[1.01] active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-blue-400/40"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>🎯 PUTAR RODA UNDIAN DI LAYAR PUBLIK 🎯</span>
              </button>
            ) : (
              <button
                onClick={handleAdminStopSpin}
                disabled={isStopping}
                className={`w-full py-3.5 px-6 rounded-xl font-black text-sm sm:text-base tracking-wider flex items-center justify-center gap-2.5 shadow-2xl transition-all cursor-pointer ${
                  isStopping
                    ? 'bg-amber-500/80 text-slate-950 cursor-not-allowed border-2 border-amber-300'
                    : 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 hover:from-amber-300 hover:to-yellow-200 text-slate-950 shadow-amber-500/50 hover:scale-[1.02] active:scale-95 animate-pulse border-2 border-white'
                }`}
              >
                <Square className="w-5 h-5 fill-current text-slate-950" />
                <span>{isStopping ? '⏳ MENETAPKAN PEMENANG...' : '🎯 KUNCI & TETAPKAN PEMENANG SAH 🎯'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Winner confirmation bar when stopped */}
        {lockedWinner && (
          <div className="mt-4 pt-4 border-t border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 bg-amber-500/10 p-3.5 rounded-xl border border-amber-400/40 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center shrink-0">
                🏆
              </div>
              <div>
                <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">
                  Nomor Pemenang Terpilih
                </span>
                <span className="text-xl sm:text-2xl font-black font-mono-num text-white">
                  {String(lockedWinner.receipt_number || '').replace(/^MN-2026-/i, '')}
                </span>
                <span className="text-xs text-slate-300 ml-2">
                  ({selectedPrize?.name})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleAdminConfirmWinner}
                className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold text-xs rounded-lg hover:from-emerald-500 hover:to-teal-400 shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Kunci & Simpan</span>
              </button>
              <button
                onClick={handleAdminCancelWinner}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg border border-slate-700 cursor-pointer"
              >
                Undi Ulang
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>Input Nomor Kupon Undian</span>
            <span className="text-xs bg-slate-800 text-amber-300 px-2.5 py-0.5 rounded-full font-mono font-bold">
              Total: {tickets.length.toLocaleString('id-ID')} Nomor
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Hanya input nomor biasa. Setiap nomor yang disimpan akan <strong className="text-amber-400">langsung masuk ke roda undian secara real-time!</strong>
          </p>
        </div>

        {/* Quick Batch Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 p-1 rounded-xl">
            <span className="text-[11px] text-amber-300 font-bold px-1.5 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Cepat:
            </span>
            <button
              onClick={() => onPopulateDemo(10)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              title="Tambah 10 Nomor Baru"
            >
              +10
            </button>
            <button
              onClick={() => onPopulateDemo(100)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              title="Tambah 100 Nomor Baru"
            >
              +100
            </button>
            <button
              onClick={() => onPopulateDemo(500)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              title="Tambah 500 Nomor Baru"
            >
              +500
            </button>
            <button
              onClick={() => {
                if (window.confirm('Muat 759 Kupon (Nomor 0001 s/d 0759) ke dalam sistem roda undian?')) {
                  if (onPopulateRange) onPopulateRange(1, 759);
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-500 hover:from-emerald-500 hover:to-amber-400 text-white text-xs font-black cursor-pointer shadow-md"
              title="Isi Kupon Nomor 0001 s/d 0759 (Total 759 Nomor)"
            >
              0001-0759 (759 Nomor) 🎯
            </button>
            <button
              onClick={() => {
                if (window.confirm('Tambah 2.000 nomor kupon sekaligus ke dalam database undian?')) {
                  onPopulateDemo(2000);
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              title="Tambah 2.000 Nomor Langsung ke Roda Undian"
            >
              +2.000
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              if (window.confirm('PERINGATAN: Apakah Anda yakin ingin mereset/menghapus semua nomor kupon? Tindakan ini tidak bisa dibatalkan.')) {
                onResetAll();
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold flex items-center gap-1.5 border border-rose-800/40 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Reset Data</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Inputs (Left Column) */}
        <div className="lg:col-span-5 space-y-4">
          {/* 1. Single Number Input Form */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Input Nomor Tunggal</h3>
                <p className="text-[11px] text-slate-400">Masukkan nomor biasa untuk masuk ke roda undian</p>
              </div>
            </div>

            <form onSubmit={handleAddSingle} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Nomor Kupon / Undian <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={singleNumber}
                    onChange={(e) => setSingleNumber(e.target.value)}
                    placeholder="Contoh: 0001 atau 0760"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono-num font-black text-lg sm:text-xl focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  *Nomor otomatis bertambah ke urutan berikutnya setiap kali disimpan.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !singleNumber.trim()}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500 hover:from-blue-500 hover:to-amber-400 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition-all cursor-pointer disabled:opacity-50"
              >
                <PlusCircle className="w-5 h-5" />
                <span>+ Masukkan Nomor ke Roda Undian</span>
              </button>
            </form>
          </div>

          {/* 2. Range Input Form */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
            <button
              onClick={() => setIsRangeOpen((prev) => !prev)}
              className="w-full flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Input Rentang Nomor Sekaligus</h4>
                  <p className="text-[11px] text-slate-400">Buat urutan nomor banyak secara otomatis</p>
                </div>
              </div>
              <span className="text-xs text-amber-400 font-semibold">{isRangeOpen ? 'Tutup ▲' : 'Buka ▼'}</span>
            </button>

            {isRangeOpen && (
              <form onSubmit={handleAddRange} className="mt-4 pt-3 border-t border-slate-800 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                      Dari Nomor
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                      Sampai Nomor
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Buat Rentang ({rangeStart} s/d {rangeEnd})</span>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* List of Numbers (Right Column) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Daftar Nomor Kupon di Roda Undian</span>
                  <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-mono">
                    {filteredTickets.length} / {tickets.length}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">Seluruh nomor ini aktif terpasang pada roda undian</p>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                    filterStatus === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setFilterStatus('eligible')}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                    filterStatus === 'eligible' ? 'bg-slate-800 text-amber-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Siap Diundi
                </button>
                <button
                  onClick={() => setFilterStatus('won')}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                    filterStatus === 'won' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Menang
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nomor kupon (misal: 0421)..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 sticky top-0 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Nomor Kupon</th>
                    <th className="py-2.5 px-3">Status Undian</th>
                    <th className="py-2.5 px-3">Hadiah Menang</th>
                    <th className="py-2.5 px-3">Waktu Input</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        Tidak ada nomor kupon yang cocok dengan pencarian
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((t, idx) => {
                      const cleanNum = String(t.receipt_number || '').replace(/^MN-2026-/i, '');
                      return (
                        <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 text-slate-500 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-black text-sm sm:text-base text-amber-300">
                            {cleanNum}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                t.status === 'won'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {t.status === 'won' ? 'Pemenang' : 'Siap Diundi'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-semibold">
                            {t.prize_won || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                            {new Date(t.created_at).toLocaleString('id-ID', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {onDeleteTicket && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Hapus nomor kupon "${cleanNum}" dari daftar undian?`)) {
                                    onDeleteTicket(t.id);
                                  }
                                }}
                                className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Hapus Nomor"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
