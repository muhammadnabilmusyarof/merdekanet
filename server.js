import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dbzouczghymsdsfkuvur.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_IZPW5TxRIk5y2drbfeZD3A_2wTAhtX5';

const supabase = createClient(supabaseUrl, supabaseKey);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Merdeka Net WiFi Lottery API', timestamp: new Date() });
});

// Get all tickets
app.get('/api/tickets', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new ticket (Admin input)
app.post('/api/tickets', async (req, res) => {
  try {
    const { receipt_number, member_name, phone_number, address_rt, wifi_package } = req.body;
    if (!receipt_number || !member_name) {
      return res.status(400).json({ error: 'Nomor Nota dan Nama Pelanggan wajib diisi!' });
    }

    const { data, error } = await supabase
      .from('tickets')
      .insert([
        {
          receipt_number: receipt_number.toUpperCase().trim(),
          member_name: member_name.trim(),
          phone_number: phone_number || '-',
          address_rt: address_rt || '-',
          wifi_package: wifi_package || 'Merdeka 20 Mbps',
          status: 'eligible',
        },
      ])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record winner
app.post('/api/winners', async (req, res) => {
  try {
    const { ticket_id, receipt_number, member_name, phone_number, address_rt, prize_name } = req.body;

    // Update ticket status
    await supabase.from('tickets').update({ status: 'won', prize_won: prize_name }).eq('id', ticket_id);

    // Insert to winners
    const { data, error } = await supabase
      .from('winners')
      .insert([
        {
          ticket_id,
          receipt_number,
          member_name,
          phone_number,
          address_rt,
          prize_name,
        },
      ])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Merdeka Net API Server berjalan di http://localhost:${PORT}`);
});
