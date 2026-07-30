import React, { createContext, useContext, useState, useCallback } from 'react';
import { TOAST_TYPES } from '../utils/constants';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = TOAST_TYPES.SUCCESS, duration = 3000) => {
    const id = Date.now();
    const newToast = { id, message, type };

    setToasts((prev) => [...prev, newToast]);

    if (duration) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((message, duration) => {
    showToast(message, TOAST_TYPES.SUCCESS, duration);
  }, [showToast]);

  const error = useCallback((message, duration) => {
    showToast(message, TOAST_TYPES.ERROR, duration);
  }, [showToast]);

  const info = useCallback((message, duration) => {
    showToast(message, TOAST_TYPES.INFO, duration);
  }, [showToast]);

  const warning = useCallback((message, duration) => {
    showToast(message, TOAST_TYPES.WARNING, duration);
  }, [showToast]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        removeToast,
        success,
        error,
        info,
        warning,
      }}
    >
      {children}
    </ToastContext.Provider>
  );
}
