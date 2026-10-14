import { supabase, isSupabaseConfigured } from './supabase';

const CHANNEL_TOPIC = 'merdeka_net_roulette_live_sync';
const LOCAL_BC_NAME = 'merdeka_net_spin_channel';
const STORAGE_EVENT_KEY = 'merdeka_net_spin_event_v2';
const STORAGE_STATE_KEY = 'merdeka_net_spin_state_v2';

// 1. BroadcastChannel for local cross-tab zero-latency sync
let broadcastChannel = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(LOCAL_BC_NAME);
  } catch (e) {
    console.warn('BroadcastChannel not available:', e);
  }
}

// 2. Supabase Realtime Singleton Channel
let supabaseChannel = null;
let channelStatus = isSupabaseConfigured ? 'CONNECTING' : 'OFFLINE';

// Set of active listeners
const commandListeners = new Set();
const statusListeners = new Set();
const handledIds = new Set();

function notifyStatus(status) {
  channelStatus = status;
  statusListeners.forEach((listener) => {
    try {
      listener(status);
    } catch (e) {
      console.error('Status listener error:', e);
    }
  });
}

function dispatchCommand(payload) {
  if (!payload || !payload.type) return;

  // Deduplicate commands using _id
  if (payload._id) {
    if (handledIds.has(payload._id)) return;
    handledIds.add(payload._id);
    if (handledIds.size > 200) {
      const first = handledIds.values().next().value;
      handledIds.delete(first);
    }
  }

  commandListeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (e) {
      console.error('Command listener error:', e);
    }
  });
}

// Local Storage Event Listener (for local cross-window fallbacks)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_EVENT_KEY && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        dispatchCommand(data);
      } catch {}
    }
  });

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', (event) => {
      dispatchCommand(event.data);
    });
  }
}

// Initialize Supabase Realtime Channel
export function initSupabaseChannel() {
  if (!isSupabaseConfigured || !supabase) {
    notifyStatus('OFFLINE');
    return null;
  }

  if (supabaseChannel) {
    return supabaseChannel;
  }

  try {
    notifyStatus('CONNECTING');
    supabaseChannel = supabase.channel(CHANNEL_TOPIC, {
      config: {
        broadcast: {
          ack: true,
          self: true, // Receive own broadcasts for complete state consistency
        },
      },
    });

    supabaseChannel
      .on('broadcast', { event: 'spin_command' }, ({ payload }) => {
        dispatchCommand(payload);
      })
      .subscribe((status, error) => {
        if (error) {
          console.warn('[Supabase Realtime Channel Error]:', error);
        }
        notifyStatus(status);

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Auto reconnect after 3 seconds
          setTimeout(() => {
            if (supabase && supabaseChannel) {
              try {
                supabase.removeChannel(supabaseChannel);
              } catch {}
              supabaseChannel = null;
              initSupabaseChannel();
            }
          }, 3000);
        }
      });

    return supabaseChannel;
  } catch (err) {
    console.warn('Failed to initialize Supabase realtime channel:', err);
    notifyStatus('CHANNEL_ERROR');
    return null;
  }
}

// Initialize immediately if in browser
if (typeof window !== 'undefined') {
  initSupabaseChannel();
}

/**
 * Broadcast a spin command from Admin to Public (and all cross-device clients)
 */
export async function broadcastSpinCommand(command) {
  const payload = {
    ...command,
    _id: Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36),
    timestamp: Date.now(),
  };

  // 1. Dispatch locally to current window
  dispatchCommand(payload);

  // 2. BroadcastChannel (0ms latency local cross-tab)
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload);
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }
  }

  // 3. LocalStorage Event (Fallback for local windows)
  try {
    localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('LocalStorage sync error:', e);
  }

  // 4. Supabase Realtime Broadcast (Cross-device, e.g. Laptop Admin -> Mobile OBS)
  if (isSupabaseConfigured && supabase) {
    const channel = initSupabaseChannel();
    if (channel) {
      // If channel is still connecting, await up to 2.5 seconds
      if (channelStatus !== 'SUBSCRIBED') {
        await new Promise((resolve) => {
          const timeout = setTimeout(resolve, 2500);
          const interval = setInterval(() => {
            if (channelStatus === 'SUBSCRIBED') {
              clearTimeout(timeout);
              clearInterval(interval);
              resolve();
            }
          }, 50);
        });
      }

      try {
        const sendResult = await channel.send({
          type: 'broadcast',
          event: 'spin_command',
          payload,
        });
        console.log('[Supabase Broadcast Delivered]:', sendResult, payload.type);
      } catch (e) {
        console.warn('Supabase broadcast error:', e);
      }
    }
  }

  // Persist current spin state snapshot
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
 * Subscribe to all spin commands from any channel (Local tab, Local storage, or Supabase Remote)
 */
export function subscribeSpinCommands(callback) {
  initSupabaseChannel();
  commandListeners.add(callback);

  // Return unsubscribe handler that removes callback without tearing down the underlying socket
  return () => {
    commandListeners.delete(callback);
  };
}

/**
 * Subscribe to Supabase connection status
 */
export function subscribeRealtimeStatus(callback) {
  callback(channelStatus);
  statusListeners.add(callback);

  return () => {
    statusListeners.delete(callback);
  };
}

export function getRealtimeStatus() {
  return channelStatus;
}
