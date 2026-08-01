const { getDatabase, addToPendingQueue, getSettings, updateSettingsInStore } = require('./database.cjs');
const { getSyncStatus, testConnection, syncNow, broadcastSyncStatus } = require('./syncService.cjs');
const dayjs = require('dayjs');
const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');

// Transaction Handlers
const handleAddTransaction = (event, transaction) => {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO transactions (date, type, category, amount, payment_mode, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = dayjs().toISOString();
    const result = stmt.run(
      transaction.date,
      transaction.type,
      transaction.category,
      transaction.amount,
      transaction.payment_mode,
      transaction.description || '',
      now,
      now
    );

    const insertedTransaction = {
      id: result.lastInsertRowid,
      date: transaction.date,
      type: transaction.type,
      category: transaction.category,
      amount: transaction.amount,
      payment_mode: transaction.payment_mode,
      description: transaction.description || '',
      created_at: now,
      updated_at: now,
    };

    addToPendingQueue('UPSERT', insertedTransaction);
    broadcastSyncStatus();

    const settings = getSettings();
    if (settings.cloud_sync_enabled) {
      syncNow().catch((err) => console.error('Auto sync error after add:', err));
    }

    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    console.error('Error adding transaction:', error);
    return { success: false, error: error.message };
  }
};

const handleGetTransactions = (event, filters = {}) => {
  try {
    const db = getDatabase();
    let query = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];

    if (filters.type) {
      query += ' AND type = ?';
      params.push(filters.type);
    }

    if (filters.startDate && filters.endDate) {
      query += ' AND date BETWEEN ? AND ?';
      params.push(filters.startDate, filters.endDate);
    }

    if (filters.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters.searchText) {
      query += ' AND (description LIKE ? OR category LIKE ?)';
      params.push(`%${filters.searchText}%`, `%${filters.searchText}%`);
    }

    query += ' ORDER BY date DESC, created_at DESC';

    const stmt = db.prepare(query);
    const transactions = stmt.all(...params);

    return { success: true, data: transactions };
  } catch (error) {
    console.error('Error getting transactions:', error);
    return { success: false, error: error.message };
  }
};

