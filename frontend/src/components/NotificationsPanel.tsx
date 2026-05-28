import { useState, useEffect, useRef } from 'react';
import { IconButton, Badge, Popover, Box, List, ListItem, ListItemText, ListItemAvatar, Avatar, Typography, Divider, Button, Slider } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import DeleteIcon from '@mui/icons-material/Delete';
import DoneIcon from '@mui/icons-material/Done';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { db } from '../firebase/config';
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { markAsRead, addActivity, deleteActivity } from '../services/activityService';
import { acceptInvitation } from '../services/invitationService';

export default function NotificationsPanel() {
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const prevActivitiesRef = useRef<any[]>([]);
  const activitiesRef = useRef<any[]>([]);

  const updateActivitiesState = (updater: (prev: any[]) => any[]) => {
    setActivities((prev) => {
      const next = updater(prev);
      activitiesRef.current = next;
      return next;
    });
  };

  // Listen for optimistic 'activitiesMarkedRead' events to update UI immediately
  useEffect(() => {
    const handler = (e: any) => {
      const ids: string[] = e?.detail?.ids || [];
      if (!ids || !ids.length) return;
      updateActivitiesState((prev) => prev.map((a) => ids.includes(a.id) ? { ...a, read: true } : a));
    };
    window.addEventListener('activitiesMarkedRead', handler as EventListener);
    return () => window.removeEventListener('activitiesMarkedRead', handler as EventListener);
  }, []);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('notifications_sound') !== 'false'; } catch { return true; }
  });
  const [volume, setVolume] = useState<number>(() => {
    try { return parseFloat(localStorage.getItem('notifications_volume') || '0.05'); } catch { return 0.05; }
  });

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'activities'),
      where('userId', '==', user.uid),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .sort((a: any, b: any) => (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0) - (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0));
      activitiesRef.current = items;
      setActivities(items);
    }, (err) => {
      console.error('Activities listener error', err);
    });
    return () => unsubscribe();
  }, [user]);

  // Listener para nuevos comentarios en tareas del proyecto (crea actividad local si no existe)
  useEffect(() => {
    if (!user) return;

    const projectId = currentProject?.id || user.uid;
    const qTasks = query(
      collection(db, 'tasks'),
      where('projectId', '==', projectId)
    );

    // mantendremos unsubscribers por task
    const unsubscribers: (() => void)[] = [];

    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      const tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // limpiar listeners anteriores
      unsubscribers.forEach(u => u());
      unsubscribers.length = 0;

      const currentActivities = activitiesRef.current;

      tasks.forEach(task => {
        const commentsRef = collection(db, 'tasks', task.id, 'comments');
        const q = query(commentsRef, orderBy('createdAt', 'desc'), limit(1));
        const unsub = onSnapshot(q, (snap) => {
          snap.docChanges().forEach(change => {
            if (change.type === 'added') {
              const c = { id: change.doc.id, ...(change.doc.data() as any) };
              // si el comentario fue escrito por otro usuario, y no existe actividad para este commentId, crearla
              if (c.userId !== user.uid) {
                const exists = currentActivities.some(a => a.action === 'new_comment' && a.commentId === c.id);
                if (!exists) {
                  try {
                    addActivity(user.uid, 'new_comment', (task as any).title || 'Tarea', { taskId: (task as any).id, commentId: c.id });
                  } catch (err) {
                    console.error('Error creando actividad por nuevo comentario (listener):', err);
                  }
                }
              }
            }
          });
        }, (err) => console.error('Comments listener error', err));

        unsubscribers.push(unsub);
      });
    }, (err) => console.error('Tasks for comments listener error', err));

    return () => { unsubscribeTasks(); unsubscribers.forEach(u => u()); };
  }, [user, currentProject]);

  // Listener adicional: revisar tareas del proyecto para generar alertas de vencimiento
  useEffect(() => {
    if (!user) return;

    const projectId = currentProject?.id || user.uid;
    const qTasks = query(
      collection(db, 'tasks'),
      where('projectId', '==', projectId)
    );

    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      const tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const now = new Date();
      const oneDay = 24 * 60 * 60 * 1000;
      const currentActivities = activitiesRef.current;

      tasks.forEach((task: any) => {
        // Solo procesar tareas que cumplen los criterios: asignada, fecha, y aún no completada
        const isAssignedToUser = Array.isArray(task.assignees) && task.assignees.includes(user.uid);
        const isActiveStatus = task.status === 'todo' || task.status === 'in_progress';
        
        const rawDue = task.dueDate;
        if (!rawDue || !isAssignedToUser || !isActiveStatus) return;
        
        const due = rawDue.toDate ? rawDue.toDate() : new Date(rawDue);
        const diff = due.getTime() - now.getTime();

        const alreadyHasOverdue = currentActivities.some(a => a.action === 'overdue' && a.taskId === task.id);
        const alreadyHasDueSoon = currentActivities.some(a => a.action === 'due_soon' && a.taskId === task.id);

        if (diff < 0 && !alreadyHasOverdue) {
          // tarea vencida
          try {
            addActivity(user.uid, 'overdue', task.title || 'Tarea', { taskId: task.id });
          } catch (err) {
            console.error('Error creando actividad overdue', err);
          }
        } else if (diff <= oneDay && diff >= 0 && !alreadyHasDueSoon) {
          // a punto de vencer (dentro de 24 horas)
          try {
            addActivity(user.uid, 'due_soon', task.title || 'Tarea', { taskId: task.id });
          } catch (err) {
            console.error('Error creando actividad due_soon', err);
          }
        }
      });
    }, (err) => {
      console.error('Tasks listener error', err);
    });

    return () => unsubscribeTasks();
  }, [user, currentProject]);

  const unreadCount = activities.filter(a => !a.read).length;

  const handleOpen = (e: any) => {
    setAnchorEl(e.currentTarget);
  };

  const handleItemClick = async (activityId: string) => {
    try {
      updateActivitiesState((prev) => prev.map((a) => a.id === activityId ? { ...a, read: true } : a));
      await markAsRead(activityId);
    } catch (err) {
      console.error('Error marking as read', err);
    }
  };

  const removeActivityFromState = (activityId: string) => {
    updateActivitiesState((prev) => prev.filter((a) => a.id !== activityId));
  };

  const handleDelete = async (activityId: string) => {
    try {
      await deleteActivity(activityId);
      removeActivityFromState(activityId);
    } catch (err) {
      console.error('Error deleting activity', err);
    }
  };

  const handleAcceptInvitation = async (activity: any) => {
    try {
      if (!activity.invitationId || !activity.projectId || !user) return;
      await acceptInvitation(activity.invitationId, activity.projectId, user.uid);
      await deleteActivity(activity.id);
      removeActivityFromState(activity.id);
    } catch (err) {
      console.error('Error aceptando invitación:', err);
    }
  };

  const handleRejectInvitation = async (activity: any) => {
    try {
      if (!activity.invitationId) return;
      // Marcar invitación como rechazada
      const invitationRef = doc(db, 'invitations', activity.invitationId);
      await updateDoc(invitationRef, { status: 'rejected' });
      await deleteActivity(activity.id);
      removeActivityFromState(activity.id);
    } catch (err) {
      console.error('Error rechazando invitación:', err);
    }
  };

  const handleToggleRead = async (activityId: string, currentlyRead: boolean) => {
    try {
      if (!currentlyRead) {
        updateActivitiesState((prev) => prev.map((a) => a.id === activityId ? { ...a, read: true } : a));
        await markAsRead(activityId);
      } else {
        updateActivitiesState((prev) => prev.map((a) => a.id === activityId ? { ...a, read: false } : a));
        const { updateDoc, doc } = await import('firebase/firestore');
        const r = doc(db, 'activities', activityId);
        await updateDoc(r, { read: false });
      }
    } catch (err) {
      console.error('Error toggling read state', err);
    }
  };

  const handleClose = () => setAnchorEl(null);

  // Play a short beep using WebAudio
  const playBeep = (vol: number = 0.05) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 600;
      g.gain.value = vol;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => { o.stop(); ctx.close(); }, 150);
    } catch (err) {
      // ignore
    }
  };

  // When activities change, detect newly arrived unread activities and notify
  useEffect(() => {
    const prev = prevActivitiesRef.current || [];
    const prevIds = new Set(prev.map((a: any) => a.id));
    const newItems = activities.filter(a => !prevIds.has(a.id));
    const newUnread = newItems.filter(a => !a.read);
    if (newUnread.length > 0) {
      newUnread.forEach(item => {
        // show browser notification only if permission already granted
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(item.action || 'Notificación', { body: item.taskTitle || item.action });
          } catch (err) {
            // ignored
          }
        }
        // play sound if enabled
        if (soundEnabled) playBeep(volume);
      });
    }
    prevActivitiesRef.current = activities;
  }, [activities, soundEnabled, volume]);

  return (
    <>
      <IconButton color="inherit" onClick={handleOpen} aria-label="notificaciones">
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ mt: 1 }}
      >
        <Box sx={{ width: { xs: '90vw', sm: 460 }, maxHeight: { xs: '70vh', sm: 520 } }}>
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Notificaciones</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                <Button size="small" onClick={() => {
                  try { Notification.requestPermission(); } catch (err) { console.error(err); }
                }}>Activar notificaciones</Button>
              )}
              <IconButton size="small" onClick={() => { setSoundEnabled(prev => { const next = !prev; try { localStorage.setItem('notifications_sound', String(next)); } catch {} return next; }); }}>
                {soundEnabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
              </IconButton>
              <Box sx={{ width: 120, minWidth: 90 }}>
                <Slider size="small" value={volume} min={0} max={0.2} step={0.01} onChange={(_e, v) => { const val = Array.isArray(v) ? v[0] : v; setVolume(val); try { localStorage.setItem('notifications_volume', String(val)); } catch {} }} />
              </Box>
              <Button size="small" onClick={() => { activities.filter(a=>!a.read).forEach(a=>markAsRead(a.id)); }}>Marcar todas leídas</Button>
            </Box>
          </Box>
          <Divider />
          <List dense>
            {activities.length === 0 && (
              <ListItem>
                <ListItemText primary="No hay notificaciones" />
              </ListItem>
            )}
            {activities.map(act => (
              <ListItem
                key={act.id}
                alignItems="flex-start"
                onClick={() => handleItemClick(act.id)}
                sx={{ bgcolor: act.read ? 'transparent' : 'action.selected', cursor: 'pointer', py: 1.25, px: 1.5, minHeight: 60 }}
                secondaryAction={
                  act.action === 'project_invitation' ? (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton edge="end" size="small" onClick={(e) => { e.stopPropagation(); handleAcceptInvitation(act); }} aria-label="Aceptar" title="Aceptar invitación" sx={{ color: 'success.main' }}>
                        <CheckIcon fontSize="small" />
                      </IconButton>
                      <IconButton edge="end" size="small" onClick={(e) => { e.stopPropagation(); handleRejectInvitation(act); }} aria-label="Rechazar" title="Rechazar invitación" sx={{ color: 'error.main' }}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton edge="end" size="small" onClick={(e) => { e.stopPropagation(); handleToggleRead(act.id, !!act.read); }} aria-label={act.read ? 'Marcar no leído' : 'Marcar leído'}>
                        {act.read ? <DoneIcon fontSize="small" /> : <DoneIcon fontSize="small" color="primary" />}
                      </IconButton>
                      <IconButton edge="end" size="small" onClick={(e) => { e.stopPropagation(); handleDelete(act.id); }} aria-label="Eliminar">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )
                }
              >
                <ListItemAvatar>
                  <Avatar>{act.taskTitle?.charAt(0)?.toUpperCase() || act.action?.charAt(0)?.toUpperCase() || 'A'}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="body1" sx={{ whiteSpace: 'normal', wordBreak: 'break-word', fontWeight: act.read ? 'normal' : 'bold' }}>
                      {act.action === 'create_task' ? `Tarea creada: ${act.taskTitle}` :
                      act.action === 'move_task' ? `Tarea movida: ${act.taskTitle}` :
                      act.action === 'complete_task' ? `Tarea completada: ${act.taskTitle}` :
                      act.action === 'new_comment' ? `Nuevo comentario: ${act.taskTitle}` :
                      act.action === 'project_invitation' ? `Invitación: ${act.taskTitle}` :
                      act.action === 'due_soon' ? `⏰ Tarea por vencer: ${act.taskTitle}` :
                      act.action === 'overdue' ? `⚠️ Tarea vencida: ${act.taskTitle}` :
                      act.action}
                    </Typography>
                  }
                  secondary={
                    <>
                      <Typography component="span" variant="body2" sx={{ display: 'block', whiteSpace: 'normal', wordBreak: 'break-word', color: 'text.primary' }}>
                        {act.action === 'due_soon' ? 'Esta tarea está asignada a ti y vence próximamente' :
                        act.action === 'overdue' ? 'Esta tarea está asignada a ti y ya ha vencido' :
                        act.taskTitle && act.action === 'new_comment' ? (act.taskTitle) : ''}
                      </Typography>
                      <Typography component="span" variant="caption" sx={{ display: 'block', mt: 0.5 }}>{new Date(act.timestamp?.toDate ? act.timestamp.toDate() : act.timestamp).toLocaleString()}</Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Popover>
    </>
  );
}
