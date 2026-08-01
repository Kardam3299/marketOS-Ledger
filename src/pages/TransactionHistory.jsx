import React, { useState, useMemo } from 'react';
import { useTransactions } from '../hooks/useData';
import TransactionTable from '../components/TransactionTable';
import Card from '../components/Card';
import Input from '../components/Input';
import Select from '../components/Select';
import Button from '../components/Button';
import { useToast } from '../context/ToastContext';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_MODES } from '../utils/constants';
import { api } from '../lib/repositories';

export default function TransactionHistory() {
  const { transactions, loading, fetchTransactions } = useTransactions();
  const { success, error } = useToast();

  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  const categories = [
    ...new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]),
  ];

  // Filter and search transactions
  const filteredTransactions = useMemo(() => {
    let result = transactions;

    // Search
    if (searchText) {
      result = result.filter(
        (t) =>
          t.description?.toLowerCase().includes(searchText.toLowerCase()) ||
          t.category.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Filter by type
    if (filterType) {
      result = result.filter((t) => t.type === filterType);
    }

    // Filter by category
    if (filterCategory) {
      result = result.filter((t) => t.category === filterCategory);
    }

    // Sort
    if (sortBy === 'date') {
      result = result.sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
    } else if (sortBy === 'amount-high') {
      result = result.sort((a, b) => b.amount - a.amount);
    } else if (sortBy === 'amount-low') {
      result = result.sort((a, b) => a.amount - b.amount);
    }

    return result;
  }, [transactions, searchText, filterType, filterCategory, sortBy]);

  const handleDelete = async (id) => {
    try {
      const result = await api.deleteTransaction(id);
      if (result.success) {
        success('Transaction deleted successfully');
        fetchTransactions();
      } else {
        error(result.error || 'Failed to delete transaction');
      }
    } catch (err) {
      error('An error occurred while deleting transaction');
      console.error(err);
    }
    setShowDeleteConfirm(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Transaction History</h1>
        <p className="text-gray-600 mt-2">View and manage all your transactions</p>
      </div>

      {/* Filters */}
      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-6">Filters & Search</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            label="Search"
            placeholder="Search by description or category..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

          <Select
            label="Type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            options={['', 'income', 'expense']}
          />

          <Select
            label="Category"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            options={categories}
          />

          <Select
            label="Sort By"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            options={['date', 'amount-high', 'amount-low']}
          />
        </div>
      </Card>

      {/* Results count */}
      <div className="text-sm text-gray-600">
        Showing <strong>{filteredTransactions.length}</strong> of{' '}
        <strong>{transactions.length}</strong> transactions
      </div>

      {/* Table */}
      <TransactionTable
        transactions={filteredTransactions}
        isLoading={loading}
        onDelete={(id) => setShowDeleteConfirm(id)}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Delete Transaction?
            </h3>
            <p className="text-gray-600 mb-6">
              This action cannot be undone. Are you sure you want to delete this transaction?
            </p>
            <div className="flex gap-4">
              <Button
                variant="danger"
                onClick={() => handleDelete(showDeleteConfirm)}
              >
                Delete
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
