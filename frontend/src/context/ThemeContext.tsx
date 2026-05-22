import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

type ThemeMode = 'light' | 'dark';
interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (m: ThemeMode) => void;
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Función auxiliar para oscurecer un color
const darkenColor = (color: string, percent: number = 30): string => {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, (num >> 8 & 0x00FF) - amt);
  const B = Math.max(0, (num & 0x0000FF) - amt);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
};

export const ThemeContextProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('taskcore-theme');
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const [backgroundColor, setBackgroundColor] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('taskcore-background-color');
      return saved || '#ffffff';
    } catch {
      return '#ffffff';
    }
  });

  const toggleTheme = () => setMode(prev => (prev === 'light' ? 'dark' : 'light'));
  const base = createTheme({ palette: { mode } });

  // Oscurecer el color de fondo en modo oscuro
  const darkBackgroundColor = mode === 'dark' ? darkenColor(backgroundColor, 50) : backgroundColor;

  const theme = createTheme({
    ...base,
    palette: {
      ...base.palette,
      ...(mode === 'dark' ? {
        background: {
          default: darkBackgroundColor,
          paper: darkenColor(darkBackgroundColor, 10)
        },
        primary: {
          main: '#1e88e5'
        },
        text: {
          primary: '#E6EEF8',
          secondary: '#BFCFE4'
        },
        divider: 'rgba(255,255,255,0.08)'
      } : {
        background: {
          default: backgroundColor,
          paper: backgroundColor
        }
      })
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: darkBackgroundColor,
            color: mode === 'dark' ? '#E6EEF8' : undefined
          }
        }
      }
    }
  });

  useEffect(() => {
    try { localStorage.setItem('taskcore-theme', mode); } catch {}
  }, [mode]);

  useEffect(() => {
    try { localStorage.setItem('taskcore-background-color', backgroundColor); } catch {}
  }, [backgroundColor]);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setMode, backgroundColor, setBackgroundColor }}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useThemeContext must be used within ThemeContextProvider');
  return context;
};
