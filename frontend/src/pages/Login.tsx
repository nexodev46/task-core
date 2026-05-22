import { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography, Paper, Alert, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff, Email as EmailIcon, Lock as LockIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import loginImage from '../assets/login.png';
import logo from '../assets/Lgo2.png';
import foto5 from '../assets/foto5.png';
import foto6 from '../assets/foto6.png';
import foto7 from '../assets/foto7.png';
import foto8 from '../assets/foto8.png';
import foto9 from '../assets/foto9.png';
import foto10 from '../assets/foto10.png';
import foto11 from '../assets/foto11.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const theme = useTheme();
  const navigate = useNavigate();
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const backgroundImages = [foto5, foto6, foto7, foto8, foto9, foto10, foto11];

  useEffect(() => {
    const storedIndex = localStorage.getItem('taskCoreLoginBackgroundIndex');
    const nextIndex = storedIndex !== null && !Number.isNaN(Number(storedIndex))
      ? (Number(storedIndex) + 1) % backgroundImages.length
      : 0;
    setBackgroundIndex(nextIndex);
    localStorage.setItem('taskCoreLoginBackgroundIndex', nextIndex.toString());
  }, []);

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
        backgroundImage: `url(${backgroundImages[backgroundIndex]})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        p: 2,
        position: 'relative',
        '&:before': {
          content: "''",
          position: 'absolute',
          inset: 0,
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)'
        }
      }}
    >
      <Paper
        elevation={8}
        sx={{
          width: '100%',
          maxWidth: 1000,
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          minHeight: { md: '70vh' },
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box sx={{ flex: 1, p: { xs: 4, md: 6 }, bgcolor: theme.palette.mode === 'dark' ? '#1e1e1e' : 'rgba(255,255,255,0.95)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Box sx={{ mb: 4, maxWidth: 420, textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 1 }}>
              <Box component="img" src={logo} alt="logo" sx={{ width: 56, height: 56, borderRadius: 2, boxShadow: 2 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                Task Core
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              Crea tu cuenta y ve cómo Task Core te ayuda a gestionar tus tareas, organizar mejor tu tiempo y mejorar tu rendimiento.
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleLogin} sx={{ width: '100%', maxWidth: 420, mx: 'auto' }}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => {
                const v = e.target.value; setEmail(v);
                setEmailError(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Formato de correo inválido');
              }}
              required
              variant="outlined"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" />
                  </InputAdornment>
                )
              }}
              helperText={emailError}
              error={!!emailError}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
            />

            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => { const v = e.target.value; setPassword(v); setPasswordError(v.length >= 6 ? '' : 'La contraseña debe tener al menos 6 caracteres'); }}
              required
              variant="outlined"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
              helperText={passwordError}
              error={!!passwordError}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            <Button type="submit" variant="contained" fullWidth sx={{ mt: 3, py: 1.2, background: 'linear-gradient(90deg,#3B82F6,#60A5FA)', color: '#fff', fontWeight: 700, '&:hover': { filter: 'brightness(0.95)' } }}>
              Iniciar sesión
            </Button>
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Link to="/register" style={{ textDecoration: 'none', color: theme.palette.mode === 'dark' ? '#90caf9' : '#1976d2' }}>
                ¿No tienes cuenta? Regístrate
              </Link>
            </Box>
          </Box>
        </Box>

        <Box sx={{ flex: 1, display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center', p: { xs: 4, md: 6 }, bgcolor: 'transparent' }}>
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