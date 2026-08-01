import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  IoGrid,
  IoWallet,
  IoCash,
  IoSettings,
  IoList,
  IoBarChart,
  IoAddCircle
} from 'react-icons/io5';
import SyncIndicator from './SyncIndicator';

const navItems = [
  { path: '/', label: 'Dashboard', icon: IoGrid },
  { path: '/income', label: 'Add Income', icon: IoAddCircle },
  { path: '/expense', label: 'Add Expense', icon: IoAddCircle },
  { path: '/transactions', label: 'Transactions', icon: IoList },
  { path: '/reports', label: 'Reports', icon: IoBarChart },
  { path: '/settings', label: 'Settings', icon: IoSettings },
];

export default function Sidebar() {
  return (
    <div className="w-64 bg-gray-900 text-white h-screen overflow-y-auto flex flex-col justify-between">
      <div>
        {/* Logo/Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">MarketOS</h1>
            <p className="text-gray-400 text-sm">Ledger</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="py-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `
                  flex items-center gap-3 px-6 py-3 transition-all duration-200
                  ${
                    isActive
                      ? 'bg-blue-600 border-r-4 border-blue-400'
                      : 'hover:bg-gray-800'
                  }
                `
                }
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-800 bg-gray-950 flex items-center justify-between">
        <SyncIndicator />
        <p className="text-xs text-gray-500">v1.0.0</p>
      </div>
    </div>
  );
}
