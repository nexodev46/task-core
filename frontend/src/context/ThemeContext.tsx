import { createContext, useContext, useState, ReactNode } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

type ThemeMode = 'light' | 'dark';
interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeContextProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<ThemeMode>('light');
  const toggleTheme = () => setMode(prev => (prev === 'light' ? 'dark' : 'light'));
  const theme = createTheme({ palette: { mode } });
  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useThemeContext must be used within ThemeContextProvider');
  return context;
};