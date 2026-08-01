if (!global.WebSocket) {
  try {
    global.WebSocket = require('ws');
  } catch (e) {
    // ws module polyfill fallback
  }
}

const { createClient } = require('@supabase/supabase-js');
const {
  getTransactions,
  setTransactions,
  getSettings,
  updateSettingsInStore,
  getPendingQueue,
  setPendingQueue,
} = require('./database.cjs');

let supabaseClient = null;
let currentClientConfig = { url: '', key: '' };
let autoSyncInterval = null;
let mainWindowRef = null;

let syncStatus = {
  status: 'offline', // 'synced', 'syncing', 'offline', 'pending', 'error'
  lastSyncTime: null,
  pendingCount: 0,
  error: null,
  enabled: false,
};

function setMainWindow(win) {
  mainWindowRef = win;
}

function broadcastSyncStatus() {
  const queue = getPendingQueue();
  const settings = getSettings();
  syncStatus.pendingCount = queue.length;
  syncStatus.lastSyncTime = settings.last_sync_time || null;
  syncStatus.enabled = Boolean(settings.cloud_sync_enabled);

  if (!syncStatus.enabled) {
    syncStatus.status = 'offline';
  } else if (syncStatus.status === 'synced' && syncStatus.pendingCount > 0) {
    syncStatus.status = 'pending';
  }

  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('sync-status-changed', getSyncStatus());
  }
}

function getSyncStatus() {
  const queue = getPendingQueue();
  const settings = getSettings();
  return {
    ...syncStatus,
    pendingCount: queue.length,
    lastSyncTime: settings.last_sync_time || null,
    enabled: Boolean(settings.cloud_sync_enabled),
  };
}

