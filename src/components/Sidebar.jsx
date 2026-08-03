import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  IoGrid,
  IoAddCircle,
  IoList,
  IoBarChart,
  IoSettings,
  IoPeople,
  IoLogOut
} from 'react-icons/io5';
import SyncIndicator from './SyncIndicator';

const navItems = [
  { path: '/', label: 'Dashboard', icon: IoGrid, roles: ['owner', 'manager', 'staff'] },
  { path: '/income', label: 'Add Income', icon: IoAddCircle, roles: ['owner', 'manager', 'staff'] },
  { path: '/expense', label: 'Add Expense', icon: IoAddCircle, roles: ['owner', 'manager', 'staff'] },
  { path: '/transactions', label: 'Transactions', icon: IoList, roles: ['owner', 'manager', 'staff'] },
  { path: '/reports', label: 'Reports', icon: IoBarChart, roles: ['owner', 'manager'] },
  { path: '/team', label: 'Team', icon: IoPeople, roles: ['owner'] },
  { path: '/settings', label: 'Settings', icon: IoSettings, roles: ['owner'] },
];

export default function Sidebar({ onClose }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const userRole = profile?.role || 'staff';
  const visibleNavItems = navItems.filter(item => item.roles.includes(userRole));

  return (
    <div className="w-64 bg-gray-900 text-white h-full md:h-screen overflow-y-auto flex flex-col justify-between shadow-xl md:shadow-none">
      <div>
        {/* Logo/Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">MarketOS</h1>
            <p className="text-gray-400 text-sm">Ledger</p>
          </div>
          {onClose && (
            <button 
              onClick={onClose} 
              className="md:hidden p-2 hover:bg-gray-800 rounded focus:outline-none"
            >
              <span className="text-gray-400 text-lg">✕</span>
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="py-6">
          {visibleNavItems.map((item) => {
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
                onClick={onClose}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div>
        <div className="px-6 py-4 border-t border-gray-800 bg-gray-950">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors w-full text-left"
          >
            <IoLogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
        <div className="p-6 border-t border-gray-800 bg-gray-950 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 capitalize">{profile?.full_name || profile?.email} ({userRole})</span>
          </div>
          <div className="flex items-center justify-between">
            <SyncIndicator />
            <p className="text-xs text-gray-500">v1.1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
