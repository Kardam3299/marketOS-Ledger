import React from 'react';
import {
  IoCloudDone,
  IoSync,
  IoCloudOffline,
  IoCloudUpload,
  IoAlertCircle,
} from 'react-icons/io5';
import { useSync } from '../hooks/useSync';

export default function SyncIndicator({ compact = false }) {
  const { syncStatus, triggerSync, loading } = useSync();
  const { status, pendingCount, enabled, lastSyncTime } = syncStatus;

  const getStatusBadge = () => {
    if (!enabled || status === 'offline') {
      return {
        icon: IoCloudOffline,
        label: 'Offline',
        colorClass: 'bg-gray-800 text-gray-300 border-gray-700',
        dotColor: 'bg-gray-400',
      };
    }

    switch (status) {
      case 'syncing':
        return {
          icon: IoSync,
          label: 'Syncing...',
          colorClass: 'bg-blue-900/50 text-blue-300 border-blue-700/60',
          spin: true,
        };
      case 'pending':
        return {
          icon: IoCloudUpload,
          label: pendingCount ? `Pending (${pendingCount})` : 'Pending',
          colorClass: 'bg-amber-900/50 text-amber-300 border-amber-700/60',
        };
      case 'error':
        return {
          icon: IoAlertCircle,
          label: 'Sync Error',
          colorClass: 'bg-red-900/50 text-red-300 border-red-700/60',
        };
      case 'synced':
      default:
        return {
          icon: IoCloudDone,
          label: 'Synced',
          colorClass: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/60',
        };
    }
  };

  const current = getStatusBadge();
  const Icon = current.icon;

  const titleText = enabled
    ? `Cloud Sync: ${current.label}${
        lastSyncTime ? ` | Last synced: ${new Date(lastSyncTime).toLocaleString()}` : ''
      }. Click to sync now.`
    : 'Cloud Sync disabled. Click to manage settings.';

  return (
    <button
      onClick={triggerSync}
      disabled={loading || status === 'syncing' || !enabled}
      title={titleText}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
        current.colorClass
      } ${
        loading || status === 'syncing' || !enabled
          ? 'opacity-80 cursor-default'
          : 'hover:scale-105 active:scale-95 cursor-pointer shadow-sm'
      }`}
    >
      <Icon className={`w-4 h-4 ${current.spin || loading ? 'animate-spin' : ''}`} />
      <span>{current.label}</span>
    </button>
  );
}
