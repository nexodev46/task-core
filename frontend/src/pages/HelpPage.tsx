import { useState, type ChangeEvent } from 'react';
import {
  Box,
  Typography,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Button,
  Alert,
  Snackbar,
  Link,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpIcon from '@mui/icons-material/Help';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import BugReportIcon from '@mui/icons-material/BugReport';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useAuth } from '../context/AuthContext';

const faqs = [
  {
    question: '¿Cómo crear una nueva tarea?',
    answer: 'Ve al Tablero, haz clic en "+ Añadir tarjeta" dentro de cualquier columna, completa el título, descripción y etiquetas, luego guarda. La tarea aparecerá en la columna "Por hacer".'
  },
  {
    question: '¿Cómo mover una tarea entre columnas?',
    answer: 'Arrastra la tarjeta de la tarea y suéltala en la columna deseada (Por hacer, En progreso o Completado). El cambio se guarda automáticamente en la nube.'
  },
  {
    question: '¿Puedo invitar a otras personas a colaborar en un proyecto?',
    answer: 'Sí, ve a la sección "Team", crea o selecciona un proyecto colaborativo y usa la opción "Invitar nuevo miembro" ingresando su correo electrónico.'
  },
  {
    question: '¿Dónde encuentro mis estadísticas?',
    answer: 'En la sección "Mi Perfil" puedes ver un resumen de tus tareas (total, completadas, en progreso, por hacer). También hay una sección "Estadísticas" con gráficos próximamente.'
  },
  {
    question: '¿Cómo cambio la contraseña?',
    answer: 'Ve a "Configuración" → pestaña "Seguridad", ingresa tu contraseña actual y luego la nueva, confirma y guarda.'
  }
];

const tutorials = [
  { title: 'Guía rápida del tablero Kanban', link: '#', description: 'Organiza tus tareas de forma visual y eficiente.' },
  { title: 'Administrar proyectos y equipos', link: '#', description: 'Invita miembros, asigna proyectos y colabora.' },
  { title: 'Personaliza tu espacio de trabajo', link: '#', description: 'Configura notificaciones, temas y preferencias.' },
];

const resources = [
  { label: 'Documentación de usuario', href: '#' },
  { label: 'Política de privacidad', href: '#' },
  { label: 'Términos de servicio', href: '#' },
  { label: 'Guía de seguridad', href: '#' },
];