function getSupabaseClient(url, key) {
  const settings = getSettings();
  const targetUrl = url || settings.supabase_url;
  const targetKey = key || settings.supabase_anon_key;

  if (!targetUrl || !targetKey) return null;

  if (
    supabaseClient &&
    currentClientConfig.url === targetUrl &&
    currentClientConfig.key === targetKey
  ) {
    return supabaseClient;
  }

  try {
    supabaseClient = createClient(targetUrl, targetKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    currentClientConfig = { url: targetUrl, key: targetKey };
    return supabaseClient;
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
}

async function testConnection(credentials = {}) {
  const settings = getSettings();
  const url = credentials.url || settings.supabase_url;
  const key = credentials.key || settings.supabase_anon_key;

  if (!url || !key) {
    return { success: false, error: 'Supabase URL and Anon Key are required.' };
  }

  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client
      .from('transactions')
      .select('id', { count: 'exact', head: true });

    if (error) {
      if (
        error.code === 'PGRST301' ||
        (error.message && error.message.includes('transactions'))
      ) {
        return {
          success: true,
          message: 'Connection successful! (transactions table reached)',
        };
      }
      return { success: false, error: error.message || 'Failed to connect to Supabase' };
    }
    return { success: true, message: 'Connection successful!' };
  } catch (err) {
    return { success: false, error: err.message || 'Connection test failed' };
  }
}

async function syncNow() {
  const settings = getSettings();
  if (!settings.cloud_sync_enabled) {
    syncStatus.status = 'offline';
    syncStatus.error = null;
    broadcastSyncStatus();
    return { success: false, error: 'Cloud sync is disabled in settings' };
  }

  const client = getSupabaseClient();
  if (!client) {
    syncStatus.status = 'error';
    syncStatus.error = 'Supabase URL and Anon Key are not properly configured.';
    broadcastSyncStatus();
    return { success: false, error: syncStatus.error };
  }

  syncStatus.status = 'syncing';
  syncStatus.error = null;
  broadcastSyncStatus();

  try {
    // 1. Pull remote transactions first to check conflicts
    const { data: remoteTxs, error: pullError } = await client
      .from('transactions')
      .select('*');

    if (pullError) {
      throw new Error(`Failed to pull remote data: ${pullError.message}`);
    }

    // 2. Process Pending Queue (Push local changes)
    let queue = getPendingQueue();
    const remainingQueue = [];

    for (const item of queue) {
      try {
        if (item.action === 'UPSERT') {
          const { error: upsertErr } = await client
            .from('transactions')
            .upsert(item.data);
          if (upsertErr) {
            console.error('Error pushing upsert item:', upsertErr);
            remainingQueue.push(item);
          }
        } else if (item.action === 'DELETE') {
          const { error: deleteErr } = await client
            .from('transactions')
            .delete()
            .eq('id', item.id);
          if (deleteErr) {
            console.error('Error pushing delete item:', deleteErr);
            remainingQueue.push(item);
          }
        }
      } catch (itemErr) {
        console.error('Queue item processing error:', itemErr);
        remainingQueue.push(item);
      }
    }

    setPendingQueue(remainingQueue);

    // 3. Process Remote Data & Conflict Resolution (Newest record wins by updated_at)
    const localTxs = getTransactions();
    const localTxMap = new Map(localTxs.map((t) => [t.id, t]));
    const pendingDeleteIds = new Set(
      remainingQueue.filter((q) => q.action === 'DELETE').map((q) => q.id)
    );
    const pendingUpsertIds = new Set(
      remainingQueue.filter((q) => q.action === 'UPSERT').map((q) => q.data.id)
    );

    let updatedLocalTxs = [...localTxs];
    let localChanged = false;

    if (remoteTxs && Array.isArray(remoteTxs)) {
      const remoteIds = new Set(remoteTxs.map(t => t.id));

      if (!settings.last_sync_time) {
        // Initial sync: Push all local transactions to Supabase
        for (const localItem of localTxs) {
          if (!remoteIds.has(localItem.id) && !pendingDeleteIds.has(localItem.id)) {
            const { error: pushErr } = await client.from('transactions').upsert(localItem);
            if (!pushErr) {
              remoteIds.add(localItem.id);
            } else {
              console.error('Initial sync push error:', pushErr);
            }
          }
        }
      } else {
        // Subsequent syncs: Handle remote deletions
        for (const localItem of localTxs) {
          if (!remoteIds.has(localItem.id) && !pendingUpsertIds.has(localItem.id)) {
            // Local item missing from remote, and not pending to be uploaded -> deleted on remote
            updatedLocalTxs = updatedLocalTxs.filter((t) => t.id !== localItem.id);
            localChanged = true;
          }
        }
      }

      for (const remoteItem of remoteTxs) {
        if (pendingDeleteIds.has(remoteItem.id)) continue;

        const localItem = localTxMap.get(remoteItem.id);
        if (!localItem) {
          // New record from cloud -> insert to local electron-store
          // But only if it's not a fresh install pushing everything... wait, if it's fresh install, we want to download remote items too
          updatedLocalTxs.push(remoteItem);
          localChanged = true;
        } else {
          // Conflict Resolution: compare updated_at timestamps
          const remoteTime = new Date(
            remoteItem.updated_at || remoteItem.created_at || 0
          ).getTime();
          const localTime = new Date(
            localItem.updated_at || localItem.created_at || 0
          ).getTime();

          if (remoteTime > localTime) {
            // Cloud record is newer -> update local
            const index = updatedLocalTxs.findIndex((t) => t.id === remoteItem.id);
            if (index !== -1) {
              updatedLocalTxs[index] = remoteItem;
              localChanged = true;
            }
          } else if (localTime > remoteTime) {
            // Local record is newer -> push local record to cloud if not already in queue
            const inQueue = pendingUpsertIds.has(localItem.id);
            if (!inQueue) {
              await client.from('transactions').upsert(localItem);
            }
          }
        }
      }

      if (localChanged) {
        setTransactions(updatedLocalTxs);
      }
    }

    // 4. Update last_sync_time
    const nowIso = new Date().toISOString();
    updateSettingsInStore({ last_sync_time: nowIso });

    const finalQueue = getPendingQueue();
    if (finalQueue.length > 0) {
      syncStatus.status = 'pending';
      syncStatus.error = 'Some pending items could not be pushed to cloud.';
    } else {
      syncStatus.status = 'synced';
      syncStatus.error = null;
    }

    broadcastSyncStatus();
    return { success: true, lastSyncTime: nowIso };
  } catch (err) {
    console.error('Sync failed:', err);
    syncStatus.status = 'error';
    syncStatus.error = err.message || 'Sync failed due to network or server error.';
    broadcastSyncStatus();
    return { success: false, error: syncStatus.error };
  }
}

function startAutoSync() {
  if (autoSyncInterval) clearInterval(autoSyncInterval);
  // Auto sync every 30 seconds
  autoSyncInterval = setInterval(() => {
    const settings = getSettings();
    if (settings.cloud_sync_enabled) {
      syncNow();
    }
  }, 30 * 1000);
}

function stopAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
}

module.exports = {
  setMainWindow,
  getSyncStatus,
  testConnection,
  syncNow,
  startAutoSync,
  stopAutoSync,
  broadcastSyncStatus,
};
