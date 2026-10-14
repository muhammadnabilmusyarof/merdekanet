import { supabase, isSupabaseConfigured } from './supabase';

const CHANNEL_NAME = 'merdeka_net_spin_channel';
const STORAGE_EVENT_KEY = 'merdeka_net_spin_event_v1';
const STORAGE_STATE_KEY = 'merdeka_net_spin_state_v1';

let broadcastChannel = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) {
    console.warn('BroadcastChannel not available:', e);
  }
}

let supabaseChannel = null;
if (isSupabaseConfigured && supabase) {
  try {
    supabaseChannel = supabase.channel('roulette_live_spin');
  } catch (e) {
    console.warn('Supabase realtime channel error:', e);
  }
}

/**
 * Broadcast a spin command from Admin to Public (and other tabs)
 */
export function broadcastSpinCommand(command) {
  const payload = {
    ...command,
    _id: Math.random().toString(36).substring(2, 9),
    timestamp: Date.now(),
  };

  // 1. BroadcastChannel (0ms latency local cross-tab)
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload);
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }
  }

  // 2. LocalStorage Event (Fallback for other windows/tabs)
  try {
    localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('LocalStorage sync error:', e);
  }

  // 3. Supabase Realtime Broadcast (Cross-device, e.g. Phone Admin -> PC OBS)
  if (supabaseChannel) {
    try {
      supabaseChannel.send({
        type: 'broadcast',
        event: 'spin_command',
        payload,
      });
    } catch (e) {
      console.warn('Supabase broadcast error:', e);
    }
  }

  // Also update latest persistent state if relevant
  if (command.type === 'START_SPIN') {
    saveSpinState({ status: 'spinning', prizeId: command.prizeId });
  } else if (command.type === 'STOP_SPIN') {
    saveSpinState({ status: 'decelerating', winnerId: command.winnerId });
  } else if (command.type === 'CONFIRM_WINNER' || command.type === 'CANCEL_WINNER') {
    saveSpinState({ status: 'idle', winnerId: null });
  }

  return payload;
}

/**
 * Save current spin state snapshot
 */
export function saveSpinState(state) {
  try {
    localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify({ ...state, updatedAt: Date.now() }));
  } catch {}
}

/**
 * Read current spin state snapshot
 */
export function getSavedSpinState() {
  try {
    const raw = localStorage.getItem(STORAGE_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { status: 'idle' };
}

/**
 * Subscribe to all spin commands from any channel
 */
export function subscribeSpinCommands(callback) {
  const handledIds = new Set();

  const handlePayload = (payload) => {
    if (!payload || !payload.type) return;
    if (payload._id && handledIds.has(payload._id)) return;
    if (payload._id) {
      handledIds.add(payload._id);
      if (handledIds.size > 200) {
        const first = handledIds.values().next().value;
        handledIds.delete(first);
      }
    }
    callback(payload);
  };

  // 1. BroadcastChannel Listener
  const onBcMessage = (event) => {
    handlePayload(event.data);
  };
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', onBcMessage);
  }

  // 2. Storage Event Listener
  const onStorageChange = (e) => {
    if (e.key === STORAGE_EVENT_KEY && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        handlePayload(data);
      } catch {}
    }
  };
  window.addEventListener('storage', onStorageChange);

  // 3. Supabase Realtime Listener
  let sbSub = null;
  if (supabaseChannel) {
    try {
      sbSub = supabaseChannel
        .on('broadcast', { event: 'spin_command' }, ({ payload }) => {
          handlePayload(payload);
        })
        .subscribe();
    } catch (e) {
      console.warn('Supabase channel subscribe error:', e);
    }
  }

  // Cleanup function
  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', onBcMessage);
    }
    window.removeEventListener('storage', onStorageChange);
    if (sbSub && supabase) {
      try {
        supabase.removeChannel(sbSub);
      } catch {}
    }
  };
}
