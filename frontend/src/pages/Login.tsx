import { useState } from 'react';
import { Box, TextField, Button, Typography, Paper, Alert, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import loginImage from '../assets/login.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Verificar si el documento existe en Firestore
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      // Si no existe, crearlo (para usuarios antiguos que se registraron antes)
      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          uid: userCredential.user.uid,
          email: userCredential.user.email?.toLowerCase() || email.toLowerCase(),
          displayName: userCredential.user.displayName || email.split('@')[0],
          createdAt: new Date(),
          profilePicture: null,
          bio: '',
          status: 'active'
        });
      }
      
      const pendingToken = localStorage.getItem('pendingInviteToken');
      if (pendingToken) {
        localStorage.removeItem('pendingInviteToken');
        navigate(`/accept-invite/${pendingToken}`);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/network-request-failed') {
        setError('Error de red: verifica tu conexión a Internet e intenta de nuevo.');
      } else if (code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setError('Correo o contraseña incorrectos.');
      } else if (code === 'auth/invalid-email') {
        setError('El correo no tiene un formato válido.');
      } else {
        setError(err.message || 'Error al iniciar sesión');
      }
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#e7f0ff',
        p: 2,
      }}
    >
      <Paper
        elevation={6}
        sx={{
          width: '100%',
          maxWidth: 1200,
          borderRadius: 4,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          minHeight: { md: '70vh' },
        }}
      >
        <Box sx={{ flex: 1, p: { xs: 4, md: 6 }, bgcolor: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Box sx={{ mb: 4, maxWidth: 420 }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
              Task Core
            </Typography>
            <Typography variant="h5" sx={{ mb: 2, color: 'text.primary' }}>
              
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              Crea tu cuenta y ve cómo Task Core te ayuda a gestionar tus tareas, organizar mejor tu tiempo y mejorar tu rendimiento.
            </Typography>
          </Box>
          <Box component="form" onSubmit={handleLogin} sx={{ width: '100%', maxWidth: 420 }}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            <Button type="submit" variant="contained" fullWidth sx={{ mt: 3, py: 1.2 }}>
              Iniciar sesión
            </Button>
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Link to="/register" style={{ textDecoration: 'none', color: '#1976d2' }}>
                ¿No tienes cuenta? Regístrate
              </Link>
            </Box>
          </Box>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#edf4ff', p: { xs: 4, md: 6 } }}>
          <Box
            component="img"
            src={loginImage}
            alt="Gestión de tareas"
            sx={{
              width: '100%',
              maxWidth: 520,
              borderRadius: 4,
              boxShadow: 3,
              objectFit: 'cover',
              minHeight: 320,
            }}
          />
        </Box>
      </Paper>
    </Box>
  );
}