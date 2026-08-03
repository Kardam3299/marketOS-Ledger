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
  getCurrentBusinessContext,
} = require('./database.cjs');

let supabaseClient = null;
let currentClientConfig = { url: '', key: '', token: '' };
let autoSyncInterval = null;
let mainWindowRef = null;
let authSession = null;

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

function setAuthSession(session) {
  authSession = session;
  // Clear the client so it gets re-instantiated with the new token
  supabaseClient = null;
  currentClientConfig.token = session ? session.access_token : '';
}

function clearAuthSession() {
  authSession = null;
  supabaseClient = null;
  currentClientConfig.token = '';
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
  const targetToken = authSession ? authSession.access_token : '';

  if (!targetUrl || !targetKey) return null;

  if (
    supabaseClient &&
    currentClientConfig.url === targetUrl &&
    currentClientConfig.key === targetKey &&
    currentClientConfig.token === targetToken
  ) {
    return supabaseClient;
  }

  try {
    const options = {
      auth: { persistSession: false, autoRefreshToken: false },
    };
    if (targetToken) {
      options.global = { headers: { Authorization: `Bearer ${targetToken}` } };
    }
    supabaseClient = createClient(targetUrl, targetKey, options);
    currentClientConfig = { url: targetUrl, key: targetKey, token: targetToken };
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
          let upsertPayload = { ...item.data };
          if (!upsertPayload.business_id) {
            const ctx = getCurrentBusinessContext();
            let bizId = ctx?.businessId;
            let uId = ctx?.userId;

            if (!bizId) {
              try {
                const { data: member } = await client
                  .from('business_members')
                  .select('business_id, profile_id')
                  .eq('status', 'active')
                  .limit(1)
                  .maybeSingle();

                if (member) {
                  bizId = member.business_id;
                  uId = uId || member.profile_id;
                }
              } catch (e) {
                console.error('Error fetching member business_id:', e);
              }
            }

            if (bizId) {
              upsertPayload.business_id = bizId;
              upsertPayload.created_by = upsertPayload.created_by || uId || null;
              upsertPayload.updated_by = upsertPayload.updated_by || uId || null;
              upsertPayload.is_deleted = upsertPayload.is_deleted ?? false;
              item.data = { ...upsertPayload };
            }
          }

          const { error: upsertErr } = await client
            .from('transactions')
            .upsert(upsertPayload);
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

    // 3. Process Remote Data & Bi-Directional Synchronization
    const localTxs = getTransactions();
    const ctx = getCurrentBusinessContext();

    if (remoteTxs && Array.isArray(remoteTxs)) {
      const remoteTxMap = new Map(remoteTxs.map((t) => [t.id, t]));
      const localTxMap = new Map(localTxs.map((t) => [t.id, t]));
      let updatedLocalTxs = [...localTxs];
      let localChanged = false;

      // A) Ensure all active local transactions exist on Supabase (Push missing local items)
      for (const localItem of localTxs) {
        if (localItem.is_deleted) continue;

        const remoteItem = remoteTxMap.get(localItem.id);
        if (!remoteItem) {
          const bizId = localItem.business_id || ctx?.businessId || null;
          const uId = localItem.created_by || ctx?.userId || null;
          const payload = {
            ...localItem,
            business_id: bizId,
            created_by: uId,
            updated_by: uId,
            is_deleted: false,
          };
          const { error: pushErr } = await client.from('transactions').upsert(payload);
          if (pushErr) {
            console.error('Error pushing local transaction to cloud:', pushErr);
          }
        }
      }

      // B) Sync remote transactions to local store
      for (const remoteItem of remoteTxs) {
        const localItem = localTxMap.get(remoteItem.id);

        if (remoteItem.is_deleted) {
          if (localItem && !localItem.is_deleted) {
            const index = updatedLocalTxs.findIndex((t) => t.id === remoteItem.id);
            if (index !== -1) {
              updatedLocalTxs[index] = { ...localItem, is_deleted: true };
              localChanged = true;
            }
          }
          continue;
        }

        if (!localItem) {
          updatedLocalTxs.push(remoteItem);
          localChanged = true;
        } else {
          const remoteTime = new Date(
            remoteItem.updated_at || remoteItem.created_at || 0
          ).getTime();
          const localTime = new Date(
            localItem.updated_at || localItem.created_at || 0
          ).getTime();

          if (remoteTime > localTime) {
            const index = updatedLocalTxs.findIndex((t) => t.id === remoteItem.id);
            if (index !== -1) {
              updatedLocalTxs[index] = remoteItem;
              localChanged = true;
            }
          } else if (localTime > remoteTime) {
            const bizId = localItem.business_id || ctx?.businessId || null;
            const uId = localItem.updated_by || ctx?.userId || null;
            const payload = {
              ...localItem,
              business_id: bizId,
              updated_by: uId,
            };
            await client.from('transactions').upsert(payload);
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
      broadcastSyncStatus();
      return { success: false, error: syncStatus.error };
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
  setAuthSession,
  clearAuthSession,
};
