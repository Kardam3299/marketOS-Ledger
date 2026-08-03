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

  const addToastInternal = useCallback((message, type = TOAST_TYPES.SUCCESS, duration = 3000) => {
    const id = Date.now() + Math.random();
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

  const handleToast = useCallback((arg1, arg2, duration) => {
    if (!arg1) return;

    if (typeof arg1 === 'object') {
      const { message, type = TOAST_TYPES.SUCCESS, duration: dur = 3000 } = arg1;
      return addToastInternal(message, type, dur);
    }

    const validTypes = Object.values(TOAST_TYPES);
    if (typeof arg1 === 'string' && validTypes.includes(arg1.toLowerCase())) {
      const type = arg1.toLowerCase();
      const message = typeof arg2 === 'string' ? arg2 : String(arg2 || '');
      return addToastInternal(message, type, duration || 3000);
    } else {
      const message = String(arg1 || '');
      const type = (typeof arg2 === 'string' && validTypes.includes(arg2.toLowerCase())) ? arg2.toLowerCase() : TOAST_TYPES.SUCCESS;
      return addToastInternal(message, type, duration || 3000);
    }
  }, [addToastInternal]);

  const showToast = useCallback((arg1, arg2, duration) => handleToast(arg1, arg2, duration), [handleToast]);
  const addToast = useCallback((arg1, arg2, duration) => handleToast(arg1, arg2, duration), [handleToast]);

  const success = useCallback((message, duration) => {
    return addToastInternal(message, TOAST_TYPES.SUCCESS, duration || 3000);
  }, [addToastInternal]);

  const error = useCallback((message, duration) => {
    return addToastInternal(message, TOAST_TYPES.ERROR, duration || 3000);
  }, [addToastInternal]);

  const info = useCallback((message, duration) => {
    return addToastInternal(message, TOAST_TYPES.INFO, duration || 3000);
  }, [addToastInternal]);

  const warning = useCallback((message, duration) => {
    return addToastInternal(message, TOAST_TYPES.WARNING, duration || 3000);
  }, [addToastInternal]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        addToast,
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
