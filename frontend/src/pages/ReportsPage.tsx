import { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Paper, Card, CardContent, FormControl, InputLabel,
  Select, MenuItem, Button, CircularProgress, Tabs, Tab, Chip,
  IconButton, Tooltip, Alert, LinearProgress
} from '@mui/material';
// Workaround: some MUI Grid typings cause TS errors in this project setup.
// Cast to `any` and use `GridAny` to avoid changing layout logic.
const GridAny: any = Grid;
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import {
  Refresh as RefreshIcon,
  Assignment as TaskIcon,
  CheckCircle as CompletedIcon,
  Schedule as PendingIcon,
  PlayArrow as ProgressIcon,
  FileDownload as CsvIcon
} from '@mui/icons-material';
import { useProject } from '../context/ProjectContext';
import { db } from '../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface TaskData {
  id: string;
  title: string;
  status: string;
  createdAt?: any; // Firebase Timestamp
  completedAt?: any; // Firebase Timestamp
  dueDate?: any; // Firebase Timestamp
  tags?: string[];
}

interface ReportData {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completionRate: number;
  statusDistribution: { name: string; value: number; color: string }[];
  weeklyActivity: { day: string; created: number; completed: number }[];
  topTags: { tag: string; count: number }[];
  performance: { month: string; tasks: number; completion: number }[];
}

const statusColors = {
  todo: '#ff9800',
  in_progress: '#2196f3',
  completed: '#4caf50'
};

