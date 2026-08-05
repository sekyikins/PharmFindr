import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast, { ToastConfig, ToastType } from '@/components/ui/Toast';

interface ToastContextValue {
  showToast: (config: ToastConfig) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let globalShowToast: ((config: ToastConfig) => void) | null = null;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [currentToast, setCurrentToast] = useState<ToastConfig | null>(null);

  const hideToast = useCallback(() => {
    setCurrentToast(null);
  }, []);

  const showToast = useCallback((config: ToastConfig) => {
    const id = config.id || String(Date.now());
    setCurrentToast({ ...config, id });
  }, []);

  globalShowToast = showToast;

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {currentToast && (
        <Toast key={currentToast.id} toast={currentToast} onDismiss={hideToast} />
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Universal toast helper accessible everywhere
export const toast = {
  show: (config: ToastConfig) => {
    if (globalShowToast) globalShowToast(config);
  },
  clinical: (message: string, actionLabel?: string, onAction?: () => void, title?: string) => {
    if (globalShowToast) {
      globalShowToast({
        type: 'clinical',
        title: title || 'Clinical Safety Protection',
        message,
        actionLabel,
        onAction,
        duration: 6000,
      });
    }
  },
  success: (message: string, title?: string) => {
    if (globalShowToast) {
      globalShowToast({ type: 'success', title: title || 'Success', message });
    }
  },
  error: (message: string, title?: string) => {
    if (globalShowToast) {
      globalShowToast({ type: 'error', title: title || 'Error', message });
    }
  },
  warning: (message: string, title?: string) => {
    if (globalShowToast) {
      globalShowToast({ type: 'warning', title: title || 'Notice', message });
    }
  },
  info: (message: string, title?: string) => {
    if (globalShowToast) {
      globalShowToast({ type: 'info', title: title || 'Information', message });
    }
  },
};
