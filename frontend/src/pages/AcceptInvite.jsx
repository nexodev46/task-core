import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Button, Alert } from '@mui/material';
import { getInvitationByToken, acceptInvitation } from '../services/invitationService';
import { useAuth } from '../context/AuthContext';

export default function AcceptInvite() {
  const { token } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      const inv = await getInvitationByToken(token);
      if (!inv) setError('La invitación no es válida o ya fue utilizada.');
      else setInvitation(inv);
      setLoading(false);
    };
    load();
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      // Guardar token para después del login
      localStorage.setItem('pendingInviteToken', token);
      navigate('/login');
      return;
    }

    if (user.email && invitation?.email && user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      setError('Inicia sesión con el correo invitado para aceptar esta invitación.');
      return;
    }

    try {
      await acceptInvitation(invitation.id, invitation.projectId, user.uid);
      alert('¡Te has unido al proyecto!');
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <Typography align="center" sx={{ mt: 4 }}>Cargando...</Typography>;
  if (error) return <Alert severity="error" sx={{ m: 4 }}>{error}</Alert>;
  if (!invitation) return null;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <Paper sx={{ p: 4, maxWidth: 500, textAlign: 'center' }}>
        <Typography variant="h5">Invitación a proyecto</Typography>
        <Typography variant="body1" sx={{ mt: 2 }}>
          Has sido invitado a unirte a un proyecto colaborativo en <strong>Task Core</strong>.
        </Typography>
        {user ? (
          <Button variant="contained" onClick={handleAccept} sx={{ mt: 3 }}>Aceptar invitación</Button>
        ) : (
          <Typography variant="body2" sx={{ mt: 2 }}>Por favor, inicia sesión para aceptar la invitación.</Typography>
        )}
      </Paper>
    </Box>
  );
}