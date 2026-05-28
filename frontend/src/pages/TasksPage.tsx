import { useState, useEffect, type MouseEvent } from 'react';
import {
  Box, Typography, Paper, TextField, InputAdornment, IconButton,
  FormControl, InputLabel, Select, MenuItem, Card, CardContent,
  Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Tooltip, Switch, FormControlLabel, CircularProgress, Alert, Menu
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  CheckCircle as CompleteIcon,
  RadioButtonUnchecked as PendingIcon,
  PlayArrow as ProgressIcon,
  MoreVert as MoreVertIcon,
  ChatBubbleOutlined as CommentIcon,
  CalendarToday as CalendarTodayIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { db } from '../firebase/config';
import { parseDateInput } from '../utils/dateUtils';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

type TaskStatus = 'todo' | 'in_progress' | 'completed';
type SortField = 'createdAt' | 'dueDate' | 'title';

interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  dueDate?: Date;
  createdAt: Date;
  commentsCount?: number;
  tags?: string[];
}

const statusColors = {
  todo: '#ff9800',
  in_progress: '#2196f3',
  completed: '#4caf50'
};

const statusLabels = {
  todo: 'Por hacer',
  in_progress: 'En progreso',
  completed: 'Completado'
};

const statusCardColors = {
  todo: '#fff8e1',
  in_progress: '#e3f2fd',
  completed: '#e8f5e9'
};

