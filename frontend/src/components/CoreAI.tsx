import { useMemo, useState, useEffect, useRef } from 'react';
import { Drawer, Box, Typography, Button, IconButton, Divider, FormControlLabel, Switch, Skeleton } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import { subscribeToTasks, updateTask } from '../services/taskService';

interface CoreAIProps {
  items?: any[];
  projectId?: string;
  projectName?: string;
  userName?: string;
}

function parseDate(v: any): Date | undefined {
  if (!v) return undefined;
  // Firestore Timestamp has toDate()
  if (typeof v === 'object' && typeof v.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });
}

function getCanonicalStatus(s: any): 'completed' | 'in_progress' | 'todo' | 'other' {
  if (!s && s !== '') return 'todo';
  const v = String(s || '').toLowerCase().trim();
  if (!v) return 'todo';
  if (v.includes('comp') || v.includes('done') || v.includes('complet')) return 'completed';
  if (v.includes('progress') || v.includes('in_progress') || v.includes('en progreso') || v.includes('en_progress') || v.includes('inprogress')) return 'in_progress';
  if (v.includes('todo') || v.includes('por hacer') || v.includes('por_hacer')) return 'todo';
  return 'other';
}

function extractStatusFromTask(t: any) {
  // prefer explicit status fields, but support variations and object shapes
  if (!t) return '';
  const candidates = [t.status, t.state, t.column, t.columnId, t.statusKey, t.statusLabel];
  for (const c of candidates) {
    if (c === undefined || c === null) continue;
    if (typeof c === 'string' || typeof c === 'number') {
      const s = String(c).trim();
      if (s) return s;
      continue;
    }
    if (typeof c === 'object') {
      // common object shapes: { name, title, label, status, key, id }
      const props = ['name', 'title', 'label', 'status', 'key', 'id', 'statusLabel', 'statusKey'];
      for (const p of props) {
        if (c[p] !== undefined && c[p] !== null) {
          const s = String(c[p]).trim();
          if (s) return s;
        }
      }
      // fallback: search any string value inside the object
      try {
        for (const val of Object.values(c)) {
          if (typeof val === 'string' && val.trim()) return val.trim();
          if (typeof val === 'number') return String(val);
        }
      } catch (err) {
        // ignore and continue
      }
    }
  }
  return '';
}

