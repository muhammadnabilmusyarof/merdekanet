export const DEFAULT_PRIZES = [
  {
    id: 'prize-1',
    name: 'Sepeda Motor Listrik / Matic',
    category: 'GRAND PRIZE',
    icon: '🛵',
    description: 'Hadiah Utama Undian Akbar Merdeka Net 2026',
    quota: 1,
    color: 'from-amber-500 via-rose-500 to-red-600',
    badge: '🏆 UTAMA'
  },
  {
    id: 'prize-2',
    name: 'Smart TV Android 32 Inch HD',
    category: 'ELEKTRONIK',
    icon: '📺',
    description: 'Nonton YouTube & Netflix lancar bersama Merdeka Net',
    quota: 1,
    color: 'from-blue-600 via-indigo-600 to-purple-600',
    badge: 'HADIAH 1'
  },
  {
    id: 'prize-3',
    name: 'Kulkas 1 Pintu Hemat Daya',
    category: 'ELEKTRONIK',
    icon: '🧊',
    description: 'Dingin maksimal hemat listrik',
    quota: 1,
    color: 'from-cyan-500 via-teal-600 to-emerald-600',
    badge: 'HADIAH 2'
  },
  {
    id: 'prize-4',
    name: 'Rice Cooker Digital Serbaguna',
    category: 'PERABOT',
    icon: '🍚',
    description: 'Kapasitas 2 Liter, masak nasi pulen otomatis',
    quota: 2,
    color: 'from-emerald-500 via-green-600 to-teal-700',
    badge: 'HADIAH 3'
  },
  {
    id: 'prize-5',
    name: 'Kipas Angin Stand Fan Tornado',
    category: 'ELEKTRONIK',
    icon: '💨',
    description: 'Sejuk dan kencang untuk ruang keluarga',
    quota: 3,
    color: 'from-violet-500 via-purple-600 to-pink-600',
    badge: 'HADIAH 4'
  },
  {
    id: 'prize-6',
    name: 'Gratis Langganan WiFi 6 Bulan',
    category: 'INTERNET',
    icon: '📶',
    description: 'Bebas iuran bulanan 6 bulan penuh tanpa batas',
    quota: 3,
    color: 'from-fuchsia-500 via-pink-600 to-rose-600',
    badge: 'SPECIAL'
  },
  {
    id: 'prize-7',
    name: 'Gratis Langganan WiFi 3 Bulan',
    category: 'INTERNET',
    icon: '⚡',
    description: 'Bebas iuran bulanan 3 bulan kecepatan penuh',
    quota: 5,
    color: 'from-orange-500 via-amber-600 to-yellow-600',
    badge: 'FAVORIT'
  }
];

export const INITIAL_TICKETS = Array.from({ length: 759 }, (_, idx) => {
  const num = idx + 1;
  const numStr = String(num).padStart(4, '0');

  return {
    id: `a0000000-0000-4000-8000-${String(num).padStart(12, '0')}`,
    receipt_number: numStr,
    member_name: numStr,
    phone_number: '-',
    address_rt: '-',
    wifi_package: '-',
    status: 'eligible',
    prize_won: null,
    created_at: new Date(Date.now() - (759 - num) * 60000).toISOString()
  };
});

export const SUPABASE_SETUP_SQL = `-- SCRIPT PEMBUATAN TABEL DAN AKTIFKAN REALTIME DI SUPABASE
-- Buka Dashboard Supabase -> Masuk ke Menu 'SQL Editor' -> Tempelkan (Paste) script ini -> Klik 'RUN'

-- 1. Buat Tabel Tickets (Nota Member)
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  member_name TEXT NOT NULL,
  phone_number TEXT,
  address_rt TEXT,
  wifi_package TEXT,
  status TEXT DEFAULT 'eligible', -- 'eligible', 'won'
  prize_won TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Buat Tabel Winners (Rekap Riwayat Pemenang)
CREATE TABLE IF NOT EXISTS public.winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  receipt_number TEXT NOT NULL,
  member_name TEXT NOT NULL,
  phone_number TEXT,
  address_rt TEXT,
  prize_name TEXT NOT NULL,
  won_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Izinkan Akses Publik (Row Level Security / RLS)
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to tickets" ON public.tickets FOR SELECT USING (true);
CREATE POLICY "Allow public insert to tickets" ON public.tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to tickets" ON public.tickets FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to tickets" ON public.tickets FOR DELETE USING (true);

CREATE POLICY "Allow public read access to winners" ON public.winners FOR SELECT USING (true);
CREATE POLICY "Allow public insert to winners" ON public.winners FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete to winners" ON public.winners FOR DELETE USING (true);

-- 4. PENTING: AKTIFKAN SUPABASE REALTIME REPLICATION UNTUK TICKETS
-- Ini yang membuat web live stream ter-update otomatis tanpa refresh saat admin input nota baru
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.winners;
`;
