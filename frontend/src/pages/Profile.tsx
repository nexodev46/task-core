import { useState, useEffect, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Avatar, Button, TextField,
  CircularProgress, Alert, Card, CardContent, Tabs, Tab,
  LinearProgress, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions,
  Chip, IconButton, Tooltip, Switch, FormControlLabel, FormControl, Select, MenuItem, InputLabel, Slider, Radio, RadioGroup, FormLabel
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import LockIcon from '@mui/icons-material/Lock';
import DescriptionIcon from '@mui/icons-material/Description';
import TimelineIcon from '@mui/icons-material/Timeline';
import SettingsIcon from '@mui/icons-material/Settings';
import FolderIcon from '@mui/icons-material/Folder';
import PeopleIcon from '@mui/icons-material/People';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { updateProfile, updatePassword } from 'firebase/auth';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';
import { useLanguage } from '../context/LanguageContext';
import { useThemeContext } from '../context/ThemeContext';

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0, todo: 0 });
  const [tabValue, setTabValue] = useState(0);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // Preferences state
  const { language, setLanguage } = useLanguage();
  const { mode, setMode } = useThemeContext();
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => { try { return localStorage.getItem('notifications_enabled') !== 'false'; } catch { return true; } });
  const [notifSoundEnabled, setNotifSoundEnabled] = useState<boolean>(() => { try { return localStorage.getItem('notifications_sound') !== 'false'; } catch { return true; } });
  const [notifVolume, setNotifVolume] = useState<number>(() => { try { return parseFloat(localStorage.getItem('notifications_volume') || '0.05'); } catch { return 0.05; } });

  // Cargar estadísticas de tareas del usuario
  useEffect(() => {
    if (!user) return;

    const tasksRef = collection(db, 'tasks');
    const projectId = currentProject?.id || user.uid;
    const q = query(tasksRef, where('projectId', '==', projectId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => doc.data());
      const total = tasks.length;
      const completed = tasks.filter(t => t.status === 'completed').length;
      const inProgress = tasks.filter(t => t.status === 'in_progress').length;
      const todo = tasks.filter(t => t.status === 'todo').length;
      setStats({ total, completed, inProgress, todo });
    }, (error) => {
      console.error('Error en tiempo real al cargar estadísticas:', error);
    });

    return () => unsubscribe();
  }, [user, currentProject?.id]);

  // Mostrar mensaje y limpiar después de 3 segundos
  useEffect(() => {
    if (message) {
      setSnackbarOpen(true);
      const timer = setTimeout(() => {
        setSnackbarOpen(false);
        setMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Cargar foto de perfil desde Firestore
  useEffect(() => {
    if (!user) return;

    const loadProfilePhoto = async () => {
      try {
        const profileRef = doc(db, 'profiles', user.uid);
        const profileSnap = await getDoc(profileRef);
        const profileData = profileSnap.exists() ? profileSnap.data() : null;

        if (profileData?.avatarBase64) {
          setProfilePhoto(profileData.avatarBase64);
          return;
        }
        if (profileData?.photoURL) {
          setProfilePhoto(profileData.photoURL);
          return;
        }

        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : null;
        if (userData?.avatarBase64) {
          setProfilePhoto(userData.avatarBase64);
        }
      } catch (error) {
        console.error('Error cargando foto de perfil:', error);
      }
    };

    loadProfilePhoto();
  }, [user]);

  // persist preferences
  useEffect(() => { try { localStorage.setItem('notifications_enabled', String(notificationsEnabled)); } catch {} }, [notificationsEnabled]);
  useEffect(() => { try { localStorage.setItem('notifications_sound', String(notifSoundEnabled)); } catch {} }, [notifSoundEnabled]);
  useEffect(() => { try { localStorage.setItem('notifications_volume', String(notifVolume)); } catch {} }, [notifVolume]);


  const handleUpdateName = async () => {
    if (!user) return;
    setUpdating(true);
    try {
      await updateProfile(user, { displayName });
      setMessage({ type: 'success', text: 'Nombre actualizado correctamente' });
      setEditingName(false);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!user || !user.email) return;
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }
    setUpdating(true);
    try {
      await updatePassword(user, newPassword);
      setMessage({ type: 'success', text: 'Contraseña actualizada. Por favor inicia sesión con la nueva contraseña.' });
      setNewPassword('');
      setConfirmPassword('');
      setPasswordModalOpen(false);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setUpdating(false);
    }
  };

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Por favor selecciona una imagen válida' });
      return;
    }

    // Validar tamaño (máximo 500KB)
    if (file.size > 500 * 1024) {
      setMessage({ type: 'error', text: 'La imagen no debe superar 500 KB' });
      return;
    }

    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const profileRef = doc(db, 'profiles', user.uid);
        const userRef = doc(db, 'users', user.uid);

        await setDoc(profileRef, { avatarBase64: base64, updatedAt: new Date() }, { merge: true });
        await setDoc(userRef, { avatarBase64: base64 }, { merge: true });

        setProfilePhoto(base64);
        setMessage({ type: 'success', text: 'Foto de perfil actualizada correctamente' });
      } catch (error: any) {
        console.error('Error guardando foto:', error);
        setMessage({ type: 'error', text: 'Error al guardar la foto. Intenta nuevamente.' });
      } finally {
        setUploadingPhoto(false);
      }
    };
    reader.onerror = () => {
      setUploadingPhoto(false);
      setMessage({ type: 'error', text: 'No se pudo leer la imagen' });
    };
    reader.readAsDataURL(file);
  };

  if (!user) return <Typography>Cargando...</Typography>;


  const completionPercentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const registrationDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Banner Header */}
      <Box
        sx={{
          height: 200,
          background: 'linear-gradient(135deg, rgba(13, 71, 161, 0.1) 0%, rgba(25, 118, 210, 0.05) 100%)',
          borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
          position: 'relative'
        }}
      />

      <Box sx={{ px: 3, pb: 4 }}>
        {/* Avatar + Info Section */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 4, mt: -8, position: 'relative', zIndex: 1, alignItems: { xs: 'flex-start', md: 'flex-end' } }}>
          {/* Avatar y nombre */}
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 2.5, position: 'relative' }}>
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <Avatar
                src={profilePhoto || undefined}
                sx={{
                  width: 140,
                  height: 140,
                  bgcolor: profilePhoto ? 'transparent' : 'primary.main',
                  fontSize: '3rem',
                  fontWeight: 700,
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.15)'
                }}
              >
                {!profilePhoto && (user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase())}
              </Avatar>
              {/* Camera button overlay */}
              <Box
                component="label"
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)',
                  transition: 'all 200ms ease',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                    boxShadow: '0 6px 16px rgba(15, 23, 42, 0.3)'
                  }
                }}
              >
                <PhotoCameraIcon sx={{ color: '#fff', fontSize: '1.2rem' }} />
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                />
              </Box>
            </Box>
            <Box sx={{ pb: 1.5, minWidth: 0 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, color: 'text.primary', letterSpacing: '-0.5px' }}>
                {user.displayName || 'Usuario'}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1.5, fontWeight: 500 }}>
                {user.email}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label="Miembro" variant="outlined" size="small" />
                <Chip label={`Miembro desde ${registrationDate.split(' ')[2]}/5/2026`} variant="outlined" size="small" />
              </Box>
            </Box>
          </Box>

          {/* Quick action buttons */}
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'flex-end', pb: 1 }}>
            <Button
              variant="contained"
              startIcon={<FolderIcon />}
              onClick={() => navigate('/')}
            >
              Mis Proyectos
            </Button>
            <Button
              variant="outlined"
              startIcon={<PeopleIcon />}
              onClick={() => navigate('/team')}
            >
              Mi Equipo
            </Button>
          </Box>
        </Box>

        {/* Tabs Section */}
        <Paper sx={{ mb: 3, borderRadius: 2, boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)' }}>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            sx={{ borderBottom: '1px solid rgba(15, 23, 42, 0.08)', bgcolor: 'background.paper' }}
          >
            <Tab
              label="Perfil"
              icon={<DescriptionIcon />}
              iconPosition="start"
              sx={{ fontWeight: 600 }}
            />
            <Tab
              label="Estadísticas"
              icon={<TimelineIcon />}
              iconPosition="start"
              sx={{ fontWeight: 600 }}
            />
            <Tab
              label="Seguridad"
              icon={<LockIcon />}
              iconPosition="start"
              sx={{ fontWeight: 600 }}
            />
            <Tab
              label="Preferencias"
              icon={<SettingsIcon />}
              iconPosition="start"
              sx={{ fontWeight: 600 }}
            />
          </Tabs>

          {/* Tab 0: Perfil */}
          <Box sx={{ display: tabValue === 0 ? 'block' : 'none', p: 3 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 3 }}>
              {/* Columna izquierda: Avatar y nombre */}
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5 }}>
                  Información Personal
                </Typography>

                {/* Editar nombre */}
                <Paper sx={{ p: 2.5, bgcolor: 'background.paper', borderRadius: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Nombre</Typography>
                    {!editingName && (
                      <Tooltip title="Editar nombre">
                        <IconButton
                          size="small"
                          onClick={() => setEditingName(true)}
                          sx={{ color: 'primary.main' }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>

                  {!editingName ? (
                    <Typography sx={{ py: 1 }}>
                      {user.displayName || 'No establecido'}
                    </Typography>
                  ) : (
                    <Box>
                      <TextField
                        label="Nuevo nombre"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        autoComplete="off"
                        fullWidth
                        size="small"
                        sx={{ mb: 1.5 }}
                      />
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<SaveIcon />}
                          onClick={handleUpdateName}
                          disabled={updating}
                        >
                          Guardar
                        </Button>
                        <Button
                          size="small"
                          startIcon={<CancelIcon />}
                          onClick={() => setEditingName(false)}
                        >
                          Cancelar
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Paper>

                {/* Email */}
                <Paper sx={{ p: 2.5, bgcolor: 'background.paper', borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>Correo electrónico</Typography>
                  <Typography sx={{ py: 1 }}>{user.email}</Typography>
                </Paper>
              </Box>

              {/* Columna derecha: Cambiar avatar */}
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5 }}>
                  Foto de Perfil
                </Typography>
                <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 2 }}>
                  <Avatar
                    src={profilePhoto || undefined}
                    sx={{
                      width: 100,
                      height: 100,
                      bgcolor: profilePhoto ? 'transparent' : 'primary.main',
                      fontSize: '2rem',
                      fontWeight: 700,
                      mx: 'auto',
                      mb: 2
                    }}
                  >
                    {!profilePhoto && (user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase())}
                  </Avatar>
                  <Box
                    component="label"
                    sx={{
                      display: 'block',
                      position: 'relative'
                    }}
                  >
                    <Button
                      variant="contained"
                      component="span"
                      startIcon={uploadingPhoto ? <CircularProgress size={20} /> : <CloudUploadIcon />}
                      disabled={uploadingPhoto}
                      fullWidth
                    >
                      {uploadingPhoto ? 'Subiendo...' : 'Cambiar foto'}
                    </Button>
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                    Formatos: JPG, PNG, GIF (máximo 500 KB)
                  </Typography>
                </Paper>
              </Box>

            </Box>
          </Box>

          {/* Tab 1: Estadísticas */}
          <Box sx={{ display: tabValue === 1 ? 'block' : 'none', p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
              Resumen de Tareas
            </Typography>

            {/* KPI Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: 2, mb: 4 }}>
              <Box>
                <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)' }}>
                  <CardContent sx={{ textAlign: 'center', pb: 2 }}>
                    <Typography color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}>
                      Total
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {stats.total}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              <Box>
                <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)' }}>
                  <CardContent sx={{ textAlign: 'center', pb: 2 }}>
                    <Typography color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}>
                      Completadas
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                      {stats.completed}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              <Box>
                <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)' }}>
                  <CardContent sx={{ textAlign: 'center', pb: 2 }}>
                    <Typography color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}>
                      En progreso
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
                      {stats.inProgress}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              <Box>
                <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)' }}>
                  <CardContent sx={{ textAlign: 'center', pb: 2 }}>
                    <Typography color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}>
                      Por hacer
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main' }}>
                      {stats.todo}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </Box>

            {/* Progress Bar */}
            <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Progreso General
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  {completionPercentage}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={completionPercentage}
                sx={{
                  height: 10,
                  borderRadius: 1,
                  backgroundColor: 'rgba(15, 23, 42, 0.08)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 1,
                    background: 'linear-gradient(90deg, rgba(25, 118, 210, 0.8) 0%, rgba(25, 118, 210, 1) 100%)'
                  }
                }}
              />
              <Box sx={{ display: 'flex', gap: 4, mt: 2.5, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Tareas completadas</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{stats.completed} de {stats.total}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Tareas restantes</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{stats.todo + stats.inProgress} pendientes</Typography>
                </Box>
              </Box>
            </Paper>
          </Box>

          {/* Tab 2: Seguridad */}
          <Box sx={{ display: tabValue === 2 ? 'block' : 'none', p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
              Configuración de Seguridad
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 3 }}>
              <Box>
                <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <LockIcon sx={{ color: 'primary.main' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Contraseña
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                    Actualiza tu contraseña regularmente para mantener tu cuenta segura
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={() => setPasswordModalOpen(true)}
                  >
                    Cambiar contraseña
                  </Button>
                </Paper>
              </Box>

              <Box>
                <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                    Autenticación de dos factores
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                    Aumenta la seguridad de tu cuenta habilitando 2FA
                  </Typography>
                  <Button variant="outlined" disabled>
                    Habilitar 2FA (próximamente)
                  </Button>
                </Paper>
              </Box>
            </Box>
          </Box>

          {/* Tab 3: Preferencias */}
          <Box sx={{ display: tabValue === 3 ? 'block' : 'none', p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
              Preferencias
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 3 }}>
              <Box>
                <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                    Notificaciones
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                    Configura cómo deseas recibir notificaciones
                  </Typography>
                  <FormControlLabel
                    control={<Switch checked={notificationsEnabled} onChange={(e) => setNotificationsEnabled(e.target.checked)} />}
                    label={notificationsEnabled ? 'Notificaciones activadas' : 'Notificaciones desactivadas'}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                    <FormControlLabel control={<Switch checked={notifSoundEnabled} onChange={(e) => setNotifSoundEnabled(e.target.checked)} />} label="Sonido" />
                    <Box sx={{ width: 180 }}>
                      <Slider value={notifVolume} min={0} max={0.2} step={0.01} onChange={(_e, v) => { const val = Array.isArray(v) ? v[0] : v; setNotifVolume(val); }} aria-label="Volumen notificaciones" />
                    </Box>
                  </Box>
                </Paper>
              </Box>

              <Box>
                <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                    Tema y Apariencia
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                    Elige entre modo claro u oscuro
                  </Typography>
                  <FormControl component="fieldset">
                    <FormLabel component="legend">Tema</FormLabel>
                    <RadioGroup row value={mode} onChange={(e) => setMode(e.target.value as any)}>
                      <FormControlLabel value="light" control={<Radio />} label="Claro" />
                      <FormControlLabel value="dark" control={<Radio />} label="Oscuro" />
                    </RadioGroup>
                  </FormControl>
                </Paper>
              </Box>

              <Box>
                <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                    Idioma
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                    Selecciona tu idioma preferido para la interfaz
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel id="lang-select-label">Idioma</InputLabel>
                    <Select
                      labelId="lang-select-label"
                      value={language}
                      label="Idioma"
                      onChange={(e) => { setLanguage(e.target.value as any); try { localStorage.setItem('taskcore-language', String(e.target.value)); } catch {} }}
                    >
                      <MenuItem value="es">Español</MenuItem>
                      <MenuItem value="en">English</MenuItem>
                    </Select>
                  </FormControl>
                </Paper>
              </Box>
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Modal para cambiar contraseña */}
      <Dialog open={passwordModalOpen} onClose={() => !updating && setPasswordModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LockIcon />
            Cambiar contraseña
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Por tu seguridad, elige una contraseña fuerte con al menos 6 caracteres
          </Typography>
          <TextField
            label="Nueva contraseña"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            fullWidth
            size="small"
            margin="normal"
            disabled={updating}
          />
          <TextField
            label="Confirmar contraseña"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            fullWidth
            size="small"
            margin="normal"
            disabled={updating}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPasswordModalOpen(false)} disabled={updating}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdatePassword}
            disabled={updating || !newPassword || !confirmPassword}
          >
            {updating ? <CircularProgress size={24} /> : 'Cambiar contraseña'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar para mensajes */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={message?.type}
          sx={{ width: '100%' }}
        >
          {message?.text}
        </Alert>
      </Snackbar>
    </Box>
  );
}