export default function CoreAI({ items = [], projectId, projectName, userName }: CoreAIProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [remoteTasks, setRemoteTasks] = useState<any[] | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [autoMarkOverdue, setAutoMarkOverdue] = useState<boolean>(false);
  const skipAutoMarkEffect = useRef(false);
  const name = userName ? userName.split(' ')[0] : 'aquí';

  // saludo según hora
  const greeting = (() => {
    try {
      const h = new Date().getHours();
      if (h >= 5 && h < 12) return 'Buenos días';
      if (h >= 12 && h < 19) return 'Buenas tardes';
      return 'Buenas noches';
    } catch (e) { return 'Hola'; }
  })();

  useEffect(() => {
    if (!projectId) {
      setRemoteTasks(null);
      return;
    }

    setIsLoading(true);
    const unsubscribe = subscribeToTasks(projectId, (tasks: any[]) => {
      setRemoteTasks(tasks);
      setIsLoading(false);
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [projectId]);

  const itemsList = remoteTasks ?? items;
  const exampleProjectName = projectName || projectId || 'Proyecto';
  const total = itemsList.length;
  const noDeadline = itemsList.filter((task: any) => !task.dueDate && !task.dueAt && !task.deadline).length;

  const stats = useMemo(() => {
    const now = Date.now();
    const overdueTasks = itemsList.filter((t: any) => {
      const d = parseDate(t.dueDate || t.dueAt || t.deadline);
      // consider a task overdue when due date is past and status is not 'completed'
      const raw = extractStatusFromTask(t);
      const st = getCanonicalStatus(raw);
      return d ? d.getTime() < now && st !== 'completed' : false;
    });

    const urgentTasks = itemsList.filter((t: any) => {
      const d = parseDate(t.dueDate || t.dueAt || t.deadline);
      if (!d) return false;
      const diff = d.getTime() - now;
      const raw = extractStatusFromTask(t);
      const st = getCanonicalStatus(raw);
      return diff > 0 && diff <= 48 * 60 * 60 * 1000 && st !== 'completed';
    });

    const completedToday = itemsList.filter((t: any) => {
      const raw = extractStatusFromTask(t);
      const st = getCanonicalStatus(raw);
      if (st !== 'completed') return false;
      const d = parseDate(t.updatedAt || t.completedAt || t.dueDate);
      if (!d) return false;
      return d.toDateString() === new Date().toDateString();
    }).length;

    const inProgress = itemsList.filter((t: any) => {
      const raw = extractStatusFromTask(t);
      return getCanonicalStatus(raw) === 'in_progress';
    }).length;

    return {
      overdue: overdueTasks.length,
      urgent: urgentTasks.length,
      completedToday,
      inProgress,
      overdueTasks,
      urgentTasks,
    };
  }, [itemsList]);

  const markOverdueTasks = async () => {
    const sourceTasks = remoteTasks || itemsList;
    const now = Date.now();
    const overdueTasks = sourceTasks.filter((t: any) => {
      const d = parseDate(t.dueDate || t.dueAt || t.deadline);
      return d ? d.getTime() < now && getCanonicalStatus(extractStatusFromTask(t)) !== 'completed' : false;
    });

    if (!overdueTasks.length) {
      setActionMessage('No hay tareas vencidas para marcar en este momento.');
      return;
    }

    let updatedCount = 0;
    await Promise.all(overdueTasks.map(async (task) => {
      if (!task?.id) return;
      try {
        await updateTask(task.id, { status: 'completed', completedAt: new Date() });
        updatedCount += 1;
      } catch (err) {
        console.error('CoreAI auto-mark error', err);
      }
    }));

    setActionMessage(`Auto-marcar: ${updatedCount} tarea${updatedCount === 1 ? '' : 's'} vencida${updatedCount === 1 ? '' : 's'} marcada${updatedCount === 1 ? '' : 's'} como completada.`);
  };

  // Effect: when auto-mark is enabled, mark overdue tasks as completed automatically
  useEffect(() => {
    if (!autoMarkOverdue || !remoteTasks || !remoteTasks.length) return;
    if (skipAutoMarkEffect.current) {
      skipAutoMarkEffect.current = false;
      return;
    }
    markOverdueTasks();
  }, [autoMarkOverdue, remoteTasks]);

  const recommendations = useMemo(() => {
    const recs: string[] = [];
    if (stats.overdue) {
      const taskNames = stats.overdueTasks.slice(0, 3).map((t: any) => t.title || 'Tarea sin nombre');
      recs.push(`Tienes ${stats.overdue} tareas atrasadas: ${taskNames.join(', ')}.`);
    }
    if (stats.urgent) {
      const taskEntries = stats.urgentTasks.slice(0, 3).map((t: any) => {
        const d = parseDate(t.dueDate || t.dueAt || t.deadline);
        return `${t.title || 'Tarea sin nombre'} (${d ? formatDate(d) : 'sin fecha'})`;
      });
      recs.push(`Hay ${stats.urgent} tareas próximas a vencer: ${taskEntries.join(', ')}.`);
    }
    if (stats.inProgress > 5) recs.push('Tienes muchas tareas en progreso; considera reducirlas.');
    if (!recs.length) recs.push('Todo parece en orden. Mantén el ritmo.');
    return recs;
  }, [stats]);

  const buildRealtimeMessage = (mode: 'optimize' | 'summary') => {
    if (mode === 'optimize') {
      if (stats.overdue) {
        return `Análisis en tiempo real: detecté ${stats.overdue} tarea${stats.overdue === 1 ? '' : 's'} atrasada${stats.overdue === 1 ? '' : 's'} en ${exampleProjectName}. Prioriza su revisión y asigna recursos.`;
      }
      if (stats.urgent) {
        return `Análisis en tiempo real: hay ${stats.urgent} tarea${stats.urgent === 1 ? '' : 's'} urgente${stats.urgent === 1 ? '' : 's'} en ${exampleProjectName}. Atiende los plazos antes de que se vuelvan atrasos.`;
      }
      if (noDeadline) {
        return `Análisis en tiempo real: encontré ${noDeadline} tarea${noDeadline === 1 ? '' : 's'} sin fecha límite en ${exampleProjectName}. Evalúa si deben planificarse.`;
      }
      return `Análisis en tiempo real: el tablero de ${exampleProjectName} se ve equilibrado. Sigue con el ritmo actual.`;
    }

    return `Resumen en tiempo real de ${exampleProjectName}: ${total} tarea${total === 1 ? '' : 's'}, ${stats.overdue} atrasada${stats.overdue === 1 ? '' : 's'}, ${stats.urgent} urgente${stats.urgent === 1 ? '' : 's'} y ${noDeadline} sin fecha. ${recommendations[0]}`;
  };

  return (
    <>
      <Box sx={{ position: 'fixed', right: 24, bottom: 24, zIndex: 2500 }}>
        <Button
          onClick={() => setOpen(true)}
          startIcon={<AutoAwesomeIcon />}
          variant="contained"
          sx={{
            background: 'linear-gradient(135deg, #6C63FF, #8B5CF6)',
            color: 'white',
            borderRadius: '999px',
            px: 3,
            py: 1.5,
            boxShadow: '0 22px 50px rgba(108,99,255,0.24)',
            textTransform: 'none',
            fontWeight: 700,
            letterSpacing: '0.02em',
            transition: 'transform 180ms ease, box-shadow 180ms ease',
            '&:hover': {
              transform: 'translateY(-2px) scale(1.02)',
              boxShadow: '0 28px 65px rgba(108,99,255,0.32)',
            },
          }}
        >
        Core AI
        </Button>
      </Box>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 360 },
            maxWidth: 360,
            top: { xs: 0, sm: 56 },
            height: { xs: '100%', sm: 'calc(100vh - 88px)' },
            borderRadius: { xs: 0, sm: '24px 0 0 24px' },
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(18px)',
            boxShadow: 'rgba(15, 23, 42, 0.16) 0px 24px 60px',
            borderLeft: '1px solid rgba(255,255,255,0.75)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box sx={{ p: 3, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="overline" sx={{ color: '#7c3aed', fontWeight: 700, letterSpacing: '0.12em', mb: 1, display: 'block' }}>
              ASISTENTE PREMIUM
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
              {`${greeting}, ${name} 👋`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Tu copiloto de productividad personal.
            </Typography>
          </Box>
          <IconButton onClick={() => setOpen(false)} aria-label="cerrar" sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider />

        <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
          <Box sx={{ mb: 3, p: 2.5, borderRadius: 3, background: 'linear-gradient(180deg, rgba(124,58,237,0.08), rgba(99,102,241,0.04))', border: '1px solid rgba(124,58,237,0.12)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Proyecto</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {exampleProjectName}
            </Typography>
            <Typography variant="body2" sx={{ color: '#4338ca' }}>
              Este panel te ayuda a detectar prioridades y evitar retrasos.
            </Typography>
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, mb: 3 }}>
            <Box sx={{ p: 2, borderRadius: 3, bgcolor: '#faf5ff', border: '1px solid rgba(124, 58, 237, 0.12)' }}>
              <Typography variant="subtitle2" sx={{ color: '#6b21a8', fontWeight: 700, mb: 0.75 }}>Totales</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{total}</Typography>
              <Typography variant="caption" color="text.secondary">En este proyecto</Typography>
            </Box>
            <Box sx={{ p: 2, borderRadius: 3, bgcolor: '#fff7ed', border: '1px solid rgba(251, 146, 60, 0.12)' }}>
              <Typography variant="subtitle2" sx={{ color: '#c2410c', fontWeight: 700, mb: 0.75 }}>Sin fecha</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{noDeadline}</Typography>
              <Typography variant="caption" color="text.secondary">Tareas sin plazo</Typography>
            </Box>
            <Box sx={{ p: 2, borderRadius: 3, bgcolor: '#ecfdf5', border: '1px solid rgba(16, 185, 129, 0.12)' }}>
              <Typography variant="subtitle2" sx={{ color: '#047857', fontWeight: 700, mb: 0.75 }}>Atrasadas</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{stats.overdue}</Typography>
              <Typography variant="caption" color="text.secondary">Requieren atención</Typography>
            </Box>
            <Box sx={{ p: 2, borderRadius: 3, bgcolor: '#eff6ff', border: '1px solid rgba(59, 130, 246, 0.12)' }}>
              <Typography variant="subtitle2" sx={{ color: '#1d4ed8', fontWeight: 700, mb: 0.75 }}>Urgentes</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{stats.urgent}</Typography>
              <Typography variant="caption" color="text.secondary">Vencen pronto</Typography>
            </Box>
          </Box>

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Recomendaciones</Typography>
          <Box sx={{ display: 'grid', gap: 1.25, mb: 3 }}>
            {isLoading ? (
              [0,1,2].map(i => (
                <Box key={i} sx={{ p: 2, borderRadius: 3, background: '#ffffff', border: '1px solid rgba(15, 23, 42, 0.04)' }}>
                  <Skeleton variant="text" width="80%" />
                  <Skeleton variant="text" width="60%" />
                </Box>
              ))
            ) : (
              recommendations.map((r, i) => (
                <Box key={i} sx={{ p: 2, borderRadius: 3, background: '#ffffff', border: '1px solid rgba(15, 23, 42, 0.08)', boxShadow: '0 10px 20px rgba(15, 23, 42, 0.04)' }}>
                  <Typography variant="body2" sx={{ color: '#111827' }}>{`→ ${r}`}</Typography>
                </Box>
              ))
            )}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
            <Button
              variant="contained"
              onClick={() => setActionMessage(buildRealtimeMessage('optimize'))}
              sx={{
                flex: 1,
                background: 'linear-gradient(135deg, #6C63FF, #8B5CF6)',
                color: 'white',
                textTransform: 'none',
                fontWeight: 700,
                boxShadow: '0 18px 35px rgba(108, 99, 255, 0.18)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
                },
              }}
            >
              Optimizar tablero
            </Button>
            <Button
              variant="outlined"
              onClick={() => setActionMessage(buildRealtimeMessage('summary'))}
              sx={{
                flex: 1,
                borderColor: '#c7d2fe',
                color: '#312e81',
                textTransform: 'none',
                fontWeight: 700,
                '&:hover': {
                  borderColor: '#a5b4fc',
                  backgroundColor: '#f8fafc',
                },
              }}
            >
              Resumen del día
            </Button>
          </Box>
          <Box sx={{ mt: 2, mb: 1 }}>
            <FormControlLabel
              control={<Switch checked={autoMarkOverdue} onChange={async (e) => {
                const checked = e.target.checked;
                setAutoMarkOverdue(checked);
                if (checked && remoteTasks && remoteTasks.length) {
                  skipAutoMarkEffect.current = true;
                  await markOverdueTasks();
                }
              }} />}
              label="Auto-marcar vencidas como completadas"
            />
          </Box>
          {actionMessage ? (
            <Box sx={{ mt: 2, p: 2, borderRadius: 3, bgcolor: '#eef2ff', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <Typography variant="body2" sx={{ color: '#3730a3', display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>{actionMessage}</span>
                <Box component="span" sx={{ display: 'inline-flex', gap: 0.4, ml: 0.5, '& span': { width: 6, height: 6, bgcolor: '#6366f1', borderRadius: '50%', display: 'inline-block', animation: 'dots 1.2s linear infinite' }, '& span:nth-of-type(2)': { animationDelay: '0.12s' }, '& span:nth-of-type(3)': { animationDelay: '0.24s' }, '@keyframes dots': { '0%': { transform: 'translateY(0)', opacity: 0.2 }, '50%': { transform: 'translateY(-6px)', opacity: 1 }, '100%': { transform: 'translateY(0)', opacity: 0.2 } } }}>
                  <span />
                  <span />
                  <span />
                </Box>
              </Typography>
            </Box>
          ) : null}

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
            Nota: esta versión muestra sugerencias. No se realizarán cambios automáticos.
          </Typography>
        </Box>
      </Drawer>
    </>
  );
}
