import { useState } from 'react';
import {
  Box, TextField, Button, Typography, Paper, Alert,
  InputAdornment, IconButton
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { setDoc, doc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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
              
            </Typography>
          </Box>
          <Box component="form" onSubmit={handleRegister} sx={{ width: '100%', maxWidth: 420 }}>
            <TextField
              label="Nombre"
              fullWidth
              margin="normal"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
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
              helperText="Debe ser de al menos 6 caracteres"
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
              Registrarme
            </Button>
            <Typography variant="caption" sx={{ mt: 2, color: 'text.secondary', textAlign: 'center', display: 'block' }}>
              Al hacer clic en Registrarme, aceptas nuestra política de privacidad y términos de servicio.
            </Typography>
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Link to="/login" style={{ textDecoration: 'none', color: '#1976d2' }}>
                ¿Ya tienes cuenta? Inicia sesión
              </Link>
            </Box>
          </Box>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#edf4ff', p: { xs: 4, md: 6 } }}>
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