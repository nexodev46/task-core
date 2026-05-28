import { useState, useEffect } from 'react';
import { Box, Typography, Paper, TextField, Button, Chip, Avatar, Autocomplete, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Tooltip, CircularProgress } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import SendIcon from '@mui/icons-material/Send';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { db } from '../firebase/config';
import { collection, addDoc, query, where, orderBy, onSnapshot, updateDoc, doc, increment, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
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
  reactions?: Record<string, string[]>;
}

// Función para formatear fechas de forma relativa
function formatRelativeDate(date: any): string {
  if (!date) return 'hace poco';
  const d = date.toDate?.() || date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'hace unos segundos';
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;
  return d.toLocaleDateString();
}

export default function CommentsPage() {
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [tasks, setTasks] = useState<any[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null);

  const reactionOptions = [
    { key: 'like', emoji: '👍' },
    { key: 'love', emoji: '❤️' },
    { key: 'smile', emoji: '😄' }
  ];

  const handleToggleReaction = async (comment: Comment, reaction: string) => {
    if (!user?.uid || !comment.id || !comment.taskId) return;
    const commentRef = doc(db, 'tasks', comment.taskId, 'comments', comment.id);
    const userId = user.uid;
    const existing = comment.reactions?.[reaction] || [];
    const hasReacted = existing.includes(userId);

    const updates: Record<string, any> = {};

    if (hasReacted) {
      updates[`reactions.${reaction}`] = arrayRemove(userId);
    } else {
      updates[`reactions.${reaction}`] = arrayUnion(userId);
      reactionOptions.forEach((option) => {
        if (option.key !== reaction) {
          const otherReactions = comment.reactions?.[option.key] || [];
          if (otherReactions.includes(userId)) {
            updates[`reactions.${option.key}`] = arrayRemove(userId);
          }
        }
      });
    }

    try {
      await updateDoc(commentRef, updates);
    } catch (error) {
      console.error('Error al reaccionar al comentario:', error);
    }
  };

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
      snapshot.docs
        .filter((doc) => (doc.data() as any).deleted !== true)
        .forEach((activityDoc) => {
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
    if (!selectedTask?.id || !newComment.trim()) return;
    
    try {
      const commentsRef = collection(db, 'tasks', selectedTask.id, 'comments');
      const docRef = await addDoc(commentsRef, {
        text: newComment,
        userId: user?.uid,
        userName: user?.displayName || 'Usuario',
        createdAt: new Date(),
        read: false,
        reactions: {}
      });

      const taskRef = doc(db, 'tasks', selectedTask.id);
      await updateDoc(taskRef, {
        commentsCount: increment(1)
      });

      // crear actividad para el propietario del proyecto/usuario
      const taskObj = selectedTask;

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
          await addActivity(rid, 'new_comment', taskObj?.title || 'Tarea', { taskId: selectedTask.id, commentId: docRef.id });
        } catch (err) {
          console.error('Error al crear actividad por comentario para', rid, err);
        }
      }

      // crear actividad local para el autor del comentario para que vea su propio post en el panel
      try {
        await addActivity(user?.uid, 'comment_posted', taskObj?.title || 'Tarea', { taskId: selectedTask.id, commentId: docRef.id });
      } catch (err) {
        console.error('Error al crear actividad local para autor del comentario:', err);
      }

      setNewComment('');
      setSelectedTask(null);
    } catch (error) {
      console.error('Error al agregar comentario:', error);
    }
  };

  const handleEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id || '');
    setEditingText(comment.text);
  };

  const handleSaveEdit = async (comment: Comment) => {
    if (!editingText.trim() || !comment.id) return;
    try {
      const commentRef = doc(db, 'tasks', comment.taskId, 'comments', comment.id);
      await updateDoc(commentRef, { text: editingText, updatedAt: new Date() });
      setEditingCommentId(null);
      setEditingText('');
    } catch (error) {
      console.error('Error al editar comentario:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingText('');
  };

  const handleDeleteComment = (comment: Comment) => {
    setCommentToDelete(comment);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!commentToDelete?.id) return;
    try {
      const commentRef = doc(db, 'tasks', commentToDelete.taskId, 'comments', commentToDelete.id);
      await deleteDoc(commentRef);
      const taskRef = doc(db, 'tasks', commentToDelete.taskId);
      await updateDoc(taskRef, {
        commentsCount: increment(-1)
      });
      setDeleteConfirmOpen(false);
      setCommentToDelete(null);
    } catch (error) {
      console.error('Error al eliminar comentario:', error);
    }
  };

  const unreadCount = comments.filter(c => !c.read).length;

  if (loading) return <Typography align="center" sx={{ mt: 3 }}>Cargando comentarios...</Typography>;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Comentarios</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {comments.length} comentarios · Colabora en tiempo real en tus tareas
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {unreadCount > 0 && <Chip label={`${unreadCount} sin leer`} color="primary" variant="filled" />}
        </Box>
      </Box>

      {/* Agregar comentario */}
      <Paper sx={{ p: 3, mb: 4, borderRadius: 2, boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)', bgcolor: '#f5f8ff' }}>
        <Typography variant="subtitle1" sx={{ mb: 2.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SendIcon sx={{ fontSize: 20 }} />
          Nuevo comentario
        </Typography>

        {/* Selector de tarea con Autocomplete */}
        <Autocomplete
          options={tasks}
          getOptionLabel={(option) => option.title || ''}
          value={selectedTask}
          onChange={(_, newValue) => setSelectedTask(newValue)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Selecciona una tarea"
              placeholder="Busca y selecciona una tarea..."
              margin="normal"
            />
          )}
          sx={{ mb: 2 }}
          noOptionsText="No hay tareas disponibles"
        />

        {/* Task info si está seleccionada */}
        {selectedTask && (
          <Box sx={{ mb: 2, p: 2, bgcolor: '#fff', borderRadius: 1.5, border: '1px solid rgba(13, 71, 161, 0.2)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ px: 1.5, py: 0.5, bgcolor: 'primary.main', color: '#fff', borderRadius: 1, fontSize: '0.75rem', fontWeight: 600 }}>
              {selectedTask.status || 'todo'}
            </Box>
            <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>{selectedTask.title}</Typography>
          </Box>
        )}

        {/* Área de texto del comentario */}
        <TextField
          label="Escribe tu comentario"
          fullWidth
          multiline
          rows={4}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Comparte tu pensamiento, sugerencias o actualizaciones..."
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              '&:hover fieldset': { borderColor: 'primary.main' }
            }
          }}
        />

        {/* Botones de acción */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Emojis (próximamente)">
              <IconButton size="small" disabled sx={{ color: 'text.secondary' }}>
                <EmojiEmotionsIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="text"
              onClick={() => {
                setNewComment('');
                setSelectedTask(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={handleAddComment}
              disabled={!selectedTask?.id || !newComment.trim()}
              startIcon={<SendIcon />}
            >
              Publicar
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Feed de comentarios */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Feed de comentarios</Typography>
          <Chip label={comments.length} variant="outlined" size="small" />
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : comments.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.paper' }}>
            <Typography color="text.secondary">No hay comentarios aún. ¡Comienza a colaborar!</Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {comments.map((comment, idx) => (
              <Paper
                key={comment.id || idx}
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  bgcolor: idx % 2 === 0 ? '#fff' : '#fcfdff',
                  border: '1px solid #e0e0e0',
                  borderLeft: user?.uid === comment.userId ? '4px solid' : '1px solid',
                  borderLeftColor: user?.uid === comment.userId ? 'primary.main' : '#e0e0e0',
                  transition: 'all 150ms ease',
                  '&:hover': {
                    boxShadow: '0 8px 16px rgba(15, 23, 42, 0.1)',
                    transform: 'translateY(-1px)'
                  }
                }}
              >
                {/* Header del comentario */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                    <Avatar
                      sx={{
                        width: 40,
                        height: 40,
                        bgcolor: 'primary.main',
                        fontWeight: 600,
                        cursor: 'pointer',
                        '&:hover': { opacity: 0.8 }
                      }}
                    >
                      {comment.userName.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {comment.userName}
                        </Typography>
                        {user?.uid === comment.userId && (
                          <Chip label="Tú" size="small" variant="outlined" sx={{ height: 20 }} />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {formatRelativeDate(comment.createdAt)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, cursor: 'pointer' }}>
                          {comment.taskTitle}
                        </Typography>
                        {!comment.read && <Chip label="Nuevo" size="small" color="primary" variant="filled" sx={{ height: 20 }} />}
                      </Box>
                    </Box>
                  </Box>

                  {/* Acciones del comentario (solo para el autor) */}
                  {user?.uid === comment.userId && (
                    <Box sx={{ display: 'flex', gap: 0.5, opacity: editingCommentId !== comment.id ? 0.3 : 1, transition: 'opacity 150ms ease', '&:hover': { opacity: 1 } }}>
                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          onClick={() => handleEditComment(comment)}
                          disabled={editingCommentId !== null && editingCommentId !== comment.id}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteComment(comment)}
                          sx={{ color: 'error.main' }}
                          disabled={editingCommentId !== null}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>

                {/* Texto del comentario o edición */}
                {editingCommentId === comment.id ? (
                  <Box sx={{ mt: 1.5 }}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      sx={{
                        mb: 1,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1.5
                        }
                      }}
                    />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleSaveEdit(comment)}
                        disabled={!editingText.trim()}
                      >
                        Guardar
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        onClick={handleCancelEdit}
                      >
                        Cancelar
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.primary',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        mt: 1
                      }}
                    >
                      {comment.text}
                    </Typography>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                      {reactionOptions.map((option) => {
                        const userReactions = comment.reactions?.[option.key] || [];
                        const selected = user?.uid ? userReactions.includes(user.uid) : false;

                        return (
                          <Button
                            key={option.key}
                            size="small"
                            onClick={() => handleToggleReaction(comment, option.key)}
                            sx={{
                              textTransform: 'none',
                              borderRadius: 3,
                              minWidth: 'auto',
                              px: 0.75,
                              py: 0.5,
                              fontSize: '0.85rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.2,
                              border: '1px solid',
                              borderColor: selected ? 'primary.main' : 'divider',
                              bgcolor: selected ? 'primary.main' : 'action.hover',
                              color: selected ? '#fff' : 'text.secondary',
                              boxShadow: selected ? '0 4px 10px rgba(25, 118, 210, 0.12)' : 'none',
                              '&:hover': {
                                bgcolor: selected ? 'primary.dark' : 'action.selected',
                                borderColor: selected ? 'primary.dark' : 'text.secondary'
                              }
                            }}
                          >
                            <Box component="span" sx={{ fontSize: '0.95rem', lineHeight: 1 }}>
                              {option.emoji}
                            </Box>
                            {userReactions.length > 0 && (
                              <Box component="span" sx={{ fontSize: '0.75rem', ml: 0.2, fontWeight: 600 }}>
                                {userReactions.length}
                              </Box>
                            )}
                          </Button>
                        );
                      })}
                    </Box>
                  </>
                )}
              </Paper>
            ))}
          </Box>
        )}
      </Box>

      {/* Diálogo de confirmación de eliminación */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Eliminar comentario</DialogTitle>
        <DialogContent>
          <Typography>¿Estás seguro de que deseas eliminar este comentario? Esta acción no se puede deshacer.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancelar</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}