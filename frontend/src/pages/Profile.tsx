import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Avatar, Button, TextField,
  CircularProgress, Alert, Divider, Card, CardContent
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { updateProfile, updatePassword } from 'firebase/auth';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function Profile() {
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0, todo: 0 });

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
      // Reautenticación (por seguridad). Pedimos la contraseña actual en un prompt? 
      // Por simplicidad, asumimos que el usuario está autenticado recientemente.
      // En producción, deberías pedir la contraseña actual.
      await updatePassword(user, newPassword);
      setMessage({ type: 'success', text: 'Contraseña actualizada. Vuelve a iniciar sesión con la nueva contraseña.' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setUpdating(false);
    }
  };

  if (!user) return <Typography>Cargando...</Typography>;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold' }} gutterBottom>Mi Perfil</Typography>
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        {/* Información del usuario */}
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Avatar sx={{ width: 80, height: 80, bgcolor: 'primary.main' }}>
              {user.displayName?.charAt(0) || user.email?.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{user.displayName || 'Sin nombre'}</Typography>
              <Typography variant="body2" color="text.secondary">{user.email}</Typography>
            </Box>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Editar nombre</Typography>
          {!editingName ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
              <Typography>{user.displayName || 'No establecido'}</Typography>
              <Button size="small" onClick={() => setEditingName(true)}>Editar</Button>
            </Box>
          ) : (
            <Box sx={{ mt: 1 }}>
              <TextField
                label="Nuevo nombre"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="off"
                fullWidth
                size="small"
              />
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button variant="contained" onClick={handleUpdateName} disabled={updating}>
                  {updating ? <CircularProgress size={24} /> : 'Guardar'}
                </Button>
                <Button onClick={() => setEditingName(false)}>Cancelar</Button>
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Cambiar contraseña</Typography>
          <TextField
            label="Nueva contraseña"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            fullWidth
            size="small"
            margin="normal"
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
          />
          <Button variant="outlined" onClick={handleUpdatePassword} disabled={updating} sx={{ mt: 1 }}>
            {updating ? <CircularProgress size={24} /> : 'Actualizar contraseña'}
          </Button>
        </Paper>

        {/* Estadísticas de tareas */}
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }} gutterBottom>Mis tareas</Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4">{stats.total}</Typography>
                <Typography variant="body2">Total tareas</Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">{stats.completed}</Typography>
                <Typography variant="body2">Completadas</Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">{stats.inProgress}</Typography>
                <Typography variant="body2">En progreso</Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="info.main">{stats.todo}</Typography>
                <Typography variant="body2">Por hacer</Typography>
              </CardContent>
            </Card>
          </Box>
        </Paper>
      </Box>
      {message && <Alert severity={message.type} sx={{ mt: 2 }}>{message.text}</Alert>}
    </Box>
  );
}