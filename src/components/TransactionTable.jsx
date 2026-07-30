import React from 'react';
import { formatCurrency, formatDate } from '../utils/formatters';
import { IoTrash, IoPencil } from 'react-icons/io5';
import Card from './Card';
import Button from './Button';

export default function TransactionTable({
  transactions = [],
  onEdit,
  onDelete,
  isLoading = false,
}) {
  if (isLoading) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-gray-500">Loading...</p>
        </div>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-gray-500">No transactions found</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b-2 border-gray-200">
          <tr>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
            <th className="text-right py-3 px-4 font-semibold text-gray-700">Amount</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">Mode</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">Description</th>
            <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3 px-4">{formatDate(transaction.date)}</td>
              <td className="py-3 px-4">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    transaction.type === 'income'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                </span>
              </td>
              <td className="py-3 px-4">{transaction.category}</td>
              <td className="py-3 px-4 text-right font-semibold">
                <span
                  className={
                    transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }
                >
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatCurrency(transaction.amount)}
                </span>
              </td>
              <td className="py-3 px-4 text-sm">{transaction.payment_mode}</td>
              <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                {transaction.description || '-'}
              </td>
              <td className="py-3 px-4">
                <div className="flex justify-center gap-2">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(transaction)}
                      className="p-2 hover:bg-blue-100 rounded transition-colors"
                      title="Edit"
                    >
                      <IoPencil size={18} className="text-blue-600" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(transaction.id)}
                      className="p-2 hover:bg-red-100 rounded transition-colors"
                      title="Delete"
                    >
                      <IoTrash size={18} className="text-red-600" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
