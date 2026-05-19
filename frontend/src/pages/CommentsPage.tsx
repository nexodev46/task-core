import { useState, useEffect } from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemButton, TextField, Button, Select, MenuItem, FormControl, InputLabel, Chip, Avatar } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, addDoc, query, where, orderBy, onSnapshot, updateDoc, doc, increment } from 'firebase/firestore';
import { addActivity, markAsRead } from '../services/activityService';

interface Comment {
  id?: string;
  text: string;
  userId: string;
  userName: string;
  createdAt: any;
  taskId: string;
  taskTitle: string;
  read?: boolean;
}

export default function CommentsPage() {
  const { user } = useAuth();
  const { currentProject } = useProject();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<any[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedTask, setSelectedTask] = useState('');
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  // Cargar tareas del usuario en tiempo real
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const projectId = currentProject?.id || user.uid;
    const q = query(collection(db, 'tasks'), where('projectId', '==', projectId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [user, currentProject?.id]);

  // Cargar comentarios en tiempo real
  useEffect(() => {
    if (!tasks.length) {
      setComments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let allComments: Comment[] = [];
    let unsubscribers: (() => void)[] = [];

    tasks.forEach(task => {
      const commentsRef = collection(db, 'tasks', task.id, 'comments');
      const q = query(commentsRef, orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const taskComments = snapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as any),
          taskId: task.id,
          taskTitle: task.title
        }));

        allComments = allComments.filter(c => c.taskId !== task.id);
        allComments.push(...taskComments);
        allComments.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

        setComments([...allComments]);
        setLoading(false);
      }, (err) => {
        console.error('Error cargando comentarios:', err);
        setLoading(false);
      });

      unsubscribers.push(unsubscribe);
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [tasks]);

  useEffect(() => {
    if (!user) return;

    const commentsActivityQuery = query(
      collection(db, 'activities'),
      where('userId', '==', user.uid),
      where('action', '==', 'new_comment'),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(commentsActivityQuery, (snapshot) => {
      snapshot.docs.forEach((activityDoc) => {
        markAsRead(activityDoc.id).catch((err) => console.error('Error marcando comentario como leído:', err));
      });
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!comments.length) return;

    comments.forEach((comment) => {
      if (!comment.read && comment.id) {
        const commentRef = doc(db, 'tasks', comment.taskId, 'comments', comment.id);
        updateDoc(commentRef, { read: true }).catch((err) => console.error('Error marcando comentario local como leído:', err));
      }
    });
  }, [comments]);

  const handleAddComment = async () => {
    if (!selectedTask || !newComment.trim()) return;
    
    try {
      const commentsRef = collection(db, 'tasks', selectedTask, 'comments');
      const docRef = await addDoc(commentsRef, {
        text: newComment,
        userId: user?.uid,
        userName: user?.displayName || 'Usuario',
        createdAt: new Date(),
        read: false
      });

      const taskRef = doc(db, 'tasks', selectedTask);
      await updateDoc(taskRef, {
        commentsCount: increment(1)
      });

      // crear actividad para el propietario del proyecto/usuario
      const taskObj = tasks.find(t => t.id === selectedTask) || {};

      // Determinar destinatarios: ownerId, assignees (array), projectId (si refiere a usuario)
      const recipients = new Set();
      if (taskObj.ownerId) recipients.add(taskObj.ownerId);
      if (taskObj.projectId) recipients.add(taskObj.projectId);
      if (Array.isArray(taskObj.assignees)) {
        taskObj.assignees.forEach((a: any) => recipients.add(a));
      }

      // Eliminar el propio autor para que no reciba 'new_comment' si fue quien comentó
      recipients.delete(user?.uid);

      // crear actividad para cada destinatario
      for (const rid of recipients) {
        try {
          await addActivity(rid, 'new_comment', taskObj?.title || 'Tarea', { taskId: selectedTask, commentId: docRef.id });
        } catch (err) {
          console.error('Error al crear actividad por comentario para', rid, err);
        }
      }

      // crear actividad local para el autor del comentario para que vea su propio post en el panel
      try {
        await addActivity(user?.uid, 'comment_posted', taskObj?.title || 'Tarea', { taskId: selectedTask, commentId: docRef.id });
      } catch (err) {
        console.error('Error al crear actividad local para autor del comentario:', err);
      }

      setNewComment('');
      setSelectedTask('');
    } catch (error) {
      console.error('Error al agregar comentario:', error);
    }
  };

  const handleGoToTask = (_taskId: string) => {
    navigate('/');
  };

  const unreadCount = comments.filter(c => !c.read).length;

  if (loading) return <Typography align="center" sx={{ mt: 3 }}>Cargando comentarios...</Typography>;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Comentarios
        </Typography>
        {unreadCount > 0 && <Chip label={`${unreadCount} sin leer`} color="primary" />}
      </Box>

      <Paper sx={{ p: 3, mb: 3, bgcolor: '#f9f9f9' }}>
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>Agregar comentario</Typography>
        <FormControl fullWidth margin="normal">
          <InputLabel>Selecciona una tarea</InputLabel>
          <Select value={selectedTask} onChange={e => setSelectedTask(e.target.value)}>
            {tasks.map(task => (
              <MenuItem key={task.id} value={task.id}>
                {task.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField 
          label="Escribe un comentario" 
          fullWidth 
          multiline 
          rows={3} 
          value={newComment} 
          onChange={e => setNewComment(e.target.value)} 
          margin="normal"
          placeholder="Comparte tu pensamiento..."
        />
        <Button 
          variant="contained" 
          onClick={handleAddComment} 
          sx={{ mt: 2 }}
          disabled={!selectedTask || !newComment.trim()}
        >
          Agregar comentario
        </Button>
      </Paper>

      <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
        Feed de actividad ({comments.length})
      </Typography>

      {comments.length === 0 ? (
        <Typography align="center" color="text.secondary" sx={{ py: 4 }}>
          No hay comentarios aún. ¡Comienza a comentar en tus tareas!
        </Typography>
      ) : (
        <List sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {comments.map((comment, idx) => (
            <ListItem key={comment.id || idx} disablePadding>
              <ListItemButton
                onClick={() => handleGoToTask(comment.taskId)}
                component={Paper}
                sx={{
                  p: 2,
                  width: '100%',
                  bgcolor: comment.read ? '#fff' : '#f0f7ff',
                  border: '1px solid #e0e0e0',
                  '&:hover': { bgcolor: '#f5f5f5', boxShadow: 2 },
                  cursor: 'pointer'
                }}
              >
                <Box sx={{ width: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                      {comment.userName.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {comment.taskTitle}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {comment.userName} • {comment.createdAt?.toDate?.().toLocaleString() || 'hace poco'}
                      </Typography>
                    </Box>
                    {!comment.read && <Chip label="Nuevo" size="small" color="primary" />}
                  </Box>
                  <Typography variant="body2" sx={{ ml: 5, mt: 1 }}>
                    {comment.text}
                  </Typography>
                </Box>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}