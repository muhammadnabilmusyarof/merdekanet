# 📡 MERDEKA NET - Sistem Undian Live TikTok Pelanggan WiFi Desa

Aplikasi web modern untuk pengundian nota bulanan member WiFi desa secara **Live Streaming di TikTok** dengan fitur **Real-time Synchronization** (tanpa refresh), efek visual & audio dramatis, serta panel admin kasir yang ramah HP (mobile-first).

---

## 🚀 Fitur Utama

1. **Layar Live TikTok (Stage Pengacak)**:
   - **Responsive Dua Mode:** Tampilan Landscape (16:9) sangat tajam dan jernih untuk OBS Studio / Laptop, serta ramah Portrait di layar HP.
   - **Animasi Acak Dramatis:** Efek putaran roulette digital berkecepatan tinggi yang melambat bertahap untuk membangun ketegangan penonton live.
   - **Audio FX Synthesizer (Web Audio API):** Efek suara detak mekanik roulette berputar dan musik kemenangan *fanfare*, 100% offline tanpa delay.
   - **Efek Konfeti Ledakan:** Partikel konfeti penuh warna saat pemenang sah terpilih.
   - **Floating Live Feed Ticker:** Setiap ada nota baru masuk dari HP admin kasir, muncul pop-up notifikasi melayang di layar live secara otomatis.

2. **Panel Kasir / Input Nota (Admin HP)**:
   - Didesain ringan dan cepat untuk digunakan kasir saat menerima pembayaran iuran pelanggan.
   - Auto-increment nomor nota fisik.
   - Pilihan paket WiFi & Dusun/RT khas desa.
   - Tombol instan **"SIMPAN & KIRIM KE LIVE"** (langsung terkirim via WebSocket Real-time).
   - Tombol isi 8 nota demo otomatis untuk latihan/simulasi sebelum live.

3. **Cek Nota Mandiri untuk Warga/Pelanggan**:
   - Member cukup memasukkan nomor nota atau nama mereka di HP untuk memastikan struk pembayaran mereka sudah terdaftar resmi sebelum live dimulai.

4. **Rekapitulasi Pemenang**:
   - Pencatatan pemenang yang sah dan tombol unduh laporan (.CSV / Excel).

---

## 🛠️ Langkah Menghubungkan ke Supabase (1 Menit)

Kredensial Supabase Anda sudah terpasang di file `.env`. Untuk membuat tabel dan mengaktifkan koneksi Real-time WebSocket:

1. Buka dashboard Supabase: [https://supabase.com/dashboard/project/dbzouczghymsdsfkuvur](https://supabase.com/dashboard/project/dbzouczghymsdsfkuvur)
2. Buka menu **SQL Editor** di sidebar sebelah kiri.
3. Klik **New Query**.
4. Salin dan tempelkan script SQL berikut:

```sql
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

-- 3. Izinkan Akses Publik (Row Level Security)
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to tickets" ON public.tickets FOR SELECT USING (true);
CREATE POLICY "Allow public insert to tickets" ON public.tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to tickets" ON public.tickets FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to tickets" ON public.tickets FOR DELETE USING (true);

CREATE POLICY "Allow public read access to winners" ON public.winners FOR SELECT USING (true);
CREATE POLICY "Allow public insert to winners" ON public.winners FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete to winners" ON public.winners FOR DELETE USING (true);

-- 4. AKTIFKAN SUPABASE REALTIME REPLICATION (KUNCI UPDATE TANPA REFRESH)
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.winners;
```

5. Klik tombol hijau **RUN**.
6. Buka web Anda, indikator database di pojok kanan atas akan langsung menyala hijau: `Supabase Realtime Terkoneksi 🟢`.

---

## 💻 Cara Menjalankan Project

Di terminal:
```bash
# Menjalankan Frontend (React + Vite + Tailwind)
npm run dev

# (Opsional) Menjalankan Backend API Express
npm run server
```

Buka di browser: `http://localhost:5173/`
