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

  // Backup/Restore API
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  restoreDatabase: () => ipcRenderer.invoke('restore-database'),
  resetDatabase: () => ipcRenderer.invoke('reset-database'),
});
