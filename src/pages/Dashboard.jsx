import React from 'react';
import { useDashboardStats } from '../hooks/useData';
import SummaryCard from '../components/SummaryCard';
import TransactionTable from '../components/TransactionTable';
import Card from '../components/Card';
import { IoArrowUp, IoArrowDown, IoTrendingUp, IoCash } from 'react-icons/io5';
import { formatDate } from '../utils/formatters';

export default function Dashboard() {
  const { stats, loading } = useDashboardStats();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome to MarketOS Ledger</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard
          title="Total Income"
          amount={stats.totalIncome}
          icon={IoArrowUp}
          color="green"
        />
        <SummaryCard
          title="Total Expense"
          amount={stats.totalExpense}
          icon={IoArrowDown}
          color="red"
        />
        <SummaryCard
          title="Net Profit/Loss"
          amount={stats.profit}
          icon={IoTrendingUp}
          color={stats.profit >= 0 ? 'green' : 'red'}
        />
        <SummaryCard
          title="Cash In Hand"
          amount={stats.profit}
          icon={IoCash}
          color="blue"
        />
      </div>

      {/* Today's Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard
          title="Today's Income"
          amount={stats.todayIncome}
          icon={IoArrowUp}
          color="green"
        />
        <SummaryCard
          title="Today's Expense"
          amount={stats.todayExpense}
          icon={IoArrowDown}
          color="red"
        />
        <SummaryCard
          title="Today's Profit/Loss"
          amount={stats.todayProfit}
          icon={IoTrendingUp}
          color={stats.todayProfit >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Recent Transactions */}
      <Card>
        <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Transactions</h2>
        <TransactionTable transactions={stats.recentTransactions} isLoading={loading} />
      </Card>
    </div>
  );
}
