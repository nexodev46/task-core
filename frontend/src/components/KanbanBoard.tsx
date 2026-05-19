import { useState, useEffect, type DragEvent } from 'react';
import { useSearch } from '../context/SearchContext';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { Grid, Paper, Typography, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Chip, Box } from '@mui/material';
import { subscribeToTasks, createTask, updateTask } from '../services/taskService';

type StatusLabel = 'Por hacer' | 'En progreso' | 'Completado';

interface TaskItem {
  id: string | number;
  title: string;
  description: string;
  tags: string[];
  comments: number;
  status?: string;
  projectId?: string;
}

type TaskBoard = Record<StatusLabel, TaskItem[]>;

interface NewTask {
  title: string;
  description: string;
  status: StatusLabel;
  tags: string[];
}

// Datos de ejemplo (igual a tu prototipo)
const sampleTasks: TaskBoard = {
  'Por hacer': [
    { id: 1, title: 'Marketing y Ventas', description: 'Aumentar la conversión en nuestra página de aterrizaje', tags: ['Nuevo proyecto'], comments: 2, projectId: 'anonimo' },
    { id: 2, title: 'Investigación de usuarios', description: 'Entrevistar a los usuarios e identificar los distintos problemas.', tags: ['Nuevo cliente', 'Planificación'], comments: 1, projectId: 'anonimo' }
  ],
  'En progreso': [
    { id: 3, title: 'Pedir Placas de cimentación', description: 'No olvidar antes del viernes. Llamar al 115558932. 10 placas de madera.', tags: ['Nuevo proyecto', 'Planificación'], comments: 2, projectId: 'anonimo' },
    { id: 4, title: 'Agregar input de email', description: 'Validar los datos y comprobar que los tests estén correctos.', tags: ['Nuevo cliente', 'Sistema de diseño'], comments: 1, projectId: 'anonimo' },
    { id: 5, title: 'Rediseño de la app', description: 'Realizar propuesta de rediseño y esperar feedback.', tags: ['Nuevo proyecto'], comments: 2, projectId: 'anonimo' }
  ],
  'Completado': [
    { id: 6, title: 'Llevar a Pepes al veterinario', description: 'Hacer ecografía y análisis de sangre. Turno a las 17:00hs.', tags: ['Nuevo cliente', 'Sistema de diseño'], comments: 3, projectId: 'anonimo' }
  ]
};

