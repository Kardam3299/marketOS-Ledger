import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../context/ToastContext';

export function useSync() {
  const [syncStatus, setSyncStatus] = useState({
    status: 'offline', // 'synced', 'syncing', 'offline', 'pending', 'error'
    lastSyncTime: null,
    pendingCount: 0,
    error: null,
    enabled: false,
  });
  const [loading, setLoading] = useState(false);
  const { success, error: toastError } = useToast();

  const fetchStatus = useCallback(async () => {
    try {
      if (window.api && window.api.getSyncStatus) {
        const res = await window.api.getSyncStatus();
        if (res) setSyncStatus(res);
      }
    } catch (err) {
      console.error('Error getting sync status:', err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    if (window.api && window.api.onSyncStatusChange) {
      const unsubscribe = window.api.onSyncStatusChange((updatedStatus) => {
        if (updatedStatus) {
          setSyncStatus(updatedStatus);
        }
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, [fetchStatus]);

  useEffect(() => {
    const handleOnline = () => {
      if (window.api && window.api.notifyOnline) {
        window.api.notifyOnline();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const triggerSync = async () => {
    setLoading(true);
    try {
      if (!window.api || !window.api.triggerSync) {
        throw new Error('Sync API is not available');
      }
      const res = await window.api.triggerSync();
      if (res.success) {
        success('Cloud sync completed successfully');
      } else {
        toastError(res.error || 'Cloud sync failed');
      }
      await fetchStatus();
      return res;
    } catch (err) {
      toastError('Error triggering sync: ' + (err.message || err));
      console.error(err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (credentials) => {
    try {
      if (!window.api || !window.api.testSyncConnection) {
        return { success: false, error: 'IPC API not available' };
      }
      return await window.api.testSyncConnection(credentials);
    } catch (err) {
      return { success: false, error: err.message || 'Connection test failed' };
    }
  };

  const updateSyncSettings = async (syncSettings) => {
    try {
      if (!window.api || !window.api.updateSyncSettings) {
        return { success: false, error: 'IPC API not available' };
      }
      const res = await window.api.updateSyncSettings(syncSettings);
      await fetchStatus();
      return res;
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return {
    syncStatus,
    loading,
    triggerSync,
    testConnection,
    updateSyncSettings,
    fetchStatus,
  };
}
