import { useState, useEffect, type DragEvent } from 'react';
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
  MenuItem,
  CircularProgress,
  Chip,
  Divider,
  ButtonGroup,
  TextField
} from '@mui/material';
import {
  Add as AddIcon,
  CalendarToday as CalendarTodayIcon,
  ArrowBackIosNew as ArrowBackIcon,
  ArrowForwardIos as ArrowForwardIcon,
  Today as TodayIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { db } from '../firebase/config';
import { parseDateInput } from '../utils/dateUtils';
import { collection, query, where, onSnapshot, updateDoc, addDoc, deleteDoc, doc } from 'firebase/firestore';

interface TaskItem {
  id: string;
  title?: string;
  description?: string;
  status?: 'todo' | 'in_progress' | 'completed';
  dueDate?: Date | null;
  createdAt?: Date | null;
  tags?: string[];
}

type ViewMode = 'month' | 'week' | 'list';

type StatusFilter = 'all' | 'todo' | 'in_progress' | 'completed';

const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const statusColors = {
  todo: '#0288d1',
  in_progress: '#1976d2',
  completed: '#2e7d32'
};

const statusBackgrounds = {
  todo: 'rgba(2, 136, 209, 0.12)',
  in_progress: 'rgba(25, 118, 210, 0.12)',
  completed: 'rgba(46, 125, 50, 0.12)'
};

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function areSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function parseDueDate(dueDate: any): Date | null {
  if (!dueDate) return null;
  if (dueDate instanceof Date) return dueDate;
  if (dueDate.toDate) return dueDate.toDate();
  const parsed = new Date(dueDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildMonthGrid(reference: Date) {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const dayOfWeek = (firstOfMonth.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - dayOfWeek);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return date;
  });
}

function buildWeekGrid(reference: Date) {
  const dayOfWeek = (reference.getDay() + 6) % 7;
  const monday = new Date(reference);
  monday.setDate(reference.getDate() - dayOfWeek);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

function formatInputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<TaskItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', status: 'todo' as TaskItem['status'], dueDate: '', tags: '' });

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const projectId = currentProject?.id || user.uid;
    const q = query(collection(db, 'tasks'), where('projectId', '==', projectId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTasks: TaskItem[] = snapshot.docs.map(docItem => ({
        id: docItem.id,
        ...(docItem.data() as Omit<TaskItem, 'id'>)
      })).map(task => ({
        ...task,
        dueDate: parseDueDate(task.dueDate),
        createdAt: parseDueDate(task.createdAt)
      }));

      setTasks(fetchedTasks);
      setLoading(false);
    }, (err) => {
      console.error('Error al cargar tareas en calendario:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, currentProject?.id]);

  const filteredTasks = tasks
    .filter(task => filterStatus === 'all' || task.status === filterStatus)
    .filter(task => tagFilter === 'all' || (task.tags || []).includes(tagFilter));

  const today = new Date();
  const monthGrid = buildMonthGrid(currentDate);
  const weekGrid = buildWeekGrid(currentDate);
  const years = Array.from({ length: 5 }, (_, idx) => today.getFullYear() - 2 + idx);
  const allTags = Array.from(new Set(tasks.flatMap(task => task.tags || []))).sort();

  const tasksByDay = monthGrid.reduce((map, date) => {
    const key = formatDateKey(date);
    map.set(key, filteredTasks.filter((task) => task.dueDate && formatDateKey(task.dueDate) === key));
    return map;
  }, new Map<string, TaskItem[]>());

  const tasksByWeekSlot = new Map<string, TaskItem[]>();
  filteredTasks.forEach((task) => {
    if (!task.dueDate) return;
    const dateKey = formatDateKey(task.dueDate);
    const hour = task.dueDate.getHours() || 9;
    const slotKey = `${dateKey}-${hour}`;
    const entries = tasksByWeekSlot.get(slotKey) ?? [];
    entries.push(task);
    tasksByWeekSlot.set(slotKey, entries);
  });

  const handleChangeMonth = (monthIndex: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), monthIndex, 1));
  };

  const handleChangeYear = (year: number) => {
    setCurrentDate(prev => new Date(year, prev.getMonth(), 1));
  };

  const handlePrev = () => {
    setCurrentDate(prev => viewMode === 'week'
      ? new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7)
      : new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const handleNext = () => {
    setCurrentDate(prev => viewMode === 'week'
      ? new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7)
      : new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  const handleToday = () => setCurrentDate(new Date());

  const openTaskDialog = (date?: Date, task?: TaskItem) => {
    if (task) {
      setEditTask(task);
      setTaskForm({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'todo',
        dueDate: task.dueDate ? formatInputDate(task.dueDate) : '',
        tags: (task.tags || []).join(', ')
      });
    } else {
      setEditTask(null);
      setTaskForm({
        title: '',
        description: '',
        status: 'todo',
        dueDate: date ? formatInputDate(date) : '',
        tags: ''
      });
    }
    setTaskDialogOpen(true);
  };

  const closeTaskDialog = () => {
    setTaskDialogOpen(false);
    setEditTask(null);
    setTaskForm({ title: '', description: '', status: 'todo', dueDate: '', tags: '' });
  };

  const handleSaveTask = async () => {
    if (!user || !taskForm.title.trim()) return;
    setSaving(true);
    try {
      const dueDate = taskForm.dueDate ? parseDateInput(taskForm.dueDate) : null;
      const payload = {
        title: taskForm.title,
        description: taskForm.description,
        status: taskForm.status,
        dueDate,
        tags: taskForm.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        projectId: currentProject?.id || user.uid,
        updatedAt: new Date(),
        createdAt: editTask?.createdAt || new Date()
      };

      if (editTask) {
        const taskRef = doc(db, 'tasks', editTask.id);
        await updateDoc(taskRef, payload);
      } else {
        await addDoc(collection(db, 'tasks'), payload);
      }
      closeTaskDialog();
    } catch (error) {
      console.error('Error guardando tarea:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (task: TaskItem) => {
    if (!task.id) return;
    await deleteDoc(doc(db, 'tasks', task.id));
    setDetailModalOpen(false);
  };

  const handleOpenDetail = (task: TaskItem) => {
    setSelectedTask(task);
    setDetailModalOpen(true);
  };

  const handleDragStart = (taskId: string, event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer?.setData('text/plain', taskId);
    event.dataTransfer?.setData('application/task-id', taskId);
    event.dataTransfer!.effectAllowed = 'move';
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDragEnter = (dateKey: string) => {
    setDragOverDate(dateKey);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDrop = async (targetDate: Date, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOverDate(null);
    const taskId = event.dataTransfer?.getData('text/plain') || event.dataTransfer?.getData('application/task-id');
    if (!taskId) return;
    const taskRef = doc(db, 'tasks', taskId);
    await updateDoc(taskRef, { dueDate: targetDate, updatedAt: new Date() });
  };

  const truncatedTitle = (text = '') => text.length > 22 ? `${text.slice(0, 22)}...` : text;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Calendario</Typography>
      <Paper sx={{ p: 3, borderRadius: 3, boxShadow: '0 20px 45px rgba(15, 23, 42, 0.08)', bgcolor: '#f5f8ff' }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </Typography>
            <Typography color="text.secondary">                          </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="outlined" size="small" startIcon={<TodayIcon />} onClick={handleToday}>Hoy</Button>
            <Button variant="outlined" size="small" startIcon={<ArrowBackIcon />} onClick={handlePrev} />
            <Button variant="outlined" size="small" endIcon={<ArrowForwardIcon />} onClick={handleNext} />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: 'center', mb: 3 }}>
          <ButtonGroup variant="outlined" color="primary" sx={{ flexWrap: 'wrap' }}>
            <Button onClick={() => setViewMode('month')} variant={viewMode === 'month' ? 'contained' : 'outlined'}>Mes</Button>
            <Button onClick={() => setViewMode('week')} variant={viewMode === 'week' ? 'contained' : 'outlined'}>Semana</Button>
            <Button onClick={() => setViewMode('list')} variant={viewMode === 'list' ? 'contained' : 'outlined'}>Lista</Button>
          </ButtonGroup>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Mes</InputLabel>
            <Select value={currentDate.getMonth()} label="Mes" onChange={(event) => handleChangeMonth(Number(event.target.value))}>
              {monthNames.map((name, index) => (
                <MenuItem key={name} value={index}>{name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel>Año</InputLabel>
            <Select value={currentDate.getFullYear()} label="Año" onChange={(event) => handleChangeYear(Number(event.target.value))}>
              {years.map((year) => (
                <MenuItem key={year} value={year}>{year}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openTaskDialog()}>Agregar tarea</Button>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: 'center', mb: 3 }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Estado</InputLabel>
            <Select value={filterStatus} label="Estado" onChange={(event) => setFilterStatus(event.target.value as StatusFilter)}>
              <MenuItem value="all">Todas</MenuItem>
              <MenuItem value="todo">Pendientes</MenuItem>
              <MenuItem value="in_progress">En progreso</MenuItem>
              <MenuItem value="completed">Completadas</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Etiqueta</InputLabel>
            <Select value={tagFilter} label="Etiqueta" onChange={(event) => setTagFilter(event.target.value)}>
              <MenuItem value="all">Todas</MenuItem>
              {allTags.map(tag => (
                <MenuItem key={tag} value={tag}>{tag}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : viewMode === 'month' ? (
          <Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1, mb: 1 }}>
              {dayLabels.map((label) => (
                <Box key={label} sx={{ p: 1, textAlign: 'center', fontWeight: 700, color: 'text.secondary', bgcolor: 'rgba(13, 71, 161, 0.08)', borderRadius: 1 }}>{label}</Box>
              ))}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1 }}>
              {monthGrid.map((day) => {
                const key = formatDateKey(day);
                const dayTasks = tasksByDay.get(key) || [];
                const isToday = areSameDay(day, today);
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                return (
                  <Box
                    key={key}
                    onDoubleClick={() => openTaskDialog(day)}
                    onDragOver={handleDragOver}
                    onDragEnter={() => handleDragEnter(key)}
                    onDragLeave={handleDragLeave}
                    onDrop={(event) => handleDrop(day, event)}
                    sx={{
                      minHeight: 140,
                      border: '1px solid #e0e0e0',
                      borderRadius: 2,
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      backgroundColor: dragOverDate === key ? '#e8f0fe' : isCurrentMonth ? '#fcfdff' : '#f8f9fb',
                      boxShadow: dragOverDate === key ? '0 0 0 1px rgba(25, 118, 210, 0.35)' : 'inset 0 0 0 1px rgba(15, 23, 42, 0.06)',
                      cursor: 'pointer',
                      transition: 'background-color 150ms ease, box-shadow 150ms ease',
                      '&:hover': { boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)' }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          color: isToday ? 'primary.main' : 'text.primary',
                          bgcolor: isToday ? 'rgba(25, 118, 210, 0.12)' : 'transparent'
                        }}
                      >
                        {day.getDate()}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {dayTasks.length ? `${dayTasks.length} tareas` : ''}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'grid', gap: 0.75, flexGrow: 1 }}>
                      {dayTasks.slice(0, 3).map((task) => {
                        const overdue = task.status !== 'completed' && task.dueDate && task.dueDate < today;
                        return (
                          <Chip
                            key={task.id}
                            label={truncatedTitle(task.title)}
                            onClick={(event) => { event.stopPropagation(); handleOpenDetail(task); }}
                            icon={<CalendarTodayIcon fontSize="small" />}
                            size="small"
                            draggable
                            onDragStart={(event) => handleDragStart(task.id, event)}
                            sx={{
                              justifyContent: 'flex-start',
                              borderLeft: `4px solid ${overdue ? '#d32f2f' : statusColors[task.status ?? 'todo']}`,
                              backgroundColor: overdue ? 'rgba(211, 47, 47, 0.12)' : statusBackgrounds[task.status ?? 'todo']
                            }}
                          />
                        );
                      })}
                      {dayTasks.length > 3 && (
                        <Typography variant="caption" color="text.secondary">+{dayTasks.length - 3} más</Typography>
                      )}
                    </Box>

                    {dayTasks.length === 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto' }}>Doble clic para crear una tarea</Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        ) : viewMode === 'week' ? (
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '80px repeat(7, minmax(160px, 1fr))', gap: 1 }}>
              <Box />
              {weekGrid.map((day) => (
                <Box key={formatDateKey(day)} sx={{ p: 1, borderRadius: 2, bgcolor: '#f5f5f5', textAlign: 'center' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{dayLabels[day.getDay() === 0 ? 6 : day.getDay() - 1]}</Typography>
                  <Typography variant="body2" color="text.secondary">{day.getDate()} {monthNames[day.getMonth()]}</Typography>
                </Box>
              ))}

              {Array.from({ length: 11 }).map((_, hourIndex) => {
                const hour = 8 + hourIndex;
                return (
                  <>
                    <Box key={`hour-${hour}`} sx={{ p: 1, textAlign: 'right', color: 'text.secondary', fontSize: 12 }}>
                      {`${hour}:00`}
                    </Box>
                    {weekGrid.map((day) => {
                      const dateKey = formatDateKey(day);
                      const slotKey = `${dateKey}-${hour}`;
                      const cellTasks = tasksByWeekSlot.get(slotKey) ?? [];
                      return (
                        <Box
                          key={`${dateKey}-${hour}-cell`}
                          onDoubleClick={() => openTaskDialog(new Date(day.getFullYear(), day.getMonth(), day.getDate()))}
                          onDragOver={handleDragOver}
                          onDragEnter={() => handleDragEnter(dateKey)}
                          onDragLeave={handleDragLeave}
                          onDrop={(event) => handleDrop(new Date(day.getFullYear(), day.getMonth(), day.getDate()), event)}
                          sx={{
                            minHeight: 72,
                            p: 1,
                            border: '1px solid #e0e0e0',
                            borderRadius: 2,
                            bgcolor: dragOverDate === dateKey ? '#e8f0fe' : '#fff',
                            boxShadow: dragOverDate === dateKey ? '0 0 0 2px rgba(25, 118, 210, 0.2)' : 'none',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: '#f5f7fb' }
                          }}
                        >
                          <Box sx={{ display: 'grid', gap: 0.75 }}>
                            {cellTasks.map(task => (
                              <Chip
                                key={task.id}
                                label={truncatedTitle(task.title)}
                                onClick={(event) => { event.stopPropagation(); handleOpenDetail(task); }}
                                icon={<CalendarTodayIcon fontSize="small" />}
                                size="small"
                                sx={{
                                  justifyContent: 'flex-start',
                                  borderLeft: `4px solid ${statusColors[task.status ?? 'todo']}`,
                                  backgroundColor: statusBackgrounds[task.status ?? 'todo']
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      );
                    })}
                  </>
                );
              })}
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gap: 2 }}>
            {filteredTasks.sort((a, b) => {
              const aDate = a.dueDate ? a.dueDate.getTime() : 0;
              const bDate = b.dueDate ? b.dueDate.getTime() : 0;
              return aDate - bDate;
            }).map(task => (
              <Paper key={task.id} sx={{ p: 2, borderRadius: 3, boxShadow: '0 9px 30px rgba(15, 23, 42, 0.06)' }}>
                <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{task.title || 'Sin título'}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{task.description || 'Sin descripción'}</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Chip
                        label={task.status === 'completed' ? 'Completado' : task.status === 'in_progress' ? 'En progreso' : 'Por hacer'}
                        size="small"
                        sx={{ bgcolor: statusBackgrounds[task.status ?? 'todo'], color: statusColors[task.status ?? 'todo'], fontWeight: 700 }}
                      />
                      {task.dueDate && (
                        <Chip
                          icon={<CalendarTodayIcon fontSize="small" />}
                          label={task.status === 'completed' ? 'Finalizada' : `Vence ${task.dueDate.toLocaleDateString()}`}
                          size="small"
                          sx={{ borderColor: '#cfd8dc', color: 'text.secondary' }}
                        />
                      )}
                    </Box>
                  </Box>
                  <ButtonGroup orientation="vertical" size="small" variant="outlined">
                    <Button onClick={() => handleOpenDetail(task)}>Ver</Button>
                    <Button onClick={() => openTaskDialog(task.dueDate ?? undefined, task)}>Editar</Button>
                  </ButtonGroup>
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </Paper>

      <Dialog open={detailModalOpen} onClose={() => setDetailModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Detalle de tarea</DialogTitle>
        <DialogContent>
          <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>{selectedTask?.title || 'Sin título'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{selectedTask?.description || 'Sin descripción disponible.'}</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
            <Chip
              label={selectedTask?.status === 'completed' ? 'Completada' : selectedTask?.status === 'in_progress' ? 'En progreso' : 'Por hacer'}
              size="small"
              sx={{ bgcolor: statusBackgrounds[selectedTask?.status ?? 'todo'], color: statusColors[selectedTask?.status ?? 'todo'], fontWeight: 700 }}
            />
            {selectedTask?.dueDate && (
              <Chip
                icon={<CalendarTodayIcon fontSize="small" />}
                label={selectedTask?.status === 'completed' ? 'Finalizada' : `Vence ${selectedTask.dueDate.toLocaleDateString()}`}
                size="small"
                sx={{ borderColor: '#cfd8dc', color: 'text.secondary' }}
              />
            )}
          </Box>
          {selectedTask?.tags?.length ? (
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {selectedTask.tags.map((tag) => (
                <Chip key={tag} label={tag} size="small" sx={{ bgcolor: '#e8eaf6', color: '#3949ab' }} />
              ))}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailModalOpen(false)}>Cerrar</Button>
          <Button onClick={() => selectedTask && openTaskDialog(selectedTask.dueDate ?? undefined, selectedTask)}>Editar</Button>
          <Button color="error" onClick={() => selectedTask && handleDeleteTask(selectedTask)} startIcon={<DeleteIcon />}>Eliminar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={taskDialogOpen} onClose={closeTaskDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editTask ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="Título"
              fullWidth
              value={taskForm.title}
              onChange={(event) => setTaskForm(prev => ({ ...prev, title: event.target.value }))}
            />
            <TextField
              label="Descripción"
              fullWidth
              multiline
              rows={3}
              value={taskForm.description}
              onChange={(event) => setTaskForm(prev => ({ ...prev, description: event.target.value }))}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Estado</InputLabel>
              <Select
                value={taskForm.status}
                label="Estado"
                onChange={(event) => setTaskForm(prev => ({ ...prev, status: event.target.value as TaskItem['status'] }))}
              >
                <MenuItem value="todo">Por hacer</MenuItem>
                <MenuItem value="in_progress">En progreso</MenuItem>
                <MenuItem value="completed">Completado</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Fecha de vencimiento"
              type="date"
              fullWidth
              value={taskForm.dueDate}
              onChange={(event) => setTaskForm(prev => ({ ...prev, dueDate: event.target.value }))}
            />
            <TextField
              label="Etiquetas (separadas por comas)"
              fullWidth
              value={taskForm.tags}
              onChange={(event) => setTaskForm(prev => ({ ...prev, tags: event.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeTaskDialog} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveTask} disabled={saving || !taskForm.title.trim()}>
            {saving ? 'Guardando...' : editTask ? 'Guardar cambios' : 'Crear tarea'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
