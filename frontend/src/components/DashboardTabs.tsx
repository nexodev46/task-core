import { useState, useEffect, useRef } from 'react';
import { parseDateInput } from '../utils/dateUtils';
import { Paper, Typography, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Chip, Box, Select, MenuItem } from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CommentIcon from '@mui/icons-material/Comment';
import LabelImportantIcon from '@mui/icons-material/LabelImportant';
import { useSearch } from '../context/SearchContext';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { createTask, updateTask, deleteTask } from '../services/taskService';
import CoreAI from './CoreAI';
import { FilterConfig } from './FilterPanel';

type StatusKey = 'todo' | 'in_progress' | 'completed';
type StatusLabel = 'Por hacer' | 'En progreso' | 'Completado';

interface Task {
  id: string;
  title: string;
  description: string;
  status: StatusKey;
  tags: string[];
  commentsCount: number;
  dueDate?: Date | null;
}

interface NewTask {
  title: string;
  description: string;
  status: StatusLabel;
  tags: string[];
}

interface KanbanBoardProps {
  filters?: FilterConfig;
}

const statusMap = {
  'todo': 'Por hacer',
  'in_progress': 'En progreso',
  'completed': 'Completado'
};

const reverseStatusMap: Record<StatusLabel, StatusKey> = {
  'Por hacer': 'todo',
  'En progreso': 'in_progress',
  'Completado': 'completed'
};

