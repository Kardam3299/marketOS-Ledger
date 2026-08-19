import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { supabase } from '../supabaseClient';
dayjs.extend(isSameOrBefore);

export class SupabaseRepository {
  constructor() {
    this.supabase = supabase;
  }

  async getBusinessContext() {
    if (!this.supabase) return null;
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (!session?.user) return null;
      
      // 1. Try active business membership
      const { data: member } = await this.supabase
        .from('business_members')
        .select('business_id, profile_id')
        .eq('profile_id', session.user.id)
        .eq('status', 'active')
        .maybeSingle();

      let businessId = member?.business_id;

      // 2. Fallback: Find business where email matches or oldest business
      if (!businessId) {
        const { data: bizByEmail } = await this.supabase
          .from('businesses')
          .select('id')
          .eq('email', session.user.email)
          .maybeSingle();

        businessId = bizByEmail?.id;

        if (!businessId) {
          const { data: firstBiz } = await this.supabase
            .from('businesses')
            .select('id')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          businessId = firstBiz?.id;
        }

        // Auto-link business_members if missing
        if (businessId) {
          try {
            await this.supabase.from('business_members').upsert({
              business_id: businessId,
              profile_id: session.user.id,
              role: 'owner',
              status: 'active'
            }, { onConflict: 'business_id,profile_id' });
          } catch {
            // Ignore if RLS restricts direct membership upsert
          }
        }
      }

      return {
        userId: session.user.id,
        businessId: businessId || null
      };
    } catch {
      return null;
    }
  }

  async getTransactions(filters = {}) {
    if (!this.supabase) return { success: false, error: 'Supabase not configured' };
    try {
      const ctx = await this.getBusinessContext();
      let query = this.supabase.from('transactions').select('*').or('is_deleted.is.null,is_deleted.eq.false');
      
      if (ctx?.businessId) {
        query = query.eq('business_id', ctx.businessId);
      }

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
      return { success: true, data: data || [] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async addTransaction(tx) {
    if (!this.supabase) return { success: false, error: 'Supabase not configured' };
    try {
      const ctx = await this.getBusinessContext();
      const insertData = {
        ...tx,
        id: tx.id || crypto.randomUUID(),
        business_id: tx.business_id || ctx?.businessId || null,
        created_by: tx.created_by || ctx?.userId || null,
        updated_by: tx.updated_by || ctx?.userId || null,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('transactions')
        .insert([insertData])
        .select();

      if (error) throw error;
      return { success: true, id: data[0].id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async updateTransaction(id, tx) {
    if (!this.supabase) return { success: false, error: 'Supabase not configured' };
    try {
      const ctx = await this.getBusinessContext();
      const { error } = await this.supabase.from('transactions').update({
         ...tx,
         updated_by: ctx?.userId || null,
         updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async deleteTransaction(id) {
    if (!this.supabase) return { success: false, error: 'Supabase not configured' };
    try {
      const ctx = await this.getBusinessContext();
      const { error } = await this.supabase.from('transactions').update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: ctx?.userId || null
      }).eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getDashboardStats() {
    if (!this.supabase) return { success: false, error: 'Supabase not configured' };
    try {
      const ctx = await this.getBusinessContext();
      let query = this.supabase.from('transactions').select('*').or('is_deleted.is.null,is_deleted.eq.false');
      if (ctx?.businessId) {
        query = query.eq('business_id', ctx.businessId);
      }

      const { data: allTxs, error } = await query;
      if (error) throw error;

      let totalIncome = 0;
      let totalExpense = 0;
      let todayIncome = 0;
      let todayExpense = 0;
      
      const today = dayjs().format('YYYY-MM-DD');

      (allTxs || []).forEach(tx => {
        const amount = Number(tx.amount || 0);
        if (tx.type === 'income') {
          totalIncome += amount;
          if (tx.date === today) todayIncome += amount;
        } else {
          totalExpense += amount;
          if (tx.date === today) todayExpense += amount;
        }
      });

      const recentTransactions = (allTxs || [])
        .sort((a, b) => {
          if (a.date === b.date) {
             return (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '');
          }
          return (b.date || '').localeCompare(a.date || '');
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
  }

  async getReportData(filters) {
    if (!this.supabase) return { success: false, error: 'Supabase not configured' };
    try {
      const ctx = await this.getBusinessContext();
      const { startDate, endDate } = filters;
      let query = this.supabase
        .from('transactions')
        .select('*')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .gte('date', startDate)
        .lte('date', endDate);
        
      if (ctx?.businessId) {
        query = query.eq('business_id', ctx.businessId);
      }

      const { data: txs, error } = await query;
      if (error) throw error;

      let totalIncome = 0;
      let totalExpense = 0;
      const byCategory = {};
      const byDate = {};

      (txs || []).forEach(tx => {
        const amount = Number(tx.amount || 0);
        if (tx.type === 'income') {
          totalIncome += amount;
        } else {
          totalExpense += amount;
        }

        if (!byCategory[tx.category]) {
          byCategory[tx.category] = { amount: 0, type: tx.type, count: 0 };
        }
        byCategory[tx.category].amount += amount;
        byCategory[tx.category].count += 1;

        if (!byDate[tx.date]) {
          byDate[tx.date] = { income: 0, expense: 0, count: 0 };
        }
        if (tx.type === 'income') {
          byDate[tx.date].income += amount;
        } else {
          byDate[tx.date].expense += amount;
        }
        byDate[tx.date].count += 1;
      });

      return {
        success: true,
        data: {
          transactions: txs || [],
          totalIncome,
          totalExpense,
          profit: totalIncome - totalExpense,
          transactionCount: (txs || []).length,
          byCategory,
          byDate
        }
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getSettings() {
    if (!this.supabase) return { success: false, error: 'Supabase not configured' };
    try {
      const ctx = await this.getBusinessContext();
      let query = this.supabase.from('businesses').select('*');
      if (ctx?.businessId) {
        query = query.eq('id', ctx.businessId);
      }
      const { data, error } = await query.limit(1).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error; 
      
      if (data) {
        return { 
          success: true, 
          data: {
            ...data.settings,
            business_name: data.business_name,
            owner_name: data.owner_name,
            currency: data.currency
          } 
        };
      }
      return { success: true, data: {} };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async updateSettings(settings) {
    if (!this.supabase) return { success: false, error: 'Supabase not configured' };
    try {
      const ctx = await this.getBusinessContext();
      let query = this.supabase.from('businesses').select('id, settings');
      if (ctx?.businessId) {
        query = query.eq('id', ctx.businessId);
      }
      const { data: existing, error: fetchErr } = await query.limit(1).maybeSingle();
      
      if (existing && !fetchErr) {
        const { business_name, owner_name, currency, ...jsonbSettings } = settings;
        
        const { error } = await this.supabase.from('businesses').update({
           business_name: business_name || 'My Business',
           owner_name: owner_name || 'Owner',
           currency: currency || 'USD',
           settings: { ...existing.settings, ...jsonbSettings }
        }).eq('id', existing.id);
        
        if (error) throw error;
      } else {
        throw new Error('Business not found. Settings update failed.');
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async updateSyncSettings() {
    return { success: true }; 
  }

  async getSyncStatus() {
    return { success: true, data: { status: 'idle', pendingCount: 0, lastSyncTime: new Date().toISOString(), enabled: false } };
  }

  async triggerSync() {
    return { success: true };
  }

  async clearPendingQueue() {
    return { success: true };
  }

  async testSyncConnection() {
    if (this.supabase) return { success: true, message: 'Connected to Supabase (Web Mode)' };
    return { success: false, error: 'Not configured' };
  }

  notifyOnline() {}

  onSyncStatusChange() {
    return () => {};
  }

  async backupDatabase() {
    return { success: false, error: 'Database backup is not available in Web Mode' };
  }
  
  async restoreDatabase() {
    return { success: false, error: 'Database restore is not available in Web Mode' };
  }

  async resetDatabase() {
    if (!this.supabase) return { success: false, error: 'Supabase not configured' };
    try {
      const ctx = await this.getBusinessContext();
      if (ctx?.businessId) {
        await this.supabase.from('transactions').update({ is_deleted: true }).eq('business_id', ctx.businessId);
      }
      return { success: true, message: 'Database reset successfully' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}
