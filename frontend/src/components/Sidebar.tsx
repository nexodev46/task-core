import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, Button, Badge } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChatIcon from '@mui/icons-material/Chat';
import CommentIcon from '@mui/icons-material/Comment';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout'; // Icono para salir
import BarChartIcon from '@mui/icons-material/BarChart';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import HelpIcon from '@mui/icons-material/Help';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [unreadCommentsCount, setUnreadCommentsCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadMessagesCount(0);
      setUnreadCommentsCount(0);
      return;
    }

    const activitiesQuery = query(
      collection(db, 'activities'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
      let messages = 0;
      let comments = 0;

      snapshot.docs.forEach((doc) => {
        const activity = doc.data();
        if (activity.deleted === true) return;
        if (activity.action === 'new_message') messages += 1;
        if (activity.action === 'new_comment') comments += 1;
      });

      setUnreadMessagesCount(messages);
      setUnreadCommentsCount(comments);
    });

    return unsubscribe;
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const buttonSx = {
    textTransform: 'none',
    borderRadius: 2,
    transition: 'all 150ms ease',
    '&:active': {
      boxShadow: 'inset 0 4px 12px rgba(0, 0, 0, 0.12)',
      transform: 'translateY(1px)',
    },
    '&.Mui-selected': {
      bgcolor: '#e2e8f0',
      color: 'primary.main',
      fontWeight: 600,
      '&:hover': {
        bgcolor: '#c7d2fe',
      },
    },
  };

  return (
    <List sx={{ mt: 2 }}>
      {/* Opciones principales */}
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/" selected={location.pathname === '/'} sx={buttonSx}>
          <ListItemIcon><DashboardIcon /></ListItemIcon>
          <ListItemText primary={t('sidebar.board')} />
        </ListItemButton>
      </ListItem>
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/tareas" selected={location.pathname === '/tareas'} sx={buttonSx}>
          <ListItemIcon><AssignmentIcon /></ListItemIcon>
          <ListItemText primary={t('sidebar.tasks')} />
        </ListItemButton>
      </ListItem>
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/calendario" selected={location.pathname === '/calendario'} sx={buttonSx}>
          <ListItemIcon><CalendarMonthIcon /></ListItemIcon>
          <ListItemText primary={t('sidebar.calendar')} />
        </ListItemButton>
      </ListItem>
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/mensajes" selected={location.pathname === '/mensajes'} sx={buttonSx}>
          <ListItemIcon>
            <Badge badgeContent={unreadMessagesCount} color="error" invisible={unreadMessagesCount === 0}>
              <ChatIcon />
            </Badge>
          </ListItemIcon>
          <ListItemText primary={t('sidebar.messages')} />
        </ListItemButton>
      </ListItem>
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/comentarios" selected={location.pathname === '/comentarios'} sx={buttonSx}>
          <ListItemIcon>
            <Badge badgeContent={unreadCommentsCount} color="error" invisible={unreadCommentsCount === 0}>
              <CommentIcon />
            </Badge>
          </ListItemIcon>
          <ListItemText primary={t('sidebar.comments')} />
        </ListItemButton>
      </ListItem>
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/team" selected={location.pathname === '/team'} sx={buttonSx}>
          <ListItemIcon><PeopleIcon /></ListItemIcon>
          <ListItemText primary={t('sidebar.team')} />
        </ListItemButton>
      </ListItem>

      <Divider sx={{ my: 2 }} />

      <ListItem disablePadding>
        <ListItemButton component={Link} to="/reportes" selected={location.pathname === '/reportes'} sx={buttonSx}>
          <ListItemIcon><BarChartIcon /></ListItemIcon>
          <ListItemText primary={t('sidebar.reports')} />
        </ListItemButton>
      </ListItem>
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/estadisticas" selected={location.pathname === '/estadisticas'} sx={buttonSx}>
          <ListItemIcon><AssessmentIcon /></ListItemIcon>
          <ListItemText primary={t('sidebar.stats')} />
        </ListItemButton>
      </ListItem>
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/profile" selected={location.pathname === '/profile'} sx={buttonSx}>
          <ListItemIcon><AccountCircleIcon /></ListItemIcon>
          <ListItemText primary={t('sidebar.myProfile')} />
        </ListItemButton>
      </ListItem>
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/ayuda" selected={location.pathname === '/ayuda'} sx={buttonSx}>
          <ListItemIcon><HelpIcon /></ListItemIcon>
          <ListItemText primary={t('sidebar.help')} />
        </ListItemButton>
      </ListItem>

      <Divider sx={{ my: 2 }} />

      <ListItem disablePadding>
        <ListItemButton component={Link} to="/configuracion" sx={buttonSx}>
          <ListItemIcon><SettingsIcon /></ListItemIcon>
          <ListItemText primary={t('sidebar.settings')} />
        </ListItemButton>
      </ListItem>

      <Divider sx={{ my: 2 }} />

      {/* Botón de Salir (reemplaza a "Agregar tarea") */}
      <Button
        variant="contained"
        startIcon={<LogoutIcon />}
        fullWidth
        onClick={handleLogout}
        sx={{ textTransform: 'none', borderRadius: 2, bgcolor: '#d32f2f', '&:hover': { bgcolor: '#c62828' } }}
      >
        {t('sidebar.logout')}
      </Button>
    </List>
  );
}