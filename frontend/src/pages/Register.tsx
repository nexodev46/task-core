import { useState, useEffect } from 'react';
import {
  Box, TextField, Button, Typography, Paper, Alert,
  InputAdornment, IconButton
} from '@mui/material';
import { Visibility, VisibilityOff, Email as EmailIcon, Lock as LockIcon } from '@mui/icons-material';
import logo from '../assets/Lgo2.png';
import { useTheme } from '@mui/material/styles';
import foto5 from '../assets/foto5.png';
import foto6 from '../assets/foto6.png';
import foto7 from '../assets/foto7.png';
import foto8 from '../assets/foto8.png';
import foto9 from '../assets/foto9.png';
import foto10 from '../assets/foto10.png';
import foto11 from '../assets/foto11.png';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { setDoc, doc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
  const [nombre, setNombre] = useState('');
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
    const storedIndex = localStorage.getItem('taskCoreRegisterBackgroundIndex');
    const nextIndex = storedIndex !== null && !Number.isNaN(Number(storedIndex))
      ? (Number(storedIndex) + 1) % backgroundImages.length
      : 0;
    setBackgroundIndex(nextIndex);
    localStorage.setItem('taskCoreRegisterBackgroundIndex', nextIndex.toString());
  }, []);

  const handleFieldFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.setAttribute('autocomplete', 'off');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: nombre });
      
      // Crear documento de usuario en Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: email.toLowerCase(),
        displayName: nombre,
        createdAt: new Date(),
        profilePicture: null,
        bio: '',
        status: 'active'
      });
      
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Error al registrarse');
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
        elevation={6}
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
              
            </Typography>
          </Box>
          <Box component="form" onSubmit={handleRegister} autoComplete="off" noValidate sx={{ width: '100%', maxWidth: 420, mx: 'auto' }}>
            {/* Hidden inputs to prevent browser autofill from filling visible fields */}
            <input
              type="text"
              name="username_autofill"
              autoComplete="username"
              style={{ position: 'absolute', left: -9999, top: 0, width: 0, height: 0, opacity: 0 }}
              aria-hidden="true"
            />
            <input
              type="password"
              name="password_autofill"
              autoComplete="new-password"
              style={{ position: 'absolute', left: -9999, top: 0, width: 0, height: 0, opacity: 0 }}
              aria-hidden="true"
            />
            <TextField
              label="Nombre"
              fullWidth
              margin="normal"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              variant="outlined"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />
            <TextField
              label="Email"
              placeholder="Ingrese su correo"
              type="email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => { const v = e.target.value; setEmail(v); setEmailError(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Formato de correo inválido'); }}
              onFocus={handleFieldFocus}
              required
              variant="outlined"
              autoComplete="off"
              slotProps={{ input: { name: "field-email-reg", startAdornment: (<InputAdornment position="start"><EmailIcon color="action" /></InputAdornment>) } }}
              helperText={emailError}
              error={!!emailError}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: '8px' },
                '& input:-webkit-autofill': {
                  WebkitBoxShadow: '0 0 0 1000px white inset !important',
                  WebkitTextFillColor: '#333 !important'
                }
              }}
            />
            <TextField
              label="Password"
              placeholder="Ingrese su contraseña"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => { const v = e.target.value; setPassword(v); setPasswordError(v.length >= 6 ? '' : 'La contraseña debe tener al menos 6 caracteres'); }}
              onFocus={handleFieldFocus}
              required
              helperText={passwordError || 'Debe ser de al menos 6 caracteres'}
              variant="outlined"
              autoComplete="off"
              slotProps={{
                input: {
                  name: "field-password-reg",
                  startAdornment: (<InputAdornment position="start"><LockIcon color="action" /></InputAdornment>),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
              error={!!passwordError}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: '8px' },
                '& input:-webkit-autofill': {
                  WebkitBoxShadow: '0 0 0 1000px white inset !important',
                  WebkitTextFillColor: '#333 !important'
                }
              }}
            />
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            <Button type="submit" variant="contained" fullWidth sx={{ mt: 3, py: 1.2, background: 'linear-gradient(90deg,#3B82F6,#60A5FA)', color: '#fff', fontWeight: 700, '&:hover': { filter: 'brightness(0.95)' } }}>
              Registrarme
            </Button>
            <Typography variant="caption" sx={{ mt: 2, color: 'text.secondary', textAlign: 'center', display: 'block' }}>
              Al hacer clic en Registrarme, aceptas nuestra política de privacidad y términos de servicio.
            </Typography>
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Link to="/login" style={{ textDecoration: 'none', color: theme.palette.mode === 'dark' ? '#90caf9' : '#1976d2' }}>
                ¿Ya tienes cuenta? Inicia sesión
              </Link>
            </Box>
          </Box>
        </Box>

        <Box sx={{ flex: 1, display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center', p: { xs: 4, md: 6 }, bgcolor: 'transparent' }}>
          <Box
            component="img"
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80"
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