export default function KanbanBoard({ filters }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [open, setOpen] = useState(false);
  const [newTask, setNewTask] = useState<NewTask>({ title: '', description: '', status: 'Por hacer', tags: [] });
  const [newTag, setNewTag] = useState<string>('');
  const { searchTerm } = useSearch();

  const { user } = useAuth();
  const { currentProject } = useProject();

  useEffect(() => {
    if (!user) return; // esperar autenticación

    const projectId = currentProject?.id || user.uid;
    if (firstLoad) setLoading(true);
    const q = query(collection(db, 'tasks'), where('projectId', '==', projectId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = Array.from(snapshot.docs.reduce<Map<string, Task>>((map, doc) => {
          if (!map.has(doc.id)) {
            const data = doc.data();
            map.set(doc.id, {
              id: doc.id,
              title: data.title || '',
              description: data.description || '',
              status: data.status as StatusKey,
              tags: (data.tags || []) as string[],
              commentsCount: data.commentsCount || 0,
              dueDate: data.dueDate ? (data.dueDate.toDate ? data.dueDate.toDate() : parseDateInput(data.dueDate)) : null,
            });
          }
          return map;
        }, new Map<string, Task>()).values());

        setTasks(items);
        setLoading(false);
        setFirstLoad(false);
      },
      (error) => {
        console.error('Error en tiempo real al cargar tareas:', error);
        setLoading(false);
        setFirstLoad(false);
      }
    );

    return () => unsubscribe();
  }, [user, currentProject?.id]);

  const addTag = () => {
    const tag = newTag.trim();
    if (tag && !newTask.tags.includes(tag)) {
      setNewTask({ ...newTask, tags: [...newTask.tags, tag] });
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setNewTask({ ...newTask, tags: newTask.tags.filter(tag => tag !== tagToRemove) });
  };

  const dragTaskId = useRef<string | null>(null);
  const dropCompleted = useRef(false);

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    const projId = currentProject?.id || user?.uid;
    if (!projId) return;

    const taskPayload = {
      title: newTask.title,
      description: newTask.description,
      status: reverseStatusMap[newTask.status],
      projectId: projId,
      tags: newTask.tags,
      commentsCount: 0,
    };

    const result = await createTask(taskPayload);
    setTasks(prev => {
      if (prev.some(task => task.id === result.id)) {
        return prev;
      }
      return [...prev, { id: result.id, ...taskPayload }];
    });

    setOpen(false);
    setNewTask({ title: '', description: '', status: 'Por hacer', tags: [] });
    setNewTag('');
  };

  const handleDragStart = (e: any, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    dragTaskId.current = taskId;
    dropCompleted.current = false;
  };

  const handleDragEnd = async () => {
    const taskId = dragTaskId.current;
    dragTaskId.current = null;
    if (!taskId) return;

    if (dropCompleted.current) {
      dropCompleted.current = false;
      return;
    }

    const previousTasks = tasks;
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));

    try {
      await deleteTask(taskId);
    } catch (err) {
      console.error('Error al eliminar tarea fuera del tablero:', err);
      setTasks(previousTasks);
    }
  };

  const handleDrop = async (e: any, targetStatusSpanish: StatusLabel) => {
    e.preventDefault();
    e.stopPropagation();
    dropCompleted.current = true;
    const taskId = e.dataTransfer.getData('taskId');
    const newStatus = reverseStatusMap[targetStatusSpanish];
    
    // Actualizar estado local inmediatamente para UI responsiva
    const previousTasks = tasks;
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, status: newStatus } : task
      )
    );

    try {
      await updateTask(taskId, { status: newStatus });
    } catch (err) {
      console.error('Error al mover tarea:', err);
      setTasks(previousTasks);
    }
  };

  const handleDropOutside = async (e: any) => {
    e.preventDefault();
    dropCompleted.current = true;
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;

    const previousTasks = tasks;
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));

    try {
      await deleteTask(taskId);
    } catch (err) {
      console.error('Error al eliminar tarea fuera del tablero:', err);
      setTasks(previousTasks);
    }
  };

  const handleDragOver = (e: any) => e.preventDefault();

  if (loading && firstLoad) return <Typography align="center">Cargando tareas...</Typography>;

  const normalizeStatusLabel = (status?: StatusKey) => {
    return statusMap[status as StatusKey] || 'Por hacer';
  };

  const uniqueById = <T extends { id: string }>(items: T[]) =>
    Array.from(new Map(items.map(item => [item.id, item])).values());

  const isTaskOverdue = (dueDate: Date | null | undefined): boolean => {
    if (!dueDate) return false;
    return dueDate < new Date();
  };

  const isTaskDueSoon = (dueDate: Date | null | undefined): boolean => {
    if (!dueDate) return false;
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const diff = dueDate.getTime() - now.getTime();
    return diff <= oneDay && diff >= 0;
  };

  let filteredTasks = uniqueById(tasks).filter((task) =>
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Aplicar filtros avanzados del panel
  if (filters) {
    filteredTasks = filteredTasks.filter((task) => {
      // Filtro de estado
      const statusKey = task.status as StatusKey;
      if (!filters.status[statusKey]) return false;

      // Filtro de etiquetas
      if (filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some((tag) =>
          task.tags.includes(tag)
        );
        if (!hasMatchingTag) return false;
      }

      // Filtro de fecha
      if (filters.dateFilter !== 'all') {
        if (filters.dateFilter === 'overdue' && !isTaskOverdue(task.dueDate)) {
          return false;
        }
        if (filters.dateFilter === 'due_soon' && !isTaskDueSoon(task.dueDate)) {
          return false;
        }
        if (filters.dateFilter === 'no_date' && task.dueDate) {
          return false;
        }
      }

      // Filtro de comentarios
      if (filters.hasComments !== 'all') {
        if (filters.hasComments === 'with_comments' && task.commentsCount === 0) {
          return false;
        }
        if (filters.hasComments === 'without_comments' && task.commentsCount > 0) {
          return false;
        }
      }

      return true;
    });
  }

  // Agrupar tareas por estado en español
  const grouped: Record<StatusLabel, Task[]> = {
    'Por hacer': filteredTasks.filter(t => normalizeStatusLabel(t.status) === 'Por hacer'),
    'En progreso': filteredTasks.filter(t => normalizeStatusLabel(t.status) === 'En progreso'),
    'Completado': filteredTasks.filter(t => normalizeStatusLabel(t.status) === 'Completado')
  };

  const columnColors: Record<StatusLabel, string> = {
    'Por hacer': '#ffedd5',   // tono naranja muy suave
    'En progreso': '#dbeafe', // tono azul muy suave
    'Completado': '#dcfce7'   // tono verde muy suave
  };

  const columnAccentBars: Record<StatusLabel, string[]> = {
    'Por hacer': ['#ffd5a8', '#ffc69a', '#ffb07a'],
    'En progreso': ['#9be3ff', '#6fcfff', '#2b9bff'],
    'Completado': ['#c6f6d5', '#9fe9b8', '#6fe09a']
  };

  const tagPalette = [
    { bg: '#eef2ff', color: '#1e3a8a', border: '#c7d2fe' },
    { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    { bg: '#ecfccb', color: '#365314', border: '#d9f99d' },
    { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
    { bg: '#fde8e8', color: '#981b1b', border: '#fecaca' },
    { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
    { bg: '#f5f3ff', color: '#5b21b6', border: '#ddd6fe' },
    { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
    { bg: '#fff7ed', color: '#9a3412', border: '#fdba74' },
    { bg: '#f8fafc', color: '#334155', border: '#cbd5e1' }
  ];

  const getTagStyle = (tag: string) => {
    const normalized = tag.trim().toLowerCase();
    if (!normalized) return tagPalette[0];
    let hash = 0;
    for (let i = 0; i < normalized.length; i += 1) {
      hash = (hash * 31 + normalized.charCodeAt(i)) % tagPalette.length;
    }
    return tagPalette[hash];
  };

  return (
    <Box onDrop={handleDropOutside} onDragOver={handleDragOver}>
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(280px, 1fr))' }, alignItems: 'start' }}>
        {Object.entries(grouped).map(([status, taskList]) => (
          <Box
            key={status}
            onDrop={(e) => handleDrop(e, status as StatusLabel)}
            onDragOver={handleDragOver}
          >
            <Paper sx={{ p: 2.5, bgcolor: columnColors[status as StatusLabel] || '#f5f5f5', borderRadius: 2, minHeight: 520, display: 'flex', flexDirection: 'column', borderLeft: `6px solid ${columnColors[status as StatusLabel] || '#f5f5f5'}` }}>
              <Typography variant="h6" align="center" gutterBottom>{`${status} (${taskList.length})`}</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.2, mb: 1 }} aria-hidden>
                {(columnAccentBars[status as StatusLabel] || ['#d1d5db','#9ca3af','#6b7280']).map((c, i) => (
                  <Box
                    key={i}
                    component="span"
                    sx={{
                      width: { xs: 28, sm: 36 },
                      height: 6,
                      borderRadius: 3,
                      background: c,
                      display: 'inline-block',
                      boxShadow: '0 6px 18px rgba(15, 23, 42, 0.06)'
                    }}
                  />
                ))}
              </Box>
              {taskList.map((task) => (
                <Paper
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  sx={{
                    p: 2.5,
                    mb: 2,
                    cursor: 'grab',
                    borderRadius: 3,
                    boxShadow: '0 14px 30px rgba(15, 23, 42, 0.08)',
                    transition: 'transform 200ms ease, box-shadow 200ms ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 22px 45px rgba(15, 23, 42, 0.16)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 'bold',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                        fontSize: '1.05rem',
                        lineHeight: 1.2,
                      }}
                    >
                      {task.title}
                    </Typography>
                    <Chip
                      icon={<LabelImportantIcon fontSize="small" />}
                      label={normalizeStatusLabel(task.status)}
                      size="small"
                      variant="outlined"
                      sx={{ textTransform: 'none', fontWeight: 600, borderColor: 'divider' }}
                    />
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      whiteSpace: 'normal',
                      fontSize: '0.95rem',
                      lineHeight: 1.6,
                      color: 'text.secondary',
                      mb: 1.5,
                    }}
                  >
                    {task.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', my: 1 }}>
                    {task.tags?.map((tag: string) => {
                      const style = getTagStyle(tag);
                      return (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          variant="outlined"
                          sx={{
                            backgroundColor: style.bg,
                            color: style.color,
                            borderColor: style.border,
                            textTransform: 'none',
                          }}
                        />
                      );
                    })}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mt: 2, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                      <CalendarTodayIcon fontSize="small" />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {task.dueDate
                          ? new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(task.dueDate)
                          : 'Sin fecha'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                      <CommentIcon fontSize="small" />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {task.commentsCount || 0} comentarios
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              ))}
              <Button
                fullWidth
                variant="contained"
                onClick={(e) => { e.currentTarget.blur(); setOpen(true); }}
                sx={{
                  mt: 1,
                  backgroundColor: '#eef3ff',
                  color: '#1f2937',
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: '#dbeafe',
                  },
                }}
              >
                + Añadir tarjeta
              </Button>
            </Paper>
          </Box>
        ))}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nueva Tarea</DialogTitle>
        <DialogContent>
          <Select
            label="Columna"
            fullWidth
            autoFocus
            value={newTask.status}
            onChange={(e) => setNewTask({ ...newTask, status: (e.target.value as StatusLabel) })}
            margin="dense"
            sx={{ mb: 1 }}
          >
            {Object.keys(grouped).map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
          <TextField
            label="Título"
            fullWidth
            margin="dense"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
          />
          <TextField
            label="Descripción"
            fullWidth
            multiline
            rows={3}
            margin="dense"
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
          />
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Etiquetas</Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField size="small" label="Nueva etiqueta" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
              <Button
                onClick={addTag}
                variant="contained"
                sx={{
                  backgroundColor: '#f0f9ff',
                  color: '#1d4ed8',
                  textTransform: 'none',
                  border: '1px solid #dbeafe',
                  '&:hover': {
                    backgroundColor: '#dbeafe',
                  },
                }}
              >
                Agregar
              </Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              {newTask.tags.map(tag => (
                <Chip key={tag} label={tag} size="small" onDelete={() => removeTag(tag)} />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleAddTask} variant="contained">Crear</Button>
        </DialogActions>
      </Dialog>
      <CoreAI
        items={tasks}
        projectId={currentProject?.id || user?.uid || 'anonimo'}
        projectName={currentProject?.name}
        userName={user?.displayName || user?.email?.split('@')[0] || undefined}
      />
    </Box>
  );
}