export default function KanbanBoard() {
  const [tasks, setTasks] = useState<TaskBoard>(sampleTasks);
  const [remoteTasks, setRemoteTasks] = useState<TaskItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [newTask, setNewTask] = useState<NewTask>({ title: '', description: '', status: 'Por hacer', tags: [] });
  const [newTag, setNewTag] = useState<string>('');
  const { searchTerm } = useSearch();
  const { user } = useAuth();
  const { currentProject } = useProject();
  const projectId = currentProject?.id || user?.uid || 'anonimo';

  // Subscribe to real-time tasks for the current project
  useEffect(() => {
    let unsub: any;
    if (currentProject?.id) {
      unsub = subscribeToTasks(currentProject.id, (items: TaskItem[]) => {
        setRemoteTasks(items);
      });
    } else {
      setRemoteTasks(null);
    }
    return () => { if (unsub) unsub(); };
  }, [currentProject]);

  // Choose remoteTasks when available, otherwise use local sampleTasks
  const itemsList: TaskItem[] = remoteTasks ? remoteTasks : Object.values(tasks).flat();
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const isEmailSearch = normalizedSearchTerm.length > 0 && /^\S+@\S+\.\S+$/.test(normalizedSearchTerm);
  const filteredTasks = !normalizedSearchTerm || isEmailSearch
    ? itemsList
    : itemsList.filter((task) =>
        task.title.toLowerCase().includes(normalizedSearchTerm) ||
        task.description.toLowerCase().includes(normalizedSearchTerm)
      );

  const grouped: TaskBoard = {
    'Por hacer': filteredTasks.filter((t) => (t.status || 'Por hacer') === 'Por hacer'),
    'En progreso': filteredTasks.filter((t) => (t.status || 'Por hacer') === 'En progreso'),
    'Completado': filteredTasks.filter((t) => (t.status || 'Por hacer') === 'Completado')
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (tag && !newTask.tags.includes(tag)) {
      setNewTask({ ...newTask, tags: [...newTask.tags, tag] });
      setNewTag('');
    }
  };
  const removeTag = (tag: string) => setNewTask({ ...newTask, tags: newTask.tags.filter(t => t !== tag) });
  const handleAddTask = () => {
    if (!newTask.title.trim()) return;
    if (currentProject?.id) {
      createTask({
        title: newTask.title,
        description: newTask.description,
        status: newTask.status,
        tags: newTask.tags,
        comments: 0,
        projectId: currentProject.id
      }).catch((err: any) => console.error('createTask error', err));
    } else {
      setTasks({
        ...tasks,
        [newTask.status]: [...tasks[newTask.status], { id: Date.now(), title: newTask.title, description: newTask.description, tags: newTask.tags, comments: 0, projectId: projectId }]
      });
    }
    setOpen(false);
    setNewTask({ title: '', description: '', status: 'Por hacer', tags: [] });
    setNewTag('');
  };
  const handleDragStart = (e: DragEvent<HTMLDivElement>, id: string | number, status: StatusLabel) => {
    e.dataTransfer.setData('taskId', String(id));
    e.dataTransfer.setData('sourceStatus', status);
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>, targetStatus: StatusLabel) => {
    const taskId = parseInt(e.dataTransfer.getData('taskId'));
    const sourceStatus = e.dataTransfer.getData('sourceStatus') as StatusLabel;
    if (sourceStatus === targetStatus) return;
    // Support numeric ids (local) and string ids (remote)
    const parsedIdNum = Number.isNaN(Number(taskId)) ? e.dataTransfer.getData('taskId') : taskId;
    let task: TaskItem | undefined;
    if (remoteTasks) {
      task = remoteTasks.find((t) => String(t.id) === String(parsedIdNum));
      if (!task) return;
      updateTask(String(task.id), { status: targetStatus }).catch((err: any) => console.error('updateTask error', err));
    } else {
      task = tasks[sourceStatus].find((t: TaskItem) => t.id === parsedIdNum);
      if (!task) return;
      setTasks({
        ...tasks,
        [sourceStatus]: tasks[sourceStatus].filter((t: TaskItem) => t.id !== parsedIdNum),
        [targetStatus]: [...tasks[targetStatus], task]
      });
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => e.preventDefault();

  return (
    <Box>
      <Grid container spacing={3}>
        {Object.entries(grouped).map(([status, taskList]) => (
          <Grid component="div" size={{ xs: 12, md: 4 }} key={status} onDrop={(e) => handleDrop(e, status as StatusLabel)} onDragOver={handleDragOver}>
            <Paper sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2, minHeight: 400 }}>
              <Typography variant="h6" align="center" gutterBottom>{status}</Typography>
              {taskList.map((task: TaskItem) => (
                <Paper key={task.id} draggable onDragStart={(e) => handleDragStart(e, task.id, status as StatusLabel)} sx={{ p: 2, mb: 2, cursor: 'grab' }}>
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
                    {task.tags.map((tag: string) => <Typography key={tag} variant="caption" sx={{ bgcolor: '#e0e0e0', px: 1, borderRadius: 1 }}>{tag}</Typography>)}
                  </Box>
                  <Typography variant="caption">{task.comments} Comentarios</Typography>
                </Paper>
              ))}
              <Button fullWidth variant="text" onClick={() => setOpen(true)} sx={{ mt: 1, color: 'primary.main', textTransform: 'none' }}>
                + Añadir tarjeta
              </Button>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nueva Tarea</DialogTitle>
        <DialogContent>
          <TextField select label="Columna" fullWidth margin="dense" value={newTask.status} onChange={e => setNewTask({...newTask, status: e.target.value as StatusLabel})} slotProps={{ select: { native: true } }}>
            {Object.keys(tasks).map(s => <option key={s} value={s}>{s}</option>)}
          </TextField>
          <TextField label="Título" fullWidth margin="dense" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} />
          <TextField label="Descripción" fullWidth multiline rows={3} margin="dense" value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} />
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Etiquetas</Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField size="small" label="Nueva etiqueta" value={newTag} onChange={e => setNewTag(e.target.value)} />
              <Button onClick={addTag} variant="outlined">Agregar</Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              {newTask.tags.map(tag => <Chip key={tag} label={tag} size="small" onDelete={() => removeTag(tag)} />)}
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