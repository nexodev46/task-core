import { useState, useEffect, useRef, type DragEvent } from 'react';
import { Paper, Typography, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Chip, Box } from '@mui/material';
import { useSearch } from '../context/SearchContext';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { createTask, updateTask, deleteTask } from '../services/taskService';
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


export default function KanbanBoard() {
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
              dueDate: data.dueDate ? (data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate)) : null,
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

  const handleDragStart = (e: DragEvent<HTMLDivElement>, taskId: string) => {
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

  const handleDrop = async (e: DragEvent<HTMLDivElement>, targetStatusSpanish: StatusLabel) => {
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

  const handleDropOutside = async (e: DragEvent<HTMLDivElement>) => {
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

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => e.preventDefault();

  if (loading && firstLoad) return <Typography align="center">Cargando tareas...</Typography>;

  const normalizeStatusLabel = (status?: StatusKey) => {
    return statusMap[status as StatusKey] || 'Por hacer';
  };

  const uniqueById = <T extends { id: string }>(items: T[]) =>
    Array.from(new Map(items.map(item => [item.id, item])).values());

  const filteredTasks = uniqueById(tasks).filter((task) =>
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Agrupar tareas por estado en español
  const grouped: Record<StatusLabel, Task[]> = {
    'Por hacer': filteredTasks.filter(t => normalizeStatusLabel(t.status) === 'Por hacer'),
    'En progreso': filteredTasks.filter(t => normalizeStatusLabel(t.status) === 'En progreso'),
    'Completado': filteredTasks.filter(t => normalizeStatusLabel(t.status) === 'Completado')
  };

  return (
    <Box onDrop={handleDropOutside} onDragOver={handleDragOver}>
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(280px, 1fr))' }, alignItems: 'start' }}>
        {Object.entries(grouped).map(([status, taskList]) => (
          <Box
            key={status}
            onDrop={(e) => {
              e.stopPropagation();
              handleDrop(e, status as StatusLabel);
            }}
            onDragOver={handleDragOver}
          >
            <Paper sx={{ p: 2.5, bgcolor: '#f9fafb', borderRadius: 3, minHeight: 520, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" align="center" gutterBottom>{status}</Typography>
              {taskList.map((task) => (
                <Paper
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  sx={{ p: 2, mb: 2, cursor: 'grab' }}
                >
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 'bold',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      fontSize: '1.05rem',
                      lineHeight: 1.15,
                      mb: 0.5,
                    }}
                  >
                    {task.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      whiteSpace: 'normal',
                      fontSize: '0.95rem',
                      lineHeight: 1.3,
                      color: 'text.secondary',
                    }}
                  >
                    {task.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', my: 1 }}>
                    {task.tags?.map((tag: string) => (
                      <Typography key={tag} variant="caption" sx={{ bgcolor: '#e0e0e0', px: 1, borderRadius: 1 }}>
                        {tag}
                      </Typography>
                    ))}
                  </Box>
                  {task.dueDate && (
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
                      Vence: {new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(task.dueDate)}
                    </Typography>
                  )}
                  <Typography variant="caption">{task.commentsCount || 0} Comentarios</Typography>
                </Paper>
              ))}
              <Button fullWidth variant="text" onClick={() => setOpen(true)} sx={{ mt: 1, color: 'primary.main', textTransform: 'none' }}>
                + Añadir tarjeta
              </Button>
            </Paper>
          </Box>
        ))}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nueva Tarea</DialogTitle>
        <DialogContent>
          <TextField
            select
            label="Columna"
            fullWidth
            margin="dense"
            value={newTask.status}
            onChange={(e) => setNewTask({ ...newTask, status: e.target.value as StatusLabel })}
            slotProps={{ select: { native: true } }}
          >
            {Object.keys(grouped).map(s => <option key={s} value={s}>{s}</option>)}
          </TextField>
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
              <Button onClick={addTag} variant="outlined">Agregar</Button>
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
    </Box>
  );
}