import { useState, useEffect, ChangeEvent } from 'react';
import {
  Box, Typography, Paper, Divider, Switch, FormControlLabel,
  Button, TextField, Avatar, Alert, Snackbar, Slider,
  Select, MenuItem, FormControl, InputLabel, Card, CardContent,
  Tabs, Tab, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, List, ListItem, ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  DataUsage as DataIcon,
  Palette as PaletteIcon,
  Delete as DeleteIcon,
  GetApp as ExportIcon,
  UploadFile as ImportIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  CheckCircle as CheckIcon,
  FiberManualRecord as BulletIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useNavigate } from 'react-router-dom';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { mode, toggleTheme, backgroundColor, setBackgroundColor } = useThemeContext();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [editingName, setEditingName] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [fontSize, setFontSize] = useState(16);
  const [primaryColor, setPrimaryColor] = useState('#1976d2');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [userRole, setUserRole] = useState('Usuario');
  const [savingProfile, setSavingProfile] = useState(false);
  const [typedPoints, setTypedPoints] = useState<string[]>([]);

  const accountDetailsPoints = [
    'Tablero Kanban visual — Organiza tus tareas en tres columnas: Por hacer, En progreso y Completado. Arrastra y suelta para cambiar el estado al instante.',
    'Colaboración en tiempo real — Invita a tu equipo por correo, crea proyectos compartidos y trabaja juntos con chat y comentarios integrados.',
    'Reportes y estadísticas — Visualiza gráficos de tu productividad, filtra por período y exporta datos a CSV para análisis externos.',
    'Calendario integrado — Todas las tareas con fecha de vencimiento aparecen en un calendario mensual; arrastra tareas para cambiar la fecha.',
    'Búsqueda instantánea — Encuentra cualquier tarea escribiendo en el buscador global; filtra por título o descripción en tiempo real.',
    'Perfil personalizable — Edita tu nombre, cambia tu contraseña y sube una foto de perfil (se guarda directamente, sin servicios extra).',
    'Modo oscuro y claro — Adapta la interfaz a tu gusto con un solo clic; la preferencia se guarda automáticamente.',
    'Diseño responsivo — Task Core funciona perfectamente en computadoras, tablets y móviles, con la misma experiencia en todos los dispositivos.',
    
  ];

  // Colores de fondo predefinidos
  const backgroundColorOptions = [
    { label: 'Blanco', value: '#ffffff' },
    { label: 'Crema', value: '#fffef5' },
    { label: 'Azul claro', value: '#e3f2fd' },
    { label: 'Verde claro', value: '#e8f5e9' },
    { label: 'Rosa claro', value: '#fce4ec' },
    { label: 'Púrpura claro', value: '#f3e5f5' },
    { label: 'Naranja claro', value: '#fff3e0' },
    { label: 'Gris claro', value: '#f5f5f5' }
  ];

  // Cargar preferencias desde localStorage
  useEffect(() => {
    const savedFont = localStorage.getItem('taskcore-font-size');
    if (savedFont) setFontSize(parseInt(savedFont));
    const savedColor = localStorage.getItem('taskcore-primary-color');
    if (savedColor) setPrimaryColor(savedColor);
    const savedBgColor = localStorage.getItem('taskcore-background-color');
    if (savedBgColor) setBackgroundColor(savedBgColor);
    const savedNotif = localStorage.getItem('taskcore-notifications');
    if (savedNotif) setNotificationsEnabled(savedNotif === 'true');
  }, []);

  // Guardar preferencias
  const savePreferences = () => {
    localStorage.setItem('taskcore-language', language);
    localStorage.setItem('taskcore-font-size', fontSize.toString());
    localStorage.setItem('taskcore-primary-color', primaryColor);
    localStorage.setItem('taskcore-background-color', backgroundColor);
    localStorage.setItem('taskcore-notifications', notificationsEnabled.toString());
    setMessage({ type: 'success', text: t('messages.preferencesSaved') });
  };

  useEffect(() => {
    if (!user) return;

    const loadUserProfile = async () => {
      try {
        const profileRef = doc(db, 'users', user.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          if (profileData.fullName && !user.displayName) {
            setDisplayName(profileData.fullName);
          }
          if (profileData.avatarBase64) {
            setAvatarBase64(profileData.avatarBase64);
            setAvatarPreview(profileData.avatarBase64);
          }
          if (profileData.role) {
            setUserRole(profileData.role);
          }
        }
      } catch (error) {
        console.error('Error cargando perfil de usuario:', error);
      }
    };

    loadUserProfile();
  }, [user]);

  useEffect(() => {
    if (tabValue !== 0 || editingName) return;

    setTypedPoints([]);
    let lineIndex = 0;
    let charIndex = 0;
    let currentText = '';
    let isActive = true;
    let timeoutId = 0;

    const typePoint = () => {
      if (!isActive || lineIndex >= accountDetailsPoints.length) return;
      const line = accountDetailsPoints[lineIndex];

      if (charIndex < line.length) {
        currentText += line[charIndex];
        charIndex += 1;
        setTypedPoints((prev) => {
          const next = [...prev];
          if (next.length === lineIndex) next.push(currentText);
          else next[lineIndex] = currentText;
          return next;
        });
        timeoutId = window.setTimeout(typePoint, 28);
      } else {
        lineIndex += 1;
        charIndex = 0;
        currentText = '';
        if (lineIndex < accountDetailsPoints.length) {
          timeoutId = window.setTimeout(typePoint, 300);
        }
      }
    };

    timeoutId = window.setTimeout(typePoint, 450);
    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [tabValue, editingName]);

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Por favor selecciona una imagen válida' });
      return;
    }
    if (file.size > 500 * 1024) {
      setMessage({ type: 'error', text: 'La imagen no debe superar 500 KB' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setAvatarBase64(base64);
      setAvatarPreview(base64);
    };
    reader.onerror = () => {
      setMessage({ type: 'error', text: 'No se pudo cargar la imagen' });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      if (displayName !== user.displayName) {
        await updateProfile(user, { displayName });
      }
      const userRef = doc(db, 'users', user.uid);
      await setDoc(
        userRef,
        {
          fullName: displayName,
          avatarBase64: avatarBase64 || null
        },
        { merge: true }
      );
      setMessage({ type: 'success', text: t('messages.preferencesSaved') });
      setEditingName(false);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSavingProfile(false);
    }
  };

  // Cambiar contraseña
  const handleChangePassword = async () => {
    if (!user || !user.email) return;
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: t('messages.passwordMismatch') });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: t('messages.passwordLength') });
      return;
    }
    setLoading(true);
    try {
      // Reautenticar (por seguridad)
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setMessage({ type: 'success', text: t('messages.passwordUpdated') });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Exportar tareas (simplificado)
  const exportData = async () => {
    // Aquí se podría exportar a CSV/JSON
    alert('Funcionalidad de exportación próximamente');
  };

  // Eliminar cuenta (peligroso, con confirmación)
  const deleteAccount = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Eliminar datos del usuario en Firestore
      await deleteDoc(doc(db, 'users', user.uid));
      // Eliminar tareas (opcional, se podría hacer con Cloud Function)
      // Eliminar usuario de Auth
      await user.delete();
      setMessage({ type: 'success', text: 'Cuenta eliminada. Serás redirigido.' });
      setTimeout(() => navigate('/login'), 2000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
      setOpenDeleteDialog(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => setTabValue(newValue);

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
      <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }} gutterBottom>{t('settings.header')}</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 680 }}>{t('settings.description')}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="contained" color="primary" startIcon={<EditIcon />}>
            {t('settings.updateProfile')}
          </Button>
          <Button variant="outlined" startIcon={<SettingsIcon />}>
            {t('settings.quickSettings')}
          </Button>
        </Box>
      </Box>
      <Paper sx={{ borderRadius: '16px', overflow: 'hidden', boxShadow: 3, mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            bgcolor: 'background.default',
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': { textTransform: 'none', minHeight: 64, fontWeight: 700 },
            '& .Mui-selected': { color: 'primary.main' }
          }}
        >
          <Tab icon={<PersonIcon />} label={t('settings.tabs.profile')} />
          <Tab icon={<PaletteIcon />} label={t('settings.tabs.appearance')} />
          <Tab icon={<NotificationsIcon />} label={t('settings.tabs.notifications')} />
          <Tab icon={<SecurityIcon />} label={t('settings.tabs.security')} />
          <Tab icon={<DataIcon />} label={t('settings.tabs.data')} />
        </Tabs>

        {/* Perfil */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1.1fr 1.9fr' } }}>
              <Card sx={{ borderRadius: '16px', boxShadow: 3, p: 3, bgcolor: 'background.paper' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <Avatar
                    src={avatarPreview || avatarBase64 || undefined}
                    sx={{ width: 120, height: 120, bgcolor: 'primary.main', fontSize: '3rem' }}
                  >
                    {!avatarPreview && !avatarBase64 && (user?.displayName?.charAt(0) || user?.email?.charAt(0))}
                  </Avatar>
                  <Button variant="contained" component="label" sx={{ mt: 1 }}>
                    Cambiar imagen
                    <input hidden accept="image/*" type="file" onChange={handleAvatarChange} />
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                    JPG/PNG máximo 500 KB. Vista previa antes de guardar.
                  </Typography>
                </Box>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" gutterBottom>
                  Información principal
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <PersonIcon />
                    </ListItemIcon>
                    <ListItemText primary="Nombre" secondary={user?.displayName || displayName || 'No establecido'} />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <PersonIcon />
                    </ListItemIcon>
                    <ListItemText primary="Correo electrónico" secondary={user?.email} />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckIcon />
                    </ListItemIcon>
                    <ListItemText primary="ID de usuario" secondary={user?.uid} />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <SettingsIcon />
                    </ListItemIcon>
                    <ListItemText primary="Rol" secondary={userRole} />
                  </ListItem>
                </List>
                <Button variant="outlined" startIcon={<EditIcon />} sx={{ mt: 2 }} onClick={() => setEditingName(true)}>
                  Editar perfil
                </Button>
              </Card>

              <Card sx={{ borderRadius: '16px', boxShadow: 3, p: 3, bgcolor: 'background.paper' }}>
                <Typography variant="h6" gutterBottom>
                  Detalles de la cuenta
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {editingName ? (
                  <Box sx={{ display: 'grid', gap: 2 }}>
                    <TextField
                      label="Nombre completo"
                      fullWidth
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      <Button variant="contained" onClick={handleSaveProfile} disabled={savingProfile}>
                        {savingProfile ? <CircularProgress size={20} /> : 'Guardar cambios'}
                      </Button>
                      <Button variant="outlined" onClick={() => setEditingName(false)}>
                        Cancelar
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  typedPoints.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Preparando detalles de la cuenta...
                    </Typography>
                  ) : (
                    <List sx={{ p: 0, '& .MuiListItem-root': { alignItems: 'flex-start' } }}>
                      {typedPoints.map((point, index) => (
                        <ListItem key={index} sx={{ py: 1, pl: 0 }}>
                          <ListItemIcon sx={{ minWidth: 32, mt: '4px' }}>
                            <BulletIcon sx={{ fontSize: 10 }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={point || '\u00a0'}
                            sx={{ '& .MuiTypography-root': { lineHeight: 1.6, fontSize: '0.95rem' } }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )
                )}
              </Card>
            </Box>
          </Box>
        </TabPanel>

        {/* Apariencia */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
              <Box>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>{t('settings.theme')}</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <FormControlLabel
                      control={<Switch checked={mode === 'dark'} onChange={toggleTheme} />}
                      label={mode === 'dark' ? t('settings.darkMode') : t('settings.lightMode')}
                    />
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="subtitle2" gutterBottom>Color de fondo personalizado</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                        Elige un color predefinido o personaliza el tuyo:
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mb: 2 }}>
                        {backgroundColorOptions.map((option) => (
                          <Box
                            key={option.value}
                            onClick={() => setBackgroundColor(option.value)}
                            title={option.label}
                            sx={{
                              width: '100%',
                              height: 50,
                              backgroundColor: option.value,
                              border: backgroundColor === option.value ? '3px solid #1e88e5' : '1px solid #ccc',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.3s',
                              '&:hover': { boxShadow: 2, transform: 'scale(1.05)' }
                            }}
                          />
                        ))}
                      </Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>O selecciona tu propio color:</Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <input
                          type="color"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          style={{ width: 60, height: 50, border: 'none', cursor: 'pointer', borderRadius: '8px' }}
                        />
                        <Typography variant="body2" color="text.secondary">{backgroundColor}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>{t('settings.primaryColor')}</Typography>
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        style={{ width: '100%', height: 40, border: 'none', cursor: 'pointer' }}
                      />
                    </Box>
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>{t('settings.fontSize')}</Typography>
                      <Slider
                        value={fontSize}
                        onChange={(_, val) => setFontSize(val as number)}
                        min={12}
                        max={24}
                        step={1}
                        marks
                        valueLabelDisplay="auto"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Box>
              <Box>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>{t('settings.language')}</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <FormControl fullWidth>
                      <InputLabel>{t('settings.language')}</InputLabel>
                      <Select value={language} label={t('settings.language')} onChange={(e) => setLanguage(e.target.value as 'es' | 'en')}>
                        <MenuItem value="es">Español</MenuItem>
                        <MenuItem value="en">English</MenuItem>
                      </Select>
                    </FormControl>
                    <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: '8px', border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle2" gutterBottom>Vista previa</Typography>
                      <Typography variant="body2" color="text.secondary">El fondo se actualizará automáticamente cuando cambies de modo claro/oscuro.</Typography>
                    </Box>
                    <Button variant="contained" startIcon={<SaveIcon />} onClick={savePreferences} sx={{ mt: 3 }}>
                      {t('settings.savePreferences')}
                    </Button>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>
        </TabPanel>

        {/* Notificaciones */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ p: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>{t('settings.notificationPreferences')}</Typography>
                <Divider sx={{ mb: 2 }} />
                <FormControlLabel
                  control={<Switch checked={notificationsEnabled} onChange={(e) => setNotificationsEnabled(e.target.checked)} />}
                  label={t('settings.pushNotifications')}
                />
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                  {t('settings.notificationsDescription')}
                </Typography>
                <Button variant="contained" startIcon={<SaveIcon />} onClick={savePreferences} sx={{ mt: 3 }}>
                  {t('settings.savePreferences')}
                </Button>
              </CardContent>
            </Card>
          </Box>
        </TabPanel>

        {/* Seguridad */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
              <Box>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>{t('settings.changePassword')}</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <TextField
                      label={t('settings.currentPassword')}
                      type="password"
                      fullWidth
                      margin="normal"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <TextField
                      label={t('settings.newPassword')}
                      type="password"
                      fullWidth
                      margin="normal"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      helperText={t('settings.passwordLength')}
                      autoComplete="new-password"
                    />
                    <TextField
                      label={t('settings.confirmPassword')}
                      type="password"
                      fullWidth
                      margin="normal"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <Button variant="contained" onClick={handleChangePassword} disabled={loading} sx={{ mt: 2 }}>
                      {loading ? <CircularProgress size={24} /> : t('settings.updatePassword')}
                    </Button>
                  </CardContent>
                </Card>
              </Box>
              <Box>
                <Card variant="outlined" sx={{ bgcolor: '#fff7ed' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="warning.main">{t('settings.securityOptions')}</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                      <Box>
                        <Typography variant="subtitle1">Two-factor authentication</Typography>
                        <Typography variant="body2" color="textSecondary">Protect your account with an extra layer of security. Feature in development.</Typography>
                      </Box>
                      <Button variant="contained" disabled startIcon={<SecurityIcon />}>
                        Configure 2FA
                      </Button>
                    </Box>
                    <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
                      <Typography variant="subtitle1" gutterBottom>{t('settings.deleteAccount')}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {t('settings.deleteAccountWarning')}
                      </Typography>
                      <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => setOpenDeleteDialog(true)} sx={{ mt: 2 }}>
                        {t('settings.deleteAccount')}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>
        </TabPanel>

        {/* Datos */}
        <TabPanel value={tabValue} index={4}>
          <Box sx={{ p: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>{t('settings.dataManagement')}</Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                  <Button variant="outlined" startIcon={<ExportIcon />} onClick={exportData}>
                    {t('settings.exportTasks')}
                  </Button>
                  <Button variant="contained" startIcon={<ImportIcon />} disabled>
                    {t('settings.importTasks')}
                  </Button>
                </Box>
                <Typography variant="body2" sx={{ mt: 2 }}>
                  {t('settings.exportDescription')}
                </Typography>
                <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: '16px', border: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2" gutterBottom>{t('settings.deleteData')}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {t('settings.deleteDataDescription')}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </TabPanel>
      </Paper>

      {/* Diálogo de confirmación para eliminar cuenta */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle>{t('settings.deleteDialogTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{t('settings.deleteDialogWarning')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>{t('settings.cancel')}</Button>
          <Button onClick={deleteAccount} color="error" variant="contained">{t('settings.delete')}</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar para mensajes */}
      <Snackbar open={!!message} autoHideDuration={4000} onClose={() => setMessage(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={message?.type} onClose={() => setMessage(null)} sx={{ width: '100%' }}>
          {message?.text}
        </Alert>
      </Snackbar>
    </Box>
  );
}