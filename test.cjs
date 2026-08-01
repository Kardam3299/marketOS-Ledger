const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Mock app
app.getPath = () => path.join(__dirname, 'test-userData');
if (!fs.existsSync(app.getPath())) {
  fs.mkdirSync(app.getPath());
}

const { 
  handleAddTransaction,
  handleGetTransactions,
  handleGetDashboardStats,
  handleResetDatabase,
  handleBackupDatabase
} = require('./electron/ipcHandlers.cjs');

const { initializeDatabase, getSettings, updateSettingsInStore, getPendingQueue } = require('./electron/database.cjs');

async function runTests() {
  console.log('Initializing DB...');
  initializeDatabase();
  
  // Test Settings
  updateSettingsInStore({ 
    cloud_sync_enabled: true, 
    supabase_url: 'http://localhost', 
    supabase_anon_key: 'test' 
  });
  console.log('Settings updated.');

  // Test Add Income
  console.log('Testing Add Income...');
  const income = {
    date: '2026-08-01',
    type: 'income',
    category: 'Sales',
    amount: 1500,
    payment_mode: 'Cash',
    description: 'Test Income'
  };
  const incomeRes = handleAddTransaction(null, income);
  if (!incomeRes.success) throw new Error('Add Income Failed');
  console.log('Added Income:', incomeRes.id);

  // Test Add Expense
  console.log('Testing Add Expense...');
  const expense = {
    date: '2026-08-01',
    type: 'expense',
    category: 'Rent',
    amount: 500,
    payment_mode: 'Card',
    description: 'Test Expense'
  };
  const expenseRes = handleAddTransaction(null, expense);
  if (!expenseRes.success) throw new Error('Add Expense Failed');
  console.log('Added Expense:', expenseRes.id);

  // Test Transactions list
  const txs = handleGetTransactions(null, {});
  if (txs.data.length !== 2) throw new Error(`Expected 2 transactions, got ${txs.data.length}`);
  console.log('Transactions retrieved:', txs.data.length);

  // Test Reports / Dashboard
  const stats = handleGetDashboardStats(null);
  if (stats.data.totalIncome !== 1500 || stats.data.totalExpense !== 500) {
    throw new Error('Stats calculation failed');
  }
  console.log('Stats calculated successfully. Profit:', stats.data.profit);

  // Test Reset Database
  console.log('Testing Reset Database...');
  const resetRes = handleResetDatabase(null);
  if (!resetRes.success) throw new Error('Reset failed');
  
  const txsAfter = handleGetTransactions(null, {});
  if (txsAfter.data.length !== 0) throw new Error('Reset failed to clear DB');
  
  const queue = getPendingQueue();
  const deletes = queue.filter(q => q.action === 'DELETE');
  if (deletes.length !== 2) throw new Error(`Expected 2 DELETE queued, got ${deletes.length}`);
  console.log('Reset successful, queued deletes:', deletes.length);

  console.log('All tests passed successfully!');
  process.exit(0);
}

runTests().catch(console.error);