export default function HelpPage() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.displayName || '',
    email: user?.email || '',
    subject: 'Soporte Task Core',
    message: '',
    issueType: 'Soporte general',
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [feedbackSent, setFeedbackSent] = useState(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (!formData.message.trim()) {
      setSnackbar({ open: true, message: 'Por favor describe tu consulta o problema.', severity: 'warning' });
      return;
    }

    const mailtoBody = encodeURIComponent(`Tipo: ${formData.issueType}\n\n${formData.message}`);
    const mailtoLink = `mailto:nexodev46@gmail.com?subject=${encodeURIComponent(formData.subject)}&body=${mailtoBody}`;
    window.location.href = mailtoLink;

    setSnackbar({ open: true, message: 'Se abrió tu cliente de correo. Envía el mensaje para contactarnos.', severity: 'success' });
    setFeedbackSent(true);
    setFormData((prev) => ({ ...prev, message: '' }));
  };

  const handleReportBug = () => {
    setFormData((prev) => ({
      ...prev,
      issueType: 'Reporte de problema',
      subject: 'Reporte de problema - Task Core',
      message: prev.message || 'Describe el problema que encontraste en la aplicación.',
    }));
  };

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ mb: 4, display: 'grid', gap: 2 }}>
        <Typography sx={{ fontSize: { xs: '2rem', md: '2.5rem' }, fontWeight: 700, mb: 1 }}>
          Centro de Ayuda y Soporte
        </Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Respuestas rápidas, tutoriales y contacto directo con nuestro equipo de soporte.
        </Typography>
        <Alert severity="info" sx={{ bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
          ¿Necesitas soporte inmediato? Completa el formulario o envía un correo a{' '}
          <Link href="mailto:nexodev46@gmail.com" underline="hover">nexodev46@gmail.com</Link>.
        </Alert>
      </Box>

      <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          <Paper sx={{ p: 3, bgcolor: 'background.paper' }} elevation={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <HelpIcon color="primary" />
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 700 }}>Preguntas frecuentes</Typography>
            </Box>
            {faqs.map((faq) => (
              <Accordion key={faq.question} disableGutters elevation={0} sx={{ '&:before': { display: 'none' }, mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={{ fontWeight: 600 }}>{faq.question}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography sx={{ color: 'text.secondary' }}>{faq.answer}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Paper>

          <Paper sx={{ p: 3, bgcolor: 'background.paper' }} elevation={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <VideoLibraryIcon color="primary" />
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 700 }}>Tutoriales rápidos</Typography>
            </Box>
            <List disablePadding>
              {tutorials.map((tut) => (
                <ListItem
                  key={tut.title}
                  component="a"
                  href={tut.link}
                  target="_blank"
                  rel="noreferrer"
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    p: 2,
                    bgcolor: 'background.default',
                    textDecoration: 'none',
                    color: 'text.primary',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <ListItemIcon>
                    <VideoLibraryIcon color="primary" />
                  </ListItemIcon>
                        <ListItemText
                    primary={<Typography sx={{ fontWeight: 600 }}>{tut.title}</Typography>}
                    secondary={tut.description}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Paper sx={{ p: 3, bgcolor: 'background.paper' }} elevation={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <EmailOutlinedIcon color="primary" />
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 700 }}>Formulario de contacto</Typography>
            </Box>
            <TextField
              label="Nombre"
              name="name"
              fullWidth
              margin="normal"
              value={formData.name}
              onChange={handleInputChange}
              disabled={!!user}
            />
            <TextField
              label="Correo electrónico"
              name="email"
              type="email"
              fullWidth
              margin="normal"
              value={formData.email}
              onChange={handleInputChange}
              disabled={!!user}
            />
            <TextField
              label="Asunto"
              name="subject"
              fullWidth
              margin="normal"
              value={formData.subject}
              onChange={handleInputChange}
            />
            <TextField
              label="Mensaje"
              name="message"
              multiline
              rows={5}
              fullWidth
              margin="normal"
              value={formData.message}
              onChange={handleInputChange}
              placeholder="Describe tu consulta, sugerencia o problema..."
            />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
              <Button variant="contained" onClick={handleSubmit}>
                Enviar mensaje
              </Button>
              <Button variant="outlined" color="warning" startIcon={<BugReportIcon />} onClick={handleReportBug}>
                Reportar problema
              </Button>
            </Box>
            {feedbackSent && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Gracias por tu mensaje. También puedes escribir directamente a{' '}
                <Link href="mailto:nexodev46@gmail.com">nexodev46@gmail.com</Link>.
              </Alert>
            )}
          </Paper>

          <Paper sx={{ p: 3, bgcolor: 'background.paper' }} elevation={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <DescriptionIcon color="primary" />
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 700 }}>Documentación y políticas</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <List dense disablePadding>
              {resources.map((resource) => (
                <ListItem
                  key={resource.label}
                  component="a"
                  href={resource.href}
                  target="_blank"
                  rel="noreferrer"
                  sx={{
                    borderRadius: 1,
                    mb: 1,
                    p: 1.5,
                    bgcolor: 'background.default',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <ListItemIcon>
                    <CheckCircleIcon color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={resource.label} />
                </ListItem>
              ))}
            </List>
            <Typography sx={{ mt: 2, color: 'text.secondary' }}>
              Si necesitas ayuda adicional, escríbenos a{' '}
              <Link href="mailto:nexodev46@gmail.com">nexodev46@gmail.com</Link>.
            </Typography>
          </Paper>
        </Box>
      </Box>

      {/* Snackbar de confirmación */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity as any} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}