export default function ReportsPage() {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [allTasks, setAllTasks] = useState<TaskData[]>([]);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'all'>('month');
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'in_progress' | 'completed'>('all');
  const [tabValue, setTabValue] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentProject) {
      generateReport();
    }
  }, [currentProject, dateRange, statusFilter]);

  const generateReport = async () => {
    if (!currentProject) return;
    setLoading(true);
    setError('');
    try {
      const tasksRef = collection(db, 'tasks');
      const q = query(tasksRef, where('projectId', '==', currentProject.id));
      const snapshot = await getDocs(q);
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskData));
      setAllTasks(tasks);

      // Filtrar por rango de fechas y estado
      let filteredTasks = [...tasks];
      const now = new Date();
      if (dateRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filteredTasks = tasks.filter(t => {
          const created = t.createdAt?.toDate ? t.createdAt.toDate() : t.createdAt;
          return created && created >= weekAgo;
        });
      } else if (dateRange === 'month') {
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        filteredTasks = tasks.filter(t => {
          const created = t.createdAt?.toDate ? t.createdAt.toDate() : t.createdAt;
          return created && created >= monthAgo;
        });
      }
      
      // Aplicar filtro de estado
      if (statusFilter !== 'all') {
        filteredTasks = filteredTasks.filter(t => t.status === statusFilter);
      }

      const total = filteredTasks.length;
      const completed = filteredTasks.filter(t => t.status === 'completed').length;
      const pending = filteredTasks.filter(t => t.status === 'todo').length;
      const inProgress = filteredTasks.filter(t => t.status === 'in_progress').length;
      const completionRate = total === 0 ? 0 : (completed / total) * 100;

      // Distribución por estado
      const statusDistribution = [
        { name: 'Por hacer', value: pending, color: statusColors.todo },
        { name: 'En progreso', value: inProgress, color: statusColors.in_progress },
        { name: 'Completadas', value: completed, color: statusColors.completed }
      ].filter(item => item.value > 0);

      // Actividad semanal
      const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      const weeklyActivity = days.map((day, idx) => {
        const dayDate = new Date();
        dayDate.setDate(dayDate.getDate() - (6 - idx));
        const createdCount = filteredTasks.filter(t => {
          if (!t.createdAt) return false;
          const created = t.createdAt?.toDate ? t.createdAt.toDate() : t.createdAt;
          return created && created.toDateString() === dayDate.toDateString();
        }).length;
        const completedCount = filteredTasks.filter(t => {
          if (t.status !== 'completed') return false;
          const compDate = t.completedAt?.toDate ? t.completedAt.toDate() : t.completedAt;
          return compDate && compDate.toDateString() === dayDate.toDateString();
        }).length;
        return { day, created: createdCount, completed: completedCount };
      });

      // Etiquetas más usadas
      const tagCount: Record<string, number> = {};
      filteredTasks.forEach(task => {
        if (task.tags && Array.isArray(task.tags)) {
          task.tags.forEach(tag => {
            tagCount[tag] = (tagCount[tag] || 0) + 1;
          });
        }
      });
      const topTags = Object.entries(tagCount)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Rendimiento mensual (simulado con createdAt)
      const monthlyData: Record<string, { tasks: number; completion: number }> = {};
      filteredTasks.forEach(task => {
        if (task.createdAt) {
          const created = task.createdAt?.toDate ? task.createdAt.toDate() : task.createdAt;
          const month = created.toLocaleString('es', { month: 'short', year: '2-digit' });
          if (!monthlyData[month]) monthlyData[month] = { tasks: 0, completion: 0 };
          monthlyData[month].tasks++;
          if (task.status === 'completed') monthlyData[month].completion++;
        }
      });
      const performance = Object.entries(monthlyData).map(([month, data]) => ({
        month,
        tasks: data.tasks,
        completion: data.completion
      })).slice(-6);

      setReportData({
        totalTasks: total,
        completedTasks: completed,
        pendingTasks: pending,
        inProgressTasks: inProgress,
        completionRate,
        statusDistribution,
        weeklyActivity,
        topTags,
        performance
      });
    } catch (err) {
      console.error(err);
      setError('Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData || allTasks.length === 0) return;
    
    // Aplicar los mismos filtros que se usan en la vista
    let filteredForExport = [...allTasks];
    const now = new Date();
    
    if (dateRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredForExport = filteredForExport.filter(t => {
        const created = t.createdAt?.toDate ? t.createdAt.toDate() : t.createdAt;
        return created && created >= weekAgo;
      });
    } else if (dateRange === 'month') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      filteredForExport = filteredForExport.filter(t => {
        const created = t.createdAt?.toDate ? t.createdAt.toDate() : t.createdAt;
        return created && created >= monthAgo;
      });
    }
    
    if (statusFilter !== 'all') {
      filteredForExport = filteredForExport.filter(t => t.status === statusFilter);
    }
    
    // Crear resumen con encabezados
    const rows: (string | number)[][] = [
      ['REPORTE DE TAREAS'],
      ['Proyecto', currentProject?.name || 'N/A'],
      ['Rango', dateRange === 'week' ? 'Última semana' : dateRange === 'month' ? 'Último mes' : 'Todo el historial'],
      ['Estado Filtrado', statusFilter === 'all' ? 'Todos' : statusFilter === 'todo' ? 'Por hacer' : statusFilter === 'in_progress' ? 'En progreso' : 'Completadas'],
      ['Fecha de Exportación', new Date().toLocaleString('es-ES')],
      [],
      ['MÉTRICAS RESUMEN'],
      ['Métrica', 'Valor'],
      ['Total tareas', reportData.totalTasks],
      ['Completadas', reportData.completedTasks],
      ['Pendientes', reportData.pendingTasks],
      ['En progreso', reportData.inProgressTasks],
      ['Tasa de finalización (%)', reportData.completionRate.toFixed(2)],
      [],
      ['DETALLE DE TAREAS'],
      ['ID', 'Título', 'Estado', 'Fecha Creación', 'Etiquetas']
    ];
    
    filteredForExport.forEach(task => {
      const createdDate = task.createdAt?.toDate ? task.createdAt.toDate().toLocaleString('es-ES') : 'N/A';
      const statusLabel = task.status === 'todo' ? 'Por hacer' : task.status === 'in_progress' ? 'En progreso' : 'Completada';
      const tags = task.tags && task.tags.length > 0 ? task.tags.join('; ') : 'Sin etiquetas';
      rows.push([task.id, task.title, statusLabel, createdDate, tags]);
    });
    
    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_${currentProject?.name}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!currentProject) {
    return <Typography sx={{ mt: 4, textAlign: 'center' }}>Selecciona un proyecto para ver reportes.</Typography>;
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!reportData || reportData.totalTasks === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6">No hay datos suficientes para generar reportes</Typography>
        <Typography variant="body2">Crea tareas en este proyecto para ver estadísticas.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Encabezado y filtros */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Reportes</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Rango</InputLabel>
            <Select value={dateRange} label="Rango" onChange={e => setDateRange(e.target.value as any)}>
              <MenuItem value="week">Última semana</MenuItem>
              <MenuItem value="month">Último mes</MenuItem>
              <MenuItem value="all">Todo el historial</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Estado</InputLabel>
            <Select value={statusFilter} label="Estado" onChange={e => setStatusFilter(e.target.value as any)}>
              <MenuItem value="all">Todos</MenuItem>
              <MenuItem value="todo">Por hacer</MenuItem>
              <MenuItem value="in_progress">En progreso</MenuItem>
              <MenuItem value="completed">Completadas</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Exportar CSV">
            <Button variant="outlined" startIcon={<CsvIcon />} onClick={exportToCSV} size="small">
              CSV
            </Button>
          </Tooltip>
          <Tooltip title="Actualizar">
            <IconButton onClick={generateReport} size="small"><RefreshIcon /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Tarjetas de KPIs */}
      <GridAny container spacing={3} sx={{ mb: 4 }}>
        <GridAny xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: 2, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>{reportData.totalTasks}</Typography>
                  <Typography variant="subtitle1">Total tareas</Typography>
                </Box>
                <TaskIcon sx={{ fontSize: 48, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </GridAny>
        <GridAny xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: 2, bgcolor: statusColors.completed, color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>{reportData.completedTasks}</Typography>
                  <Typography variant="subtitle1">Completadas</Typography>
                </Box>
                <CompletedIcon sx={{ fontSize: 48, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </GridAny>
        <GridAny xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: 2, bgcolor: statusColors.todo, color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>{reportData.pendingTasks}</Typography>
                  <Typography variant="subtitle1">Pendientes</Typography>
                </Box>
                <PendingIcon sx={{ fontSize: 48, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </GridAny>
        <GridAny xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: 2, bgcolor: statusColors.in_progress, color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>{reportData.inProgressTasks}</Typography>
                  <Typography variant="subtitle1">En progreso</Typography>
                </Box>
                <ProgressIcon sx={{ fontSize: 48, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </GridAny>
      </GridAny>

      {/* Tabs para diferentes vistas */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: 2 }}>
        <Tabs value={tabValue} onChange={(_e, v) => setTabValue(v)} variant="fullWidth">
          <Tab label=" Resumen" />
          <Tab label=" Actividad" />
          <Tab label=" Etiquetas" />
          <Tab label=" Detalles" />
        </Tabs>
        <Box sx={{ p: 3 }}>
          {tabValue === 0 && (
            <GridAny container spacing={4}>
              <GridAny xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 2 }}>Distribución por estado</Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={reportData.statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                      {reportData.statusDistribution.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </GridAny>
              <GridAny xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 2 }}>Rendimiento mensual</Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportData.performance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="tasks" fill="#8884d8" name="Tareas creadas" />
                    <Bar dataKey="completion" fill="#82ca9d" name="Completadas" />
                  </BarChart>
                </ResponsiveContainer>
              </GridAny>
              <GridAny xs={12}>
                <Paper sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 2 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Progreso general</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <LinearProgress variant="determinate" value={reportData.completionRate} sx={{ height: 10, borderRadius: 5 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, minWidth: 60 }}>{Math.round(reportData.completionRate)}%</Typography>
                  </Box>
                </Paper>
              </GridAny>
            </GridAny>
          )}
          {tabValue === 1 && (
            <GridAny container spacing={4}>
              <GridAny xs={12}>
                <Typography variant="h6" sx={{ mb: 2 }}>Actividad semanal</Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={reportData.weeklyActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Area type="monotone" dataKey="created" stackId="1" stroke="#8884d8" fill="#8884d8" name="Creadas" />
                    <Area type="monotone" dataKey="completed" stackId="2" stroke="#82ca9d" fill="#82ca9d" name="Completadas" />
                  </AreaChart>
                </ResponsiveContainer>
              </GridAny>
              <GridAny xs={12}>
                <Typography variant="h6" sx={{ mb: 2 }}>Evolución de tareas</Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={reportData.performance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="tasks" stroke="#8884d8" name="Tareas creadas" />
                    <Line type="monotone" dataKey="completion" stroke="#82ca9d" name="Completadas" />
                  </LineChart>
                </ResponsiveContainer>
              </GridAny>
            </GridAny>
          )}
          {tabValue === 2 && (
            <GridAny container spacing={4}>
              <GridAny xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 2 }}>Etiquetas más utilizadas</Typography>
                {reportData.topTags.length > 0 ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {reportData.topTags.map(tag => (
                      <Chip key={tag.tag} label={`${tag.tag} (${tag.count})`} color="primary" variant="outlined" />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2">No hay etiquetas registradas</Typography>
                )}
              </GridAny>
              <GridAny xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 2 }}>Distribución por etiquetas</Typography>
                {reportData.topTags.length > 0 && (
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart outerRadius={90} data={reportData.topTags.map(t => ({ tag: t.tag, count: t.count }))}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="tag" />
                      <PolarRadiusAxis />
                      <Radar name="Tareas" dataKey="count" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                      <RechartsTooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </GridAny>
            </GridAny>
          )}
          {tabValue === 3 && (
            <GridAny container spacing={3}>
              <GridAny xs={12} md={6}>
                <Paper sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Estadísticas clave</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                      <Typography>Total de tareas:</Typography>
                      <Typography sx={{ fontWeight: 700 }}>{reportData.totalTasks}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                      <Typography>Completadas:</Typography>
                      <Typography sx={{ fontWeight: 700, color: statusColors.completed }}>{reportData.completedTasks}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                      <Typography>En progreso:</Typography>
                      <Typography sx={{ fontWeight: 700, color: statusColors.in_progress }}>{reportData.inProgressTasks}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                      <Typography>Pendientes:</Typography>
                      <Typography sx={{ fontWeight: 700, color: statusColors.todo }}>{reportData.pendingTasks}</Typography>
                    </Box>
                  </Box>
                </Paper>
              </GridAny>
              <GridAny xs={12} md={6}>
                <Paper sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Ratio de compleción</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">Tasa de compleción</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{Math.round(reportData.completionRate)}%</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={reportData.completionRate} sx={{ height: 8, borderRadius: 4 }} />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1 }}>
                      <Typography variant="caption">Tareas completadas</Typography>
                      <Typography variant="caption">{reportData.completedTasks} / {reportData.totalTasks}</Typography>
                    </Box>
                  </Box>
                </Paper>
              </GridAny>
            </GridAny>
          )}
        </Box>
      </Paper>
    </Box>
  );
}