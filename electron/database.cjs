const Store = require('electron-store');
const path = require('path');
const { app } = require('electron');
const { randomUUID } = require('crypto');

let store = null;

const defaultSettings = {
  id: 1,
  business_name: 'My Business',
  owner_name: 'Owner',
  currency: 'USD',
  cloud_sync_enabled: false,
  supabase_url: '',
  supabase_anon_key: '',
  last_sync_time: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const getDbPath = () => {
  if (!store) initializeDatabase();
  return store.path;
};

const initializeDatabase = () => {
  if (store) return store;

  const userDataPath = app.getPath('userData');
  store = new Store({
    cwd: userDataPath,
    name: 'ledger',
    fileExtension: 'db',
    defaults: {
      transactions: [],
      settings: defaultSettings,
      pendingQueue: [],
    },
  });

  if (!store.has('transactions')) {
    store.set('transactions', []);
  } else {
    // Migration: convert numeric IDs to UUID string format if any exist
    const txs = store.get('transactions', []);
    let modified = false;
    const migratedTxs = txs.map((tx) => {
      if (typeof tx.id === 'number' || !tx.id || typeof tx.id !== 'string') {
        modified = true;
        return { ...tx, id: randomUUID() };
      }
      return tx;
    });
    if (modified) {
      store.set('transactions', migratedTxs);
    }
  }

  if (!store.has('settings')) {
    store.set('settings', defaultSettings);
  }

  if (!store.has('pendingQueue')) {
    store.set('pendingQueue', []);
  }

  console.log('Database initialized successfully at:', store.path);
  return store;
};

const getTransactions = () => store.get('transactions', []);
const setTransactions = (transactions) => store.set('transactions', transactions);

const generateUuid = () => randomUUID();

const getSettings = () => store.get('settings', defaultSettings);

const updateSettingsInStore = (newSettings) => {
  const current = getSettings();
  const updated = {
    ...current,
    ...newSettings,
    updated_at: new Date().toISOString(),
  };
  store.set('settings', updated);
  return updated;
};

const getPendingQueue = () => store.get('pendingQueue', []);
const setPendingQueue = (queue) => store.set('pendingQueue', queue);

const addToPendingQueue = (action, item) => {
  const queue = getPendingQueue();

  if (action === 'UPSERT' && item && item.id) {
    const existingIdx = queue.findIndex(
      (q) => q.action === 'UPSERT' && q.data && q.data.id === item.id
    );
    if (existingIdx !== -1) {
      queue[existingIdx] = {
        action: 'UPSERT',
        data: item,
        timestamp: new Date().toISOString(),
      };
      setPendingQueue(queue);
      return;
    }
  }

  if (action === 'DELETE' && item && item.id) {
    const filteredQueue = queue.filter(
      (q) => !(q.action === 'UPSERT' && q.data && q.data.id === item.id)
    );
    filteredQueue.push({
      action: 'DELETE',
      id: item.id,
      timestamp: new Date().toISOString(),
    });
    setPendingQueue(filteredQueue);
    return;
  }

  queue.push({
    action,
    data: item,
    timestamp: new Date().toISOString(),
  });
  setPendingQueue(queue);
};

const createStatement = (query) => {
  const normalized = query.replace(/\s+/g, ' ').trim().toLowerCase();

  const queryTransactions = () => {
    let results = [...getTransactions()];
    const values = [];
    const matches = normalized.match(/\?+/g) || [];
    // preserve parameter order
    return {
      filter: (mapper) => {
        const params = [...arguments[0]];
      },
    };
  };

  const applyTransactionFilters = (params) => {
    let results = [...getTransactions()];
    const values = [...params];

    if (normalized.includes('and type = ?')) {
      const type = values.shift();
      results = results.filter((transaction) => transaction.type === type);
    }

    if (normalized.includes('and date between ? and ?')) {
      const startDate = values.shift();
      const endDate = values.shift();
      results = results.filter(
        (transaction) => transaction.date >= startDate && transaction.date <= endDate
      );
    }

    if (normalized.includes('and category = ?')) {
      const category = values.shift();
      results = results.filter((transaction) => transaction.category === category);
    }

    if (normalized.includes('(description like ? or category like ?)')) {
      const searchText = values.shift().replace(/%/g, '').toLowerCase();
      values.shift();
      results = results.filter(
        (transaction) =>
          transaction.description.toLowerCase().includes(searchText) ||
          transaction.category.toLowerCase().includes(searchText)
      );
    }

    if (normalized.includes('order by date desc, created_at desc')) {
      results.sort((a, b) => {
        if (a.date === b.date) {
          return a.updated_at < b.updated_at ? 1 : -1;
        }
        return a.date < b.date ? 1 : -1;
      });
    }

    if (normalized.includes('order by date asc')) {
      results.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
    }

    if (normalized.includes('limit 10')) {
      results = results.slice(0, 10);
    }

    return results;
  };

  return {
    run: (...params) => {
      if (normalized.startsWith('insert into transactions')) {
        const [date, type, category, amount, payment_mode, description, created_at, updated_at] = params;
        const newId = randomUUID();
        const transaction = {
          id: newId,
          date,
          type,
          category,
          amount,
          payment_mode,
          description,
          created_at,
          updated_at,
        };
        const transactions = [...getTransactions(), transaction];
        setTransactions(transactions);
        return { lastInsertRowid: transaction.id };
      }

      if (normalized.startsWith('delete from transactions where id = ?')) {
        const [id] = params;
        const transactions = getTransactions().filter((transaction) => transaction.id !== id);
        setTransactions(transactions);
        return { changes: 1 };
      }

      if (normalized === 'delete from transactions') {
        const oldCount = getTransactions().length;
        setTransactions([]);
        return { changes: oldCount };
      }

      if (normalized.startsWith('update transactions')) {
        const [date, type, category, amount, payment_mode, description, updated_at, id] = params;
        const transactions = getTransactions().map((transaction) => {
          if (transaction.id !== id) return transaction;
          return {
            ...transaction,
            date,
            type,
            category,
            amount,
            payment_mode,
            description,
            updated_at,
          };
        });
        setTransactions(transactions);
        return { changes: 1 };
      }

      if (normalized.startsWith('update settings')) {
        const [business_name, owner_name, currency, updated_at] = params;
        const settings = getSettings();
        store.set('settings', {
          ...settings,
          business_name,
          owner_name,
          currency,
          updated_at,
        });
        return { changes: 1 };
      }

      throw new Error(`Unsupported query: ${query}`);
    },
    get: (...params) => {
      if (normalized.startsWith('select coalesce(sum(amount), 0) as total from transactions where type = ? and date = ?')) {
        const [type, date] = params;
        const total = getTransactions()
          .filter((transaction) => transaction.type === type && transaction.date === date)
          .reduce((sum, transaction) => sum + transaction.amount, 0);
        return { total };
      }

      if (normalized.startsWith('select coalesce(sum(amount), 0) as total from transactions where type = ?')) {
        const [type] = params;
        const total = getTransactions()
          .filter((transaction) => transaction.type === type)
          .reduce((sum, transaction) => sum + transaction.amount, 0);
        return { total };
      }

      if (normalized.startsWith('select * from settings limit 1')) {
        return getSettings();
      }

      throw new Error(`Unsupported query: ${query}`);
    },
    all: (...params) => {
      if (normalized.startsWith('select * from transactions')) {
        return applyTransactionFilters(params);
      }

      throw new Error(`Unsupported query: ${query}`);
    },
  };
};

const getDatabase = () => {
  if (!store) {
    initializeDatabase();
  }
  return {
    prepare: createStatement,
  };
};

const closeDatabase = () => {
  store = null;
};

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  getDbPath,
  getTransactions,
  setTransactions,
  getSettings,
  updateSettingsInStore,
  getPendingQueue,
  setPendingQueue,
  addToPendingQueue,
};
