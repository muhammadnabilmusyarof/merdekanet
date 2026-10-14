import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { INITIAL_TICKETS, DEFAULT_PRIZES } from './constants';
import { sound } from './audio';

const STORAGE_KEY_TICKETS = 'merdeka_net_tickets_v2';
const STORAGE_KEY_WINNERS = 'merdeka_net_winners_v2';

export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useTicketsStore() {
  const [tickets, setTickets] = useState([]);
  const [winners, setWinners] = useState([]);
  const [prizes, setPrizes] = useState(DEFAULT_PRIZES);
  const [selectedPrize, setSelectedPrize] = useState(DEFAULT_PRIZES[0]);
  const [isUsingSupabase, setIsUsingSupabase] = useState(false);
  const [supabaseError, setSupabaseError] = useState(null);
  const [latestIncomingTicket, setLatestIncomingTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const broadcastChannelRef = useRef(null);

  // Initialize broadcast channel for tab-to-tab sync
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('merdeka_net_realtime_sync');
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'NEW_TICKET') {
          setTickets((prev) => {
            if (prev.some((t) => t.receipt_number === payload.receipt_number)) return prev;
            return [payload, ...prev];
          });
          setLatestIncomingTicket(payload);
          sound.playNewTicketPing();
        } else if (type === 'UPDATE_TICKET') {
          setTickets((prev) => prev.map((t) => (t.id === payload.id ? { ...t, ...payload } : t)));
        } else if (type === 'ADD_WINNER') {
          setWinners((prev) => {
            if (prev.some((w) => w.id === payload.id || (w.receipt_number === payload.receipt_number && w.prize_name === payload.prize_name))) {
              return prev;
            }
            return [payload, ...prev];
          });
        } else if (type === 'RESET_TICKETS') {
          setTickets(payload);
        }
      };

      return () => {
        channel.close();
      };
    }
  }, []);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setIsLoading(true);

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: ticketsData, error: ticketsErr } = await supabase
          .from('tickets')
          .select('*')
          .limit(5000)
          .order('created_at', { ascending: false });

        if (!ticketsErr && ticketsData) {
          setTickets(ticketsData);
          setIsUsingSupabase(true);
          setSupabaseError(null);

          // Fetch winners
          const { data: winnersData } = await supabase
            .from('winners')
            .select('*')
            .order('won_at', { ascending: false });
          if (winnersData) setWinners(winnersData);

          setIsLoading(false);
          return;
        } else {
          console.warn('Supabase table query notice:', ticketsErr?.message);
          setSupabaseError(ticketsErr?.message || 'Table belum dibuat di Supabase');
        }
      } catch (err) {
        console.warn('Supabase connection error:', err);
        setSupabaseError(err.message);
      }
    }

    // Fallback to localStorage / initial data
    const cachedTickets = localStorage.getItem(STORAGE_KEY_TICKETS);
    const cachedWinners = localStorage.getItem(STORAGE_KEY_WINNERS);

    if (cachedTickets !== null) {
      try {
        setTickets(JSON.parse(cachedTickets));
      } catch {
        setTickets(INITIAL_TICKETS);
      }
    } else {
      setTickets(INITIAL_TICKETS);
      localStorage.setItem(STORAGE_KEY_TICKETS, JSON.stringify(INITIAL_TICKETS));
    }

    if (cachedWinners !== null) {
      try {
        setWinners(JSON.parse(cachedWinners));
      } catch {
        setWinners([]);
      }
    } else {
      setWinners([]);
    }

    setIsUsingSupabase(false);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Setup Supabase Realtime Subscription
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !isUsingSupabase) return;

    const channel = supabase
      .channel('public:tickets:realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tickets' },
        (payload) => {
          const newTicket = payload.new;
          setTickets((prev) => {
            if (prev.some((t) => t.id === newTicket.id || t.receipt_number === newTicket.receipt_number)) {
              return prev;
            }
            return [newTicket, ...prev];
          });
          setLatestIncomingTicket(newTicket);
          sound.playNewTicketPing();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets' },
        (payload) => {
          const updated = payload.new;
          setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tickets' },
        (payload) => {
          const deleted = payload.old;
          setTickets((prev) => prev.filter((t) => t.id !== deleted.id));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'winners' },
        (payload) => {
          setWinners((prev) => {
            if (prev.some((w) => w.id === payload.new.id || (w.receipt_number === payload.new.receipt_number && w.prize_name === payload.new.prize_name))) {
              return prev;
            }
            return [payload.new, ...prev];
          });
        }
      )
      .subscribe((status) => {
        console.log('Supabase Realtime Channel Status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isUsingSupabase]);

  // Persist to local storage if not using Supabase
  useEffect(() => {
    if (!isUsingSupabase && !isLoading) {
      localStorage.setItem(STORAGE_KEY_TICKETS, JSON.stringify(tickets));
    }
  }, [tickets, isUsingSupabase, isLoading]);

  useEffect(() => {
    if (!isUsingSupabase && !isLoading) {
      localStorage.setItem(STORAGE_KEY_WINNERS, JSON.stringify(winners));
    }
  }, [winners, isUsingSupabase, isLoading]);

  // Actions
  const addTicket = async (ticketData) => {
    const rawNumber = String(ticketData.number || ticketData.receipt_number || '').trim();
    const cleanNumber = rawNumber.replace(/^MN-2026-/i, '');
    const numStr = cleanNumber.length <= 4 && /^\d+$/.test(cleanNumber) 
      ? cleanNumber.padStart(4, '0') 
      : cleanNumber;

    const newTicket = {
      id: generateUUID(),
      receipt_number: numStr,
      member_name: numStr,
      phone_number: '-',
      address_rt: '-',
      wifi_package: '-',
      status: 'eligible',
      prize_won: null,
      created_at: new Date().toISOString(),
    };

    if (isUsingSupabase && supabase) {
      const { data, error } = await supabase.from('tickets').insert([newTicket]).select().single();
      if (error) {
        console.error('Failed to insert ticket to Supabase:', error);
        throw error;
      }
      setTickets((prev) => [data || newTicket, ...prev]);
    } else {
      setTickets((prev) => [newTicket, ...prev]);
    }

    setLatestIncomingTicket(newTicket);
    sound.playNewTicketPing();

    // Broadcast to other open tabs (e.g. Live Screen tab)
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({ type: 'NEW_TICKET', payload: newTicket });
    }

    return newTicket;
  };

  const markTicketAsWinner = async (ticket, prizeName) => {
    const updatedTicket = {
      ...ticket,
      status: 'won',
      prize_won: prizeName,
    };

    const winnerRecord = {
      id: generateUUID(),
      ticket_id: ticket.id,
      receipt_number: ticket.receipt_number,
      member_name: ticket.member_name,
      phone_number: ticket.phone_number,
      address_rt: ticket.address_rt,
      prize_name: prizeName,
      won_at: new Date().toISOString(),
    };

    if (isUsingSupabase && supabase) {
      await supabase
        .from('tickets')
        .update({ status: 'won', prize_won: prizeName })
        .eq('id', ticket.id);

      await supabase.from('winners').insert([winnerRecord]);
    }

    setTickets((prev) => prev.map((t) => (t.id === ticket.id ? updatedTicket : t)));
    setWinners((prev) => {
      if (prev.some((w) => w.id === winnerRecord.id || (w.receipt_number === winnerRecord.receipt_number && w.prize_name === winnerRecord.prize_name))) {
        return prev;
      }
      return [winnerRecord, ...prev];
    });

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({ type: 'UPDATE_TICKET', payload: updatedTicket });
      broadcastChannelRef.current.postMessage({ type: 'ADD_WINNER', payload: winnerRecord });
    }
  };

  const resetAllTickets = async () => {
    if (isUsingSupabase && supabase) {
      await supabase.from('winners').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('tickets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
    setTickets([]);
    setWinners([]);
    localStorage.setItem(STORAGE_KEY_TICKETS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_WINNERS, JSON.stringify([]));

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({ type: 'RESET_TICKETS', payload: [] });
    }
  };

  const populateDemoTickets = async (count = 8) => {
    let maxNum = 0;
    tickets.forEach((t) => {
      const n = parseInt(String(t.receipt_number || '').replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    });

    const generated = [];
    for (let i = 1; i <= count; i++) {
      const num = maxNum + i;
      const numStr = String(num).padStart(4, '0');
      generated.push({
        id: generateUUID(),
        receipt_number: numStr,
        member_name: numStr,
        phone_number: '-',
        address_rt: '-',
        wifi_package: '-',
        status: 'eligible',
        prize_won: null,
        created_at: new Date(Date.now() - (count - i) * 1000).toISOString(),
      });
    }

    if (isUsingSupabase && supabase) {
      const chunkSize = 200;
      for (let i = 0; i < generated.length; i += chunkSize) {
        const chunk = generated.slice(i, i + chunkSize);
        await supabase.from('tickets').insert(chunk);
      }
      setTickets((prev) => [...generated, ...prev]);
    } else {
      setTickets((prev) => [...generated, ...prev]);
    }
  };

  const populateRange = async (start = 1, end = 759) => {
    const list = INITIAL_TICKETS.slice(start - 1, end);
    if (isUsingSupabase && supabase) {
      const chunkSize = 200;
      for (let i = 0; i < list.length; i += chunkSize) {
        const chunk = list.slice(i, i + chunkSize);
        await supabase.from('tickets').insert(chunk);
      }
      setTickets(list);
    } else {
      setTickets(list);
      localStorage.setItem(STORAGE_KEY_TICKETS, JSON.stringify(list));
    }
  };

  const deleteTicket = async (id) => {
    if (isUsingSupabase && supabase) {
      await supabase.from('tickets').delete().eq('id', id);
    }
    setTickets((prev) => prev.filter((t) => t.id !== id));
  };

  return {
    tickets,
    winners,
    prizes,
    setPrizes,
    selectedPrize,
    setSelectedPrize,
    isUsingSupabase,
    supabaseError,
    latestIncomingTicket,
    setLatestIncomingTicket,
    isLoading,
    addTicket,
    deleteTicket,
    markTicketAsWinner,
    resetAllTickets,
    populateDemoTickets,
    populateRange,
    refetch: fetchData,
  };
}
