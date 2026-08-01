const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Mock app
app.getPath = () => path.join(__dirname, 'test-userData');

const { 
  handleAddTransaction,
  handleGetTransactions,
} = require('./electron/ipcHandlers.cjs');

const { initializeDatabase, updateSettingsInStore, getPendingQueue } = require('./electron/database.cjs');
const { syncNow, getSyncStatus } = require('./electron/syncService.cjs');

async function runTests() {
  console.log('Initializing DB for sync test...');
  initializeDatabase();
  
  updateSettingsInStore({ 
    cloud_sync_enabled: true, 
    supabase_url: 'http://localhost:3000', 
    supabase_anon_key: 'test',
    last_sync_time: null
  });

  console.log('Running initial sync...');
  const res1 = await syncNow();
  if (!res1.success) throw new Error('Initial sync failed: ' + res1.error);
  
  const txs = handleGetTransactions(null, {});
  console.log(`Transactions after initial sync: ${txs.data.length}. Should contain "mock-1" from server plus local items.`);
  
  const hasMock = txs.data.find(t => t.id === 'mock-1');
  if (!hasMock) throw new Error('Failed to pull remote transaction');
  console.log('Successfully pulled remote transaction');

  console.log('Adding new local transaction...');
  handleAddTransaction(null, {
    date: '2026-08-01',
    type: 'income',
    category: 'Sales',
    amount: 999,
    payment_mode: 'Cash',
    description: 'Local sync test transaction'
  });
  
  let queue = getPendingQueue();
  console.log('Pending queue length before sync:', queue.length);

  console.log('Running second sync...');
  const res2 = await syncNow();
  if (!res2.success) throw new Error('Second sync failed: ' + res2.error);
  
  queue = getPendingQueue();
  console.log('Pending queue length after sync (should be 0):', queue.length);
  if (queue.length !== 0) throw new Error('Queue not cleared');
  
  console.log('Sync test completed successfully!');
  process.exit(0);
}

runTests().catch(console.error);
