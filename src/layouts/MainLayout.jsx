import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';

export default function MainLayout() {
  return (
    <div className="flex h-screen bg-light">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <main className="p-8">
          <Outlet />
        </main>
      </div>
      <Toast />
    </div>
  );
}
