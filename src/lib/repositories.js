import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrBefore);

const isElectron = typeof window !== 'undefined' && Boolean(window.api);

let supabase = null;
if (!isElectron) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
}

export const api = {
  getTransactions: async (filters = {}) => {
    if (isElectron) return window.api.getTransactions(filters);
    
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    try {
      let query = supabase.from('transactions').select('*');
      
      if (filters.type && filters.type !== 'all') {
        query = query.eq('type', filters.type);
      }
      if (filters.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }
      if (filters.startDate && filters.endDate) {
        query = query.gte('date', filters.startDate).lte('date', filters.endDate);
      }
      if (filters.search) {
        query = query.or(`description.ilike.%${filters.search}%,category.ilike.%${filters.search}%`);
      }
      
      query = query.order('date', { ascending: false }).order('created_at', { ascending: false });
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  addTransaction: async (tx) => {
    if (isElectron) return window.api.addTransaction(tx);
    
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    try {
      const { data, error } = await supabase.from('transactions').insert([{
         ...tx,
         id: crypto.randomUUID(),
         created_at: new Date().toISOString(),
         updated_at: new Date().toISOString()
      }]).select();
      if (error) throw error;
      return { success: true, id: data[0].id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  updateTransaction: async (id, tx) => {
    if (isElectron) return window.api.updateTransaction(id, tx);

    if (!supabase) return { success: false, error: 'Supabase not configured' };
    try {
      const { error } = await supabase.from('transactions').update({
         ...tx,
         updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  deleteTransaction: async (id) => {
    if (isElectron) return window.api.deleteTransaction(id);

    if (!supabase) return { success: false, error: 'Supabase not configured' };
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  getDashboardStats: async () => {
    if (isElectron) return window.api.getDashboardStats();

    if (!supabase) return { success: false, error: 'Supabase not configured' };
    try {
      const { data: allTxs, error } = await supabase.from('transactions').select('*');
      if (error) throw error;

      let totalIncome = 0;
      let totalExpense = 0;
      let todayIncome = 0;
      let todayExpense = 0;
      
      const today = dayjs().format('YYYY-MM-DD');

      allTxs.forEach(tx => {
        if (tx.type === 'income') {
          totalIncome += tx.amount;
          if (tx.date === today) todayIncome += tx.amount;
        } else {
          totalExpense += tx.amount;
          if (tx.date === today) todayExpense += tx.amount;
        }
      });

      const recentTransactions = allTxs
        .sort((a, b) => {
          if (a.date === b.date) {
             return b.updated_at.localeCompare(a.updated_at);
          }
          return b.date.localeCompare(a.date);
        })
        .slice(0, 5);

      return {
        success: true,
        data: {
          totalIncome,
          totalExpense,
          profit: totalIncome - totalExpense,
          todayIncome,
          todayExpense,
          todayProfit: todayIncome - todayExpense,
          recentTransactions
        }
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  getReportData: async (filters) => {
    if (isElectron) return window.api.getReportData(filters);
    
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    try {
      const { startDate, endDate } = filters;
      const { data: txs, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);
        
      if (error) throw error;

      let totalIncome = 0;
      let totalExpense = 0;
      const byCategory = {};
      const byDate = {};

      txs.forEach(tx => {
        if (tx.type === 'income') {
          totalIncome += tx.amount;
        } else {
          totalExpense += tx.amount;
        }

        if (!byCategory[tx.category]) {
          byCategory[tx.category] = { amount: 0, type: tx.type, count: 0 };
        }
        byCategory[tx.category].amount += tx.amount;
        byCategory[tx.category].count += 1;

        if (!byDate[tx.date]) {
          byDate[tx.date] = { income: 0, expense: 0, count: 0 };
        }
        if (tx.type === 'income') {
          byDate[tx.date].income += tx.amount;
        } else {
          byDate[tx.date].expense += tx.amount;
        }
        byDate[tx.date].count += 1;
      });

      return {
        success: true,
        data: {
          transactions: txs,
          totalIncome,
          totalExpense,
          profit: totalIncome - totalExpense,
          transactionCount: txs.length,
          byCategory,
          byDate
        }
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  getSettings: async () => {
    if (isElectron) return window.api.getSettings();

    if (!supabase) return { success: false, error: 'Supabase not configured' };
    try {
      const { data, error } = await supabase.from('settings').select('*').limit(1).single();
      if (error && error.code !== 'PGRST116') throw error; 
      return { success: true, data: data || {} };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  updateSettings: async (settings) => {
    if (isElectron) return window.api.updateSettings(settings);

    if (!supabase) return { success: false, error: 'Supabase not configured' };
    try {
      const { data: existing, error: fetchErr } = await supabase.from('settings').select('id').limit(1).single();
      let error;
      if (existing && !fetchErr) {
        const res = await supabase.from('settings').update({
           ...settings,
           updated_at: new Date().toISOString()
        }).eq('id', existing.id);
        error = res.error;
      } else {
        const res = await supabase.from('settings').insert([{
           ...settings,
           id: 1,
           created_at: new Date().toISOString(),
           updated_at: new Date().toISOString()
        }]);
        error = res.error;
      }
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  updateSyncSettings: async (settings) => {
    if (isElectron) return window.api.updateSyncSettings(settings);
    return { success: true }; 
  },

  getSyncStatus: async () => {
    if (isElectron) return window.api.getSyncStatus();
    return { success: true, data: { status: 'idle', pendingCount: 0, lastSyncTime: new Date().toISOString() } };
  },

  triggerSync: async () => {
    if (isElectron) return window.api.triggerSync();
    return { success: true };
  },

  testSyncConnection: async (credentials) => {
    if (isElectron) return window.api.testSyncConnection(credentials);
    if (supabase) return { success: true, message: 'Connected to Supabase (Web Mode)' };
    return { success: false, error: 'Not configured' };
  },

  notifyOnline: () => {
    if (isElectron && window.api.notifyOnline) window.api.notifyOnline();
  },

  onSyncStatusChange: (cb) => {
    if (isElectron && window.api.onSyncStatusChange) return window.api.onSyncStatusChange(cb);
    return () => {};
  },

  backupDatabase: async () => {
    if (isElectron) return window.api.backupDatabase();
    return { success: false, error: 'Database backup is not available in Web Mode' };
  },
  
  restoreDatabase: async () => {
    if (isElectron) return window.api.restoreDatabase();
    return { success: false, error: 'Database restore is not available in Web Mode' };
  },

  resetDatabase: async () => {
    if (isElectron) return window.api.resetDatabase();
    
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    try {
      await supabase.from('transactions').delete().neq('id', '0');
      return { success: true, message: 'Database reset successfully' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