const handleDeleteTransaction = (event, id) => {
  try {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM transactions WHERE id = ?');
    stmt.run(id);

    addToPendingQueue('DELETE', { id });
    broadcastSyncStatus();

    const settings = getSettings();
    if (settings.cloud_sync_enabled) {
      syncNow().catch((err) => console.error('Auto sync error after delete:', err));
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return { success: false, error: error.message };
  }
};

const handleUpdateTransaction = (event, id, transaction) => {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE transactions 
      SET date = ?, type = ?, category = ?, amount = ?, payment_mode = ?, description = ?, updated_at = ?
      WHERE id = ?
    `);

    const now = dayjs().toISOString();
    stmt.run(
      transaction.date,
      transaction.type,
      transaction.category,
      transaction.amount,
      transaction.payment_mode,
      transaction.description || '',
      now,
      id
    );

    const updatedTransaction = {
      id,
      date: transaction.date,
      type: transaction.type,
      category: transaction.category,
      amount: transaction.amount,
      payment_mode: transaction.payment_mode,
      description: transaction.description || '',
      updated_at: now,
    };

    addToPendingQueue('UPSERT', updatedTransaction);
    broadcastSyncStatus();

    const settings = getSettings();
    if (settings.cloud_sync_enabled) {
      syncNow().catch((err) => console.error('Auto sync error after update:', err));
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating transaction:', error);
    return { success: false, error: error.message };
  }
};

// Dashboard Stats Handler
const handleGetDashboardStats = (event) => {
  try {
    const db = getDatabase();
    const today = dayjs().format('YYYY-MM-DD');
    const currentMonth = dayjs().format('YYYY-MM');
    const currentYear = dayjs().format('YYYY');

    // Total income
    const totalIncome = db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = ?'
    ).get('income').total;

    // Total expense
    const totalExpense = db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = ?'
    ).get('expense').total;

    // Today's income
    const todayIncome = db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = ? AND date = ?'
    ).get('income', today).total;

    // Today's expense
    const todayExpense = db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = ? AND date = ?'
    ).get('expense', today).total;

    // Recent transactions
    const recentTransactions = db.prepare(
      'SELECT * FROM transactions ORDER BY date DESC, created_at DESC LIMIT 10'
    ).all();

    const profit = totalIncome - totalExpense;
    const todayProfit = todayIncome - todayExpense;

    return {
      success: true,
      data: {
        totalIncome,
        totalExpense,
        profit,
        todayIncome,
        todayExpense,
        todayProfit,
        recentTransactions,
      },
    };
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    return { success: false, error: error.message };
  }
};

// Report Handler
const handleGetReportData = (event, filters = {}) => {
  try {
    const db = getDatabase();
    let query = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];

    if (filters.startDate && filters.endDate) {
      query += ' AND date BETWEEN ? AND ?';
      params.push(filters.startDate, filters.endDate);
    }

    const stmt = db.prepare(query + ' ORDER BY date ASC');
    const transactions = stmt.all(...params);

    // Calculate totals
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const profit = totalIncome - totalExpense;

    // Group by date
    const byDate = transactions.reduce((acc, t) => {
      if (!acc[t.date]) {
        acc[t.date] = { income: 0, expense: 0, count: 0 };
      }
      if (t.type === 'income') acc[t.date].income += t.amount;
      else acc[t.date].expense += t.amount;
      acc[t.date].count += 1;
      return acc;
    }, {});

    // Group by category
    const byCategory = transactions.reduce((acc, t) => {
      if (!acc[t.category]) {
        acc[t.category] = { type: t.type, amount: 0, count: 0 };
      }
      acc[t.category].amount += t.amount;
      acc[t.category].count += 1;
      return acc;
    }, {});

    return {
      success: true,
      data: {
        transactions,
        totalIncome,
        totalExpense,
        profit,
        transactionCount: transactions.length,
        byDate,
        byCategory,
      },
    };
  } catch (error) {
    console.error('Error getting report data:', error);
    return { success: false, error: error.message };
  }
};

// Settings Handlers
const handleGetSettings = (event) => {
  try {
    const settings = getSettings();
    return { success: true, data: settings };
  } catch (error) {
    console.error('Error getting settings:', error);
    return { success: false, error: error.message };
  }
};

const handleUpdateSettings = (event, newSettings) => {
  try {
    const updated = updateSettingsInStore(newSettings);
    broadcastSyncStatus();

    if (updated.cloud_sync_enabled) {
      syncNow().catch((err) => console.error('Auto sync error after settings update:', err));
    }

    return { success: true, data: updated };
  } catch (error) {
    console.error('Error updating settings:', error);
    return { success: false, error: error.message };
  }
};

const handleUpdateSyncSettings = (event, syncSettings) => {
  try {
    const updated = updateSettingsInStore({
      cloud_sync_enabled: syncSettings.cloud_sync_enabled,
      supabase_url: syncSettings.supabase_url,
      supabase_anon_key: syncSettings.supabase_anon_key,
    });
    broadcastSyncStatus();

    if (updated.cloud_sync_enabled) {
      syncNow().catch((err) => console.error('Auto sync error after sync settings update:', err));
    }

    return { success: true, data: updated };
  } catch (error) {
    console.error('Error updating sync settings:', error);
    return { success: false, error: error.message };
  }
};

// Cloud Sync Handlers
const handleGetSyncStatus = () => {
  return getSyncStatus();
};

const handleTriggerSync = async () => {
  return await syncNow();
};

const handleTestSyncConnection = async (event, credentials) => {
  return await testConnection(credentials);
};

const handleNotifyOnline = async () => {
  const settings = getSettings();
  if (settings.cloud_sync_enabled) {
    return await syncNow();
  }
  return { success: true, message: 'App online' };
};

// Backup and Restore Handlers
const handleBackupDatabase = (event) => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'ledger.db');
    const result = dialog.showSaveDialogSync({
      defaultPath: `ledger-backup-${dayjs().format('YYYY-MM-DD-HHmmss')}.db`,
      filters: [{ name: 'Database Files', extensions: ['db'] }],
    });

    if (result) {
      fs.copyFileSync(dbPath, result);
      return { success: true, path: result };
    }

    return { success: false, error: 'Backup cancelled' };
  } catch (error) {
    console.error('Error backing up database:', error);
    return { success: false, error: error.message };
  }
};

const handleRestoreDatabase = (event) => {
  try {
    const result = dialog.showOpenDialogSync({
      filters: [{ name: 'Database Files', extensions: ['db'] }],
    });

    if (result && result[0]) {
      const backupPath = result[0];
      const dbPath = path.join(app.getPath('userData'), 'ledger.db');
      
      fs.copyFileSync(backupPath, dbPath);
      
      return { success: true, message: 'Database restored successfully' };
    }

    return { success: false, error: 'Restore cancelled' };
  } catch (error) {
    console.error('Error restoring database:', error);
    return { success: false, error: error.message };
  }
};

const handleResetDatabase = (event) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM transactions').run();
    return { success: true, message: 'Database reset successfully' };
  } catch (error) {
    console.error('Error resetting database:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
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
};
