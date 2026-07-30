import React from 'react';
import { TOAST_TYPES } from '../utils/constants';
import { useToast } from '../context/ToastContext';
import { IoClose } from 'react-icons/io5';

const toastStyles = {
  [TOAST_TYPES.SUCCESS]: 'bg-green-50 border-green-200 text-green-800',
  [TOAST_TYPES.ERROR]: 'bg-red-50 border-red-200 text-red-800',
  [TOAST_TYPES.INFO]: 'bg-blue-50 border-blue-200 text-blue-800',
  [TOAST_TYPES.WARNING]: 'bg-yellow-50 border-yellow-200 text-yellow-800',
};

export default function Toast() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`border rounded-lg p-4 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top ${
            toastStyles[toast.type]
          }`}
        >
          <p className="font-medium">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-current opacity-70 hover:opacity-100 transition-opacity"
          >
            <IoClose size={20} />
          </button>
        </div>
      ))}
    </div>
  );
}
