export const colors = {
  light: {
    background: '#ffffff',
    surface: '#f8fafc',
    surfaceSecondary: '#f1f5f9',
    
    // Patient Theme (Blue)
    patient: {
      primary: '#2563eb',
      primaryDark: '#1d4ed6',
      secondary: '#eff6ff',
      text: '#1e40af',
    },
    
    // Pharmacy Theme (Green)
    pharmacy: {
      primary: '#10b981',
      primaryDark: '#059669',
      secondary: '#e6f7f2',
      text: '#065f46',
    },
    
    text: {
      primary: '#1d293d',
      secondary: '#62748e',
      muted: '#90a1b9',
      white: '#ffffff',
    },
    
    border: '#e2e8f0',
    borderMuted: '#f1f5f9',
    error: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
  },
  dark: {
    background: '#0f172b',
    surface: '#1e293b',
    surfaceSecondary: '#334155',
    
    // Patient Theme (Blue)
    patient: {
      primary: '#3b82f6',
      primaryDark: '#2563eb',
      secondary: '#1e293b',
      text: '#93c5fd',
    },
    
    // Pharmacy Theme (Green)
    pharmacy: {
      primary: '#34d399',
      primaryDark: '#10b981',
      secondary: '#064e3b',
      text: '#a7f3d0',
    },
    
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
      muted: '#64748b',
      white: '#ffffff',
    },
    
    border: '#334155',
    borderMuted: '#1e293b',
    error: '#f87171',
    success: '#34d399',
    warning: '#fbbf24',
  }
};

export type ThemeColors = typeof colors.light;
