import React, { useState } from 'react';
import { Wifi, Radio, Volume2, VolumeX, ShieldCheck, Database, Smartphone, Laptop, Sparkles } from 'lucide-react';
import { sound } from '../lib/audio';

export default function Navbar({
  activeTab,
  setActiveTab,
  isUsingSupabase,
  supabaseError,
  totalTickets,
  onOpenSqlModal
}) {
  const [isMuted, setIsMuted] = useState(sound.isMuted);

  const toggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
    if (!muted) {
      sound.playTick();
    }
  };

  const publicNavItems = [
    { id: 'stage', label: 'Undian Live (OBS)', icon: Radio, highlight: true },
    { id: 'check', label: 'Cek Nomor Kupon', icon: ShieldCheck },
    { id: 'winners', label: 'Daftar Pemenang', icon: Sparkles },
  ];

  // Hidden from public. Only visible when accessing secret /inputnomorkupon route
  const navItems = activeTab === 'admin'
    ? [
        { id: 'admin', label: '🔒 Admin: Input Kupon', icon: Smartphone, highlight: false },
        ...publicNavItems
      ]
    : publicNavItems;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-amber-500 flex items-center justify-center shadow-lg shadow-blue-900/40 text-white font-black text-xl">
              <Wifi className="w-6 h-6 animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-wider text-white">
                MERDEKA<span className="text-amber-400">.NET</span>
              </h1>
              <span className="bg-blue-500/20 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
                UNDIAN LIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Sistem Pengundian Kupon Pelanggan Resmi & Transparan
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-1 max-w-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  sound.playTick(700);
                  setActiveTab(item.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? item.highlight
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 text-white shadow-md shadow-blue-600/30'
                      : 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive && item.highlight ? 'text-white' : ''}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Tools (Realtime Status & Sound) */}
        <div className="flex items-center gap-2">
          {/* Supabase status badge */}
          <button
            onClick={onOpenSqlModal}
            title={isUsingSupabase ? 'Supabase Realtime Terkoneksi' : 'Koneksi Lokal / Klik untuk Setup SQL'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
              isUsingSupabase
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40 hover:bg-emerald-900/50'
                : 'bg-amber-950/60 text-amber-300 border-amber-500/40 hover:bg-amber-900/50'
            }`}
          >
            <Database className="w-3 h-3" />
            <span className="hidden md:inline">
              {isUsingSupabase ? 'Supabase Realtime' : 'Mode Tab Sync'}
            </span>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              isMuted
                ? 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
            }`}
            title={isMuted ? 'Suara Senyap (Klik untuk aktifkan)' : 'Efek Suara Aktif (Klik untuk bisukan)'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 animate-bounce" />}
          </button>
        </div>
      </div>
    </header>
  );
}