export default function TasksPage() {
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortDesc, setSortDesc] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({ title: '', description: '', status: 'todo' as TaskStatus, dueDate: '' });
  const [error, setError] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTask, setMenuTask] = useState<Task | null>(null);

  // Cargar tareas en tiempo real para el proyecto actual
  useEffect(() => {
    if (!currentProject) return;

    setLoading(true);
    const q = query(
      collection(db, 'tasks'),
      where('projectId', '==', currentProject.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        dueDate: doc.data().dueDate?.toDate()
      })) as Task[];

      const sorted = tasksData.sort((a, b) => {
        if (sortBy === 'title') {
          const aa = (a.title || '').toLowerCase();
          const bb = (b.title || '').toLowerCase();
          return sortDesc ? bb.localeCompare(aa) : aa.localeCompare(bb);
        }
        const av = (sortBy === 'dueDate' ? (a.dueDate ? a.dueDate.getTime() : 0) : (a.createdAt ? a.createdAt.getTime() : 0));
        const bv = (sortBy === 'dueDate' ? (b.dueDate ? b.dueDate.getTime() : 0) : (b.createdAt ? b.createdAt.getTime() : 0));
        return sortDesc ? bv - av : av - bv;
      });

      setTasks(sorted);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError('Error al cargar tareas');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentProject, sortBy, sortDesc]);

  // Filtrado y búsqueda
  const filteredTasks = tasks
    .filter(task => statusFilter === 'all' || task.status === statusFilter)
    .filter(task => {
      const text = searchTerm.toLowerCase();
      const description = task.description ? task.description.toLowerCase() : '';
      return task.title.toLowerCase().includes(text) || description.includes(text);
    });

  const isTaskOverdue = (task: Task) => {
    return task.dueDate ? task.dueDate < new Date() && task.status !== 'completed' : false;
  };

  // Acciones
  const handleDeleteById = async (id: string) => {
    await deleteDoc(doc(db, 'tasks', id));
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleStatusChange = async (id: string, newStatus: TaskStatus) => {
    await updateDoc(doc(db, 'tasks', id), { status: newStatus, updatedAt: new Date() });
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
  };

  const handleOpenMenu = (event: MouseEvent<HTMLElement>, task: Task) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuTask(task);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
    setMenuTask(null);
  };

  const handleMenuEdit = () => {
    if (menuTask) {
      handleOpenDialog(menuTask);
    }
    handleCloseMenu();
  };

  const handleMenuDelete = async () => {
    if (menuTask) {
      await handleDeleteById(menuTask.id);
    }
    handleCloseMenu();
  };

  const handleMenuChangeState = (status: TaskStatus) => {
    if (menuTask) {
      handleStatusChange(menuTask.id, status);
    }
    handleCloseMenu();
  };

  const handleOpenDialog = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title,
        description: task.description,
        status: task.status,
        dueDate: task.dueDate ? task.dueDate.toISOString().split('T')[0] : ''
      });
    } else {
      setEditingTask(null);
      setFormData({ title: '', description: '', status: 'todo', dueDate: '' });
    }
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) return;
    try {
      if (editingTask) {
        const dueDate = formData.dueDate ? parseDateInput(formData.dueDate) : null;
        await updateDoc(doc(db, 'tasks', editingTask.id), {
          title: formData.title,
          description: formData.description,
          status: formData.status,
          dueDate,
          updatedAt: new Date()
        });
        setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...formData, dueDate: dueDate || undefined } : t));
      } else {
        const newTask = {
          title: formData.title,
          description: formData.description,
          status: formData.status,
          projectId: currentProject?.id,
          createdBy: user?.uid,
          createdAt: new Date(),
          dueDate: formData.dueDate ? parseDateInput(formData.dueDate) : null,
          commentsCount: 0,
          tags: []
        };
        const docRef = await addDoc(collection(db, 'tasks'), newTask);
        setTasks(prev => [{ id: docRef.id, ...newTask, dueDate: newTask.dueDate || undefined }, ...prev]);
      }
      setOpenDialog(false);
    } catch (err) {
      console.error(err);
      alert('Error al guardar');
    }
  };

  if (!currentProject) return <Typography>Selecciona un proyecto</Typography>;

  return (
    <Box sx={{ p: 3, position: 'relative' }}>
      {/* Encabezado */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography component="h2" variant="h4" sx={{ fontWeight: 'bold' }}>Tareas</Typography>
          <Typography color="text.secondary">Administra los elementos del proyecto actual con filtros y acciones rápidas.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Nueva tarea
        </Button>
      </Box>

      {/* Barra de filtros */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <TextField
          placeholder="Buscar tareas..."
          size="small"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          slotProps={{
            htmlInput: {
              autoComplete: 'off',
              name: 'taskcore-tasks-search',
              inputMode: 'search',
              spellCheck: false,
            },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            },
          }}
          sx={{ flexGrow: 1, minWidth: 200 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Estado</InputLabel>
          <Select value={statusFilter} label="Estado" onChange={e => setStatusFilter(e.target.value as any)}>
            <MenuItem value="all">Todas</MenuItem>
            <MenuItem value="todo">Por hacer</MenuItem>
            <MenuItem value="in_progress">En progreso</MenuItem>
            <MenuItem value="completed">Completadas</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Ordenar por</InputLabel>
          <Select value={sortBy} label="Ordenar por" onChange={e => setSortBy(e.target.value as SortField)}>
            <MenuItem value="createdAt">Fecha de creación</MenuItem>
            <MenuItem value="dueDate">Fecha de vencimiento</MenuItem>
            <MenuItem value="title">Título</MenuItem>
          </Select>
        </FormControl>
        <FormControlLabel
          control={<Switch checked={sortDesc} onChange={e => setSortDesc(e.target.checked)} />}
          label="Descendente"
        />
      </Paper>

      {/* Lista de tareas */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : filteredTasks.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="textSecondary">No hay tareas que coincidan con los filtros.</Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
          {filteredTasks.map(task => (
            <Box key={task.id}>
              <Card sx={{ maxWidth: 360, width: '100%', mx: 'auto', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3, overflow: 'hidden', backgroundColor: statusCardColors[task.status], border: '1px solid rgba(15, 23, 42, 0.12)', boxShadow: '0 18px 45px rgba(15, 23, 42, 0.10)', transition: 'transform 0.2s, border-color 0.2s', '&:hover': { transform: 'translateY(-4px)', borderColor: 'rgba(59, 130, 246, 0.35)' } }}>
                <CardContent sx={{ flexGrow: 1, p: 3, position: 'relative' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, wordBreak: 'break-all', overflowWrap: 'break-word' }}>{task.title}</Typography>
                      {isTaskOverdue(task) && (
                        <Chip
                          label="Atrasada"
                          size="small"
                          sx={{ mt: 1, bgcolor: '#ffebee', color: '#c62828', fontWeight: 700 }}
                        />
                      )}
                    </Box>
                    <IconButton size="small" onClick={(event) => handleOpenMenu(event, task)}>
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, whiteSpace: 'pre-line', minHeight: 56, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    {task.description || 'Sin descripción'}
                  </Typography>

                  {task.tags?.length ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                      {task.tags.map((tag, index) => (
                        <Chip
                          key={`${task.id}-tag-${index}`}
                          label={tag}
                          size="small"
                          sx={{ bgcolor: 'rgba(25, 118, 210, 0.08)', color: '#1565c0', fontWeight: 600 }}
                        />
                      ))}
                    </Box>
                  ) : null}

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>
                    <Chip
                      label={statusLabels[task.status]}
                      size="small"
                      sx={{ bgcolor: statusColors[task.status], color: 'white', fontWeight: 700 }}
                    />
                    {task.dueDate && (
                      <Chip
                        icon={<ScheduleIcon fontSize="small" />}
                        label={task.status === 'completed' ? 'Finalizada' : `Vence ${(() => {
                          const dueDate = task.dueDate instanceof Date ? task.dueDate : parseDateInput(task.dueDate as any);
                          return dueDate ? dueDate.toLocaleDateString() : 'Sin fecha';
                        })()}`}
                        size="small"
                        variant="outlined"
                        sx={{ borderColor: '#cfd8dc', color: 'text.secondary' }}
                      />
                    )}
                    {typeof task.commentsCount === 'number' && (
                      <Chip
                        icon={<CommentIcon fontSize="small" />}
                        label={`${task.commentsCount} comentarios`}
                        size="small"
                        variant="outlined"
                        sx={{ borderColor: '#cfd8dc', color: 'text.secondary' }}
                      />
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary', fontSize: '0.85rem' }}>
                      <CalendarTodayIcon fontSize="small" />
                      <Typography variant="caption">
                        Creada: {task.createdAt?.toLocaleDateString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {task.status !== 'completed' && (
                        <Tooltip title="Marcar como completada">
                          <IconButton size="small" onClick={() => handleStatusChange(task.id, 'completed')}><CompleteIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                      {task.status === 'todo' && (
                        <Tooltip title="Mover a en progreso">
                          <IconButton size="small" onClick={() => handleStatusChange(task.id, 'in_progress')}><ProgressIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                      {task.status === 'in_progress' && (
                        <Tooltip title="Mover a por hacer">
                          <IconButton size="small" onClick={() => handleStatusChange(task.id, 'todo')}><PendingIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
              <Menu
                anchorEl={menuAnchorEl}
                open={Boolean(menuAnchorEl) && menuTask?.id === task.id}
                onClose={handleCloseMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <MenuItem onClick={handleMenuEdit}>Editar</MenuItem>
                <MenuItem onClick={handleMenuDelete}>Eliminar</MenuItem>
                <MenuItem disabled={task.status === 'todo'} onClick={() => handleMenuChangeState('todo')}>Por hacer</MenuItem>
                <MenuItem disabled={task.status === 'in_progress'} onClick={() => handleMenuChangeState('in_progress')}>En progreso</MenuItem>
                <MenuItem disabled={task.status === 'completed'} onClick={() => handleMenuChangeState('completed')}>Completado</MenuItem>
              </Menu>
            </Box>
          ))}
        </Box>
      )}

      {/* Diálogo para crear/editar tarea */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTask ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Título"
            fullWidth
            margin="dense"
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
          />
          <TextField
            label="Descripción"
            fullWidth
            margin="dense"
            multiline
            rows={3}
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Estado</InputLabel>
            <Select value={formData.status} label="Estado" onChange={e => setFormData({ ...formData, status: e.target.value as TaskStatus })}>
              <MenuItem value="todo">Por hacer</MenuItem>
              <MenuItem value="in_progress">En progreso</MenuItem>
              <MenuItem value="completed">Completado</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Fecha de vencimiento"
            type="date"
            fullWidth
            margin="dense"
            value={formData.dueDate}
            onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained">Guardar</Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1200 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ borderRadius: 4, px: 3, py: 1.5, boxShadow: '0 12px 30px rgba(25, 118, 210, 0.18)' }}
        >
          Agregar tarea
        </Button>
      </Box>
    </Box>
  );
}