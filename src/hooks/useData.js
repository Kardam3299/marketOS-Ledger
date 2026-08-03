import { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { setActiveCurrency } from '../utils/formatters';
import { api } from '../lib/repositories';

export const useTransactions = (filters = {}) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const { error } = useToast();

  const fetchTransactions = async (filterParams = filters) => {
    setLoading(true);
    try {
      const result = await api.getTransactions(filterParams);
      if (result.success) {
        setTransactions(result.data);
      } else {
        error(result.error || 'Failed to fetch transactions');
      }
    } catch {
      error('An error occurred while fetching transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  return { transactions, loading, fetchTransactions };
};

export const useDashboardStats = () => {
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    profit: 0,
    todayIncome: 0,
    todayExpense: 0,
    todayProfit: 0,
    recentTransactions: [],
  });
  const [loading, setLoading] = useState(false);
  const { error } = useToast();

  const fetchStats = async () => {
    setLoading(true);
    try {
      const result = await api.getDashboardStats();
      if (result.success) {
        setStats(result.data);
      } else {
        error(result.error || 'Failed to fetch dashboard stats');
      }
    } catch {
      error('An error occurred while fetching dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { stats, loading, fetchStats };
};

export const useSettings = () => {
  const [settings, setSettings] = useState({
    business_name: 'My Business',
    owner_name: 'Owner',
    currency: 'USD',
  });
  const [loading, setLoading] = useState(false);
  const { error } = useToast();

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const result = await api.getSettings();
      if (result.success) {
        const nextSettings = result.data || {};
        setSettings(nextSettings);
        setActiveCurrency(nextSettings.currency || 'USD');
      } else {
        error(result.error || 'Failed to fetch settings');
      }
    } catch {
      error('An error occurred while fetching settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings) => {
    setLoading(true);
    try {
      const result = await api.updateSettings(newSettings);
      if (result.success) {
        const nextSettings = { ...newSettings, currency: newSettings.currency || 'USD' };
        setSettings(nextSettings);
        setActiveCurrency(nextSettings.currency);
        return true;
      } else {
        error(result.error || 'Failed to update settings');
        return false;
      }
    } catch {
      error('An error occurred while updating settings');
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return { settings, loading, fetchSettings, updateSettings };
};

export const useReportData = (startDate, endDate) => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const { error } = useToast();

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const result = await api.getReportData({ startDate, endDate });
      if (result.success) {
        setReportData(result.data);
      } else {
        error(result.error || 'Failed to fetch report data');
      }
    } catch {
      error('An error occurred while fetching report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchReportData();
    }
  }, [startDate, endDate]);

  return { reportData, loading, fetchReportData };
};
