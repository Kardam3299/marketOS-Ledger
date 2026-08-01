const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { initializeDatabase, closeDatabase } = require('./database.cjs');
const {
  handleAddTransaction,
  handleGetTransactions,
  handleDeleteTransaction,
  handleUpdateTransaction,
  handleGetSettings,
  handleUpdateSettings,
  handleUpdateSyncSettings,
  handleGetSyncStatus,
  handleTriggerSync,
  handleTestSyncConnection,
  handleNotifyOnline,
  handleBackupDatabase,
  handleRestoreDatabase,
  handleResetDatabase,
  handleGetDashboardStats,
  handleGetReportData,
} = require('./ipcHandlers.cjs');
const {
  setMainWindow,
  startAutoSync,
  stopAutoSync,
  syncNow,
  broadcastSyncStatus,
} = require('./syncService.cjs');

let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../assets/icon.ico'),
  });

  setMainWindow(mainWindow);

  const isDev = process.env.NODE_ENV === 'development' || 
                process.env.ELECTRON_DEV === 'true' ||
                !fs.existsSync(path.join(__dirname, '../dist'));

  if (isDev) {
    // Development: load from local dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load from built files
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// Initialize database and set up IPC handlers
const initializeApp = () => {
  initializeDatabase();

  // Transaction handlers
  ipcMain.handle('add-transaction', handleAddTransaction);
  ipcMain.handle('get-transactions', handleGetTransactions);
  ipcMain.handle('delete-transaction', handleDeleteTransaction);
  ipcMain.handle('update-transaction', handleUpdateTransaction);
  ipcMain.handle('get-dashboard-stats', handleGetDashboardStats);
  ipcMain.handle('get-report-data', handleGetReportData);

  // Settings handlers
  ipcMain.handle('get-settings', handleGetSettings);
  ipcMain.handle('update-settings', handleUpdateSettings);
  ipcMain.handle('update-sync-settings', handleUpdateSyncSettings);

  // Cloud Sync handlers
  ipcMain.handle('get-sync-status', handleGetSyncStatus);
  ipcMain.handle('trigger-sync', handleTriggerSync);
  ipcMain.handle('test-sync-connection', handleTestSyncConnection);
  ipcMain.handle('notify-online', handleNotifyOnline);

  // Backup/Restore handlers
  ipcMain.handle('backup-database', handleBackupDatabase);
  ipcMain.handle('restore-database', handleRestoreDatabase);
  ipcMain.handle('reset-database', handleResetDatabase);
};

app.on('ready', () => {
  initializeApp();
  createWindow();
  createMenu();
  startAutoSync();
  // Trigger initial sync on startup
  setTimeout(() => {
    broadcastSyncStatus();
    syncNow().catch((err) => console.error('Startup sync error:', err));
  }, 1000);
});

app.on('window-all-closed', () => {
  stopAutoSync();
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

const createMenu = () => {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Exit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About MarketOS Ledger' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};
