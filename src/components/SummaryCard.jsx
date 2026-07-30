import React from 'react';
import Card from './Card';
import { formatCurrency } from '../utils/formatters';

export default function SummaryCard({ title, amount, icon: Icon, color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <Card className="flex items-center justify-between">
      <div>
        <p className="text-gray-600 text-sm font-medium mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900">
          {formatCurrency(amount)}
        </p>
      </div>
      {Icon && (
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon size={32} />
        </div>
      )}
    </Card>
  );
}
