import React, { useState } from 'react';
import { useReportData } from '../hooks/useData';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import SummaryCard from '../components/SummaryCard';
import { formatCurrency, formatDate } from '../utils/formatters';
import dayjs from 'dayjs';
import { IoArrowUp, IoArrowDown, IoTrendingUp } from 'react-icons/io5';

export default function Reports() {
  const [startDate, setStartDate] = useState(
    dayjs().startOf('month').format('YYYY-MM-DD')
  );
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const { reportData, loading } = useReportData(startDate, endDate);

  const handlePreset = (preset) => {
    const today = dayjs();
    switch (preset) {
      case 'today':
        setStartDate(today.format('YYYY-MM-DD'));
        setEndDate(today.format('YYYY-MM-DD'));
        break;
      case 'week':
        setStartDate(today.startOf('week').format('YYYY-MM-DD'));
        setEndDate(today.endOf('week').format('YYYY-MM-DD'));
        break;
      case 'month':
        setStartDate(today.startOf('month').format('YYYY-MM-DD'));
        setEndDate(today.endOf('month').format('YYYY-MM-DD'));
        break;
      case 'year':
        setStartDate(today.startOf('year').format('YYYY-MM-DD'));
        setEndDate(today.endOf('year').format('YYYY-MM-DD'));
        break;
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-2">Generate financial reports</p>
        </div>
        <Card className="text-center py-8">
          <p className="text-gray-500">Loading report data...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600 mt-2">Generate financial reports and analysis</p>
      </div>

      {/* Date Range Selection */}
      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-6">Select Date Range</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => handlePreset('today')}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePreset('week')}>
              This Week
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePreset('month')}>
              This Month
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePreset('year')}>
              This Year
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary Stats */}
      {reportData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SummaryCard
              title="Total Income"
              amount={reportData.totalIncome}
              icon={IoArrowUp}
              color="green"
            />
            <SummaryCard
              title="Total Expense"
              amount={reportData.totalExpense}
              icon={IoArrowDown}
              color="red"
            />
            <SummaryCard
              title="Net Profit/Loss"
              amount={reportData.profit}
              icon={IoTrendingUp}
              color={reportData.profit >= 0 ? 'green' : 'red'}
            />
          </div>

          {/* Transaction Count */}
          <Card>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-gray-600 text-sm">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {reportData.transactionCount}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Avg Income</p>
                <p className="text-2xl font-bold text-green-600">
                  {reportData.transactionCount > 0
                    ? formatCurrency(
                        reportData.totalIncome /
                          reportData.reportData?.filter((t) => t.type === 'income')
                            .length || 1
                      )
                    : formatCurrency(0)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Avg Expense</p>
                <p className="text-2xl font-bold text-red-600">
                  {reportData.transactionCount > 0
                    ? formatCurrency(
                        reportData.totalExpense /
                          (reportData.transactions?.filter((t) => t.type === 'expense')
                            .length || 1)
                      )
                    : formatCurrency(0)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Profit Margin</p>
                <p className="text-2xl font-bold text-blue-600">
                  {reportData.totalIncome > 0
                    ? `${((reportData.profit / reportData.totalIncome) * 100).toFixed(2)}%`
                    : '0%'}
                </p>
              </div>
            </div>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <h3 className="text-lg font-bold text-gray-900 mb-6">Breakdown by Category</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b-2 border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Category
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Type
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      Amount
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(reportData.byCategory).map(([category, data]) => (
                    <tr key={category} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{category}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                            data.type === 'income'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {data.type.charAt(0).toUpperCase() + data.type.slice(1)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {formatCurrency(data.amount)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600">{data.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Daily Breakdown */}
          <Card>
            <h3 className="text-lg font-bold text-gray-900 mb-6">Daily Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b-2 border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Date
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      Income
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      Expense
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(reportData.byDate).map(([date, data]) => (
                    <tr key={date} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">{formatDate(date, 'MMM DD, YYYY')}</td>
                      <td className="py-3 px-4 text-right text-green-600 font-semibold">
                        {formatCurrency(data.income)}
                      </td>
                      <td className="py-3 px-4 text-right text-red-600 font-semibold">
                        {formatCurrency(data.expense)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600">{data.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
