import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Card, CardContent, CircularProgress,
  LinearProgress
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  Assignment as TaskIcon,
  CheckCircle as CompletedIcon,
  PlayArrow as ProgressIcon,
  Pending as PendingIcon
} from '@mui/icons-material';
import { useProject } from '../context/ProjectContext';
import { db } from '../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface TaskStats {
  total: number;
  todo: number;
  inProgress: number;
  completed: number;
  completionRate: number;
  byStatus: { name: string; value: number; color: string }[];
  last7Days: { date: string; created: number; completed: number }[];
}

const statusColors = {
  todo: '#ffb74d',
  in_progress: '#64b5f6',
  completed: '#81c784'
};

export default function StatsPage() {
  const { currentProject } = useProject();
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!currentProject) return;
      setLoading(true);
      try {
        const tasksRef = collection(db, 'tasks');
        const q = query(tasksRef, where('projectId', '==', currentProject.id));
        const snapshot = await getDocs(q);
        const tasks = snapshot.docs.map(doc => doc.data());

        const total = tasks.length;
        const todo = tasks.filter(t => t.status === 'todo').length;
        const inProgress = tasks.filter(t => t.status === 'in_progress').length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        const completionRate = total === 0 ? 0 : (completed / total) * 100;

        // Datos para gráfico de torta
        const byStatus = [
          { name: 'Por hacer', value: todo, color: statusColors.todo },
          { name: 'En progreso', value: inProgress, color: statusColors.in_progress },
          { name: 'Completadas', value: completed, color: statusColors.completed }
        ].filter(item => item.value > 0);

        // Datos de los últimos 7 días (simulados desde createdAt)
        const last7Days: { date: string; created: number; completed: number }[] = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(today.getDate() - i);
          const dateStr = date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
          // Contar tareas creadas y completadas en esa fecha (aproximado)
          const createdCount = tasks.filter(t => {
            if (!t.createdAt) return false;
            const createdDate = t.createdAt.toDate();
            return createdDate.toDateString() === date.toDateString();
          }).length;
          const completedCount = tasks.filter(t => {
            if (!t.completedAt && t.status !== 'completed') return false;
            const completedDate = t.completedAt?.toDate() || (t.status === 'completed' ? t.updatedAt?.toDate() : null);
            return completedDate && completedDate.toDateString() === date.toDateString();
          }).length;
          last7Days.push({ date: dateStr, created: createdCount, completed: completedCount });
        }

        setStats({ total, todo, inProgress, completed, completionRate, byStatus, last7Days });
      } catch (error) {
        console.error('Error cargando estadísticas:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [currentProject]);

  if (!currentProject) {
    return <Typography align="center" sx={{ mt: 4 }}>Selecciona un proyecto para ver estadísticas.</Typography>;
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6">Aún no hay tareas en este proyecto</Typography>
        <Typography variant="body2">Crea tareas desde el Tablero para ver estadísticas.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }} gutterBottom>
        Estadísticas
      </Typography>
      <Typography variant="subtitle1" sx={{ color: 'text.secondary' }} gutterBottom>
        Proyecto: {currentProject.name}
      </Typography>

      {/* Tarjetas de resumen */}
      <Box sx={{ display: 'grid', gap: 3, mb: 4, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
        <Card sx={{ borderRadius: 3, boxShadow: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>{stats.total}</Typography>
                <Typography variant="subtitle1">Total tareas</Typography>
              </Box>
              <TaskIcon sx={{ fontSize: 48, opacity: 0.8 }} />
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ borderRadius: 3, boxShadow: 3, bgcolor: statusColors.todo, color: 'white' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>{stats.todo}</Typography>
                <Typography variant="subtitle1">Por hacer</Typography>
              </Box>
              <PendingIcon sx={{ fontSize: 48, opacity: 0.8 }} />
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ borderRadius: 3, boxShadow: 3, bgcolor: statusColors.in_progress, color: 'white' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>{stats.inProgress}</Typography>
                <Typography variant="subtitle1">En progreso</Typography>
              </Box>
              <ProgressIcon sx={{ fontSize: 48, opacity: 0.8 }} />
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ borderRadius: 3, boxShadow: 3, bgcolor: statusColors.completed, color: 'white' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>{stats.completed}</Typography>
                <Typography variant="subtitle1">Completadas</Typography>
              </Box>
              <CompletedIcon sx={{ fontSize: 48, opacity: 0.8 }} />
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Barra de progreso de finalización */}
      <Paper sx={{ p: 3, mb: 4, borderRadius: 3 }}>
        <Typography variant="h6" gutterBottom>Progreso general</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            <LinearProgress variant="determinate" value={stats.completionRate} sx={{ height: 10, borderRadius: 5 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{Math.round(stats.completionRate)}%</Typography>
        </Box>
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          {stats.completed} de {stats.total} tareas completadas
        </Typography>
      </Paper>

      {/* Gráficos */}
      <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        {/* Gráfico de barras por estado */}
        <Box>
          <Paper sx={{ p: 3, borderRadius: 3, height: 350 }}>
            <Typography variant="h6" gutterBottom>Distribución por estado</Typography>
            <ResponsiveContainer width="100%" height="80%">
              <BarChart data={stats.byStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8884d8">
                  {stats.byStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Box>

        {/* Gráfico de pastel */}
        <Box>
          <Paper sx={{ p: 3, borderRadius: 3, height: 350 }}>
            <Typography variant="h6" gutterBottom>Proporción</Typography>
            <ResponsiveContainer width="100%" height="80%">
              <PieChart>
                <Pie
                  data={stats.byStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.byStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Box>

        {/* Gráfico de líneas: actividad semanal */}
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" gutterBottom>Actividad últimos 7 días</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={stats.last7Days}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="created" stackId="1" stroke="#8884d8" fill="#8884d8" name="Tareas creadas" />
                <Area type="monotone" dataKey="completed" stackId="2" stroke="#82ca9d" fill="#82ca9d" name="Tareas completadas" />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}