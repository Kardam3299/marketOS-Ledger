const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Transaction API
  addTransaction: (transaction) => ipcRenderer.invoke('add-transaction', transaction),
  getTransactions: (filters) => ipcRenderer.invoke('get-transactions', filters),
  deleteTransaction: (id) => ipcRenderer.invoke('delete-transaction', id),
  updateTransaction: (id, transaction) => ipcRenderer.invoke('update-transaction', id, transaction),
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
  getReportData: (filters) => ipcRenderer.invoke('get-report-data', filters),

  // Settings API
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
  updateSyncSettings: (syncSettings) => ipcRenderer.invoke('update-sync-settings', syncSettings),

  // Cloud Sync API
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
  triggerSync: () => ipcRenderer.invoke('trigger-sync'),
  testSyncConnection: (credentials) => ipcRenderer.invoke('test-sync-connection', credentials),
  notifyOnline: () => ipcRenderer.invoke('notify-online'),
  clearPendingQueue: () => ipcRenderer.invoke('clear-pending-queue'),
  onSyncStatusChange: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('sync-status-changed', handler);
    return () => ipcRenderer.removeListener('sync-status-changed', handler);
  },

  // Backup/Restore API
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  restoreDatabase: () => ipcRenderer.invoke('restore-database'),
  resetDatabase: () => ipcRenderer.invoke('reset-database'),

  // Authentication
  setAuthSession: (session, profile) => ipcRenderer.send('set-auth-session', { session, profile }),
  clearAuthSession: () => ipcRenderer.send('clear-auth-session'),
});
