import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Box, Drawer, AppBar, Toolbar, IconButton, TextField, InputAdornment, Avatar, Typography } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useState, useEffect } from 'react';
import SearchIcon from '@mui/icons-material/Search';

import Sidebar from '../components/Sidebar';
import { useSearch } from '../context/SearchContext';
import NotificationsPanel from '../components/NotificationsPanel';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const drawerWidth = 260;

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const { searchTerm, setSearchTerm } = useSearch();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // Limpiar búsquedas no válidas o autocompletadas al volver al tablero
  useEffect(() => {
    try {
      if (location.pathname !== '/configuracion') {
        const looksLikeEmail = typeof searchTerm === 'string' && /\S+@\S+\.\S+/.test(searchTerm);
        if (looksLikeEmail) setSearchTerm('');
      }
    } catch (err) { /* ignore */ }
  }, [location.pathname, searchTerm, setSearchTerm]);

  return (
    <Box sx={{ display: 'flex' }}>
      {/* AppBar con buscador centrado y título Task Core a la izquierda */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          bgcolor: 'white',
          color: 'black',
          boxShadow: 1,
        }}
      >
        <Toolbar>
          {/* Menú hamburguesa (solo móvil) */}
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Título de la app (logo + nombre). Mantener tamaño y no alterar layout */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, #0c0f17 0%, #6f6f2b 100%)',
                boxShadow: '0 4px 12px rgba(49, 55, 26, 0.3)',
              }}
            >
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: '1.2rem',
                  color: 'white',
                  letterSpacing: '-2px',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                }}
              >
                TC
              </Typography>
            </Box>
            <Box sx={{ lineHeight: 1.1 }}>
              <Typography variant="h6" noWrap sx={{ fontWeight: '700', letterSpacing: 0.2 }}>
                Task Core
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem', mt: 0.15 }}>
                V1.0
              </Typography>
            </Box>
          </Box>

          {/* Buscador centrado */}
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
              <TextField
                variant="outlined"
                placeholder={t('search.placeholder')}
                size="small"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ width: { xs: '80%', sm: 300 } }}
                autoComplete="off"
                slotProps={{
                  htmlInput: {
                    autoComplete: 'off',
                    name: 'taskcore-search-field',
                    inputMode: 'search',
                    spellCheck: false,
                  },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  },
                }}
                id="taskcore-search"
              />
          </Box>

          {/* Notificaciones y avatar */}
           <NotificationsPanel />
          <Avatar sx={{ ml: 2, bgcolor: 'primary.main', cursor: 'pointer' }} onClick={() => navigate('/profile')}>
            {user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
        </Toolbar>
      </AppBar>

      {/* Sidebar (drawer) */}
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: 0 }}>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              top: '64px',
              height: 'calc(100% - 64px)',
            },
          }}
          open
        >
          <Toolbar />
          <Sidebar />
        </Drawer>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          sx={{ display: { xs: 'block', md: 'none' } }}
        >
          <Toolbar />
          <Sidebar />
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}