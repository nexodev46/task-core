import { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import {
  Box,
  Typography,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  MenuItem,
  CircularProgress
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, onSnapshot, updateDoc, doc } from 'firebase/firestore';

interface TaskItem {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  dueDate?: any;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  extendedProps: {
    description?: string;
    status?: string;
  };
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { currentProject } = useProject();
  const navigate = useNavigate();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const parseDueDate = (dueDate: any): Date | null => {
    if (!dueDate) return null;
    return dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
  };

  const loadTasks = async () => {
    if (!user) return;
    const projectId = currentProject?.id || user.uid;
    setLoading(true);

    const q = query(collection(db, 'tasks'), where('projectId', '==', projectId));
    const snapshot = await getDocs(q);
    const fetchedTasks: TaskItem[] = snapshot.docs.map(docItem => ({
      id: docItem.id,
      ...(docItem.data() as Omit<TaskItem, 'id'>)
    }));

    setTasks(fetchedTasks);
    const dueEvents: CalendarEvent[] = [];
    fetchedTasks.forEach((task) => {
      const start = parseDueDate(task.dueDate);
      if (!start) return;
      dueEvents.push({
        id: task.id,
        title: task.title || 'Sin título',
        start,
        extendedProps: { description: task.description, status: task.status }
      });
    });
    setEvents(dueEvents);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const projectId = currentProject?.id || user.uid;
    const q = query(collection(db, 'tasks'), where('projectId', '==', projectId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTasks: TaskItem[] = snapshot.docs.map(docItem => ({
        id: docItem.id,
        ...(docItem.data() as Omit<TaskItem, 'id'>)
      }));

      setTasks(fetchedTasks);
      const dueEvents: CalendarEvent[] = [];
      fetchedTasks.forEach((task) => {
        const start = parseDueDate(task.dueDate);
        if (!start) return;
        dueEvents.push({
          id: task.id,
          title: task.title || 'Sin título',
          start,
          extendedProps: { description: task.description, status: task.status }
        });
      });
      setEvents(dueEvents);
      setLoading(false);
    }, (err) => {
      console.error('Error en tiempo real en calendario:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, currentProject?.id]);

  const handleDateClick = (info: any) => {
    setSelectedDate(info.date);
    setSelectedTaskId('');
    setDialogOpen(true);
  };

  const handleEventDrop = async (info: any) => {
    const taskId = info.event.id;
    const newDate = info.event.start;
    if (!taskId || !newDate) return;

    const taskRef = doc(db, 'tasks', taskId);
    await updateDoc(taskRef, { dueDate: newDate, updatedAt: new Date() });
    await loadTasks();
  };

  const handleEventClick = (info: any) => {
    info.jsEvent.preventDefault();
    navigate('/');
  };

  const handleSaveDueDate = async () => {
    if (!selectedTaskId || !selectedDate) return;
    setSaving(true);
    try {
      const taskRef = doc(db, 'tasks', selectedTaskId);
      await updateDoc(taskRef, {
        dueDate: selectedDate,
        updatedAt: new Date()
      });
      setDialogOpen(false);
      setSelectedDate(null);
      setSelectedTaskId('');
      await loadTasks();
    } catch (error) {
      console.error('Error guardando fecha de vencimiento:', error);
    } finally {
      setSaving(false);
    }
  };

  const selectedDateLabel = selectedDate ? selectedDate.toLocaleDateString() : '';

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Calendario de tareas</Typography>
      <Paper sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            weekends={true}
            events={events}
            dateClick={handleDateClick}
            editable={true}
            eventDrop={handleEventDrop}
            eventClick={handleEventClick}
            height="auto"
            locale="es"
            buttonText={{ today: 'Hoy', month: 'Mes' }}
          />
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Asignar fecha de vencimiento</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Fecha seleccionada: <strong>{selectedDateLabel}</strong>
          </Typography>
          <FormControl fullWidth>
            <InputLabel id="task-select-label">Tarea</InputLabel>
            <Select
              labelId="task-select-label"
              value={selectedTaskId}
              label="Tarea"
              onChange={(event: SelectChangeEvent<string>) => setSelectedTaskId(event.target.value)}
            >
              {tasks.map((task) => (
                <MenuItem key={task.id} value={task.id}>
                  {task.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography sx={{ mt: 2 }} variant="body2">
            Selecciona una tarea para asignarle esta fecha de vencimiento.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSaveDueDate} variant="contained" disabled={!selectedTaskId || saving}>
            {saving ? 'Guardando...' : 'Guardar fecha'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}