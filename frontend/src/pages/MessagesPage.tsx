import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import {
  Box, Typography, Paper, TextField, IconButton,
  Avatar, CircularProgress,
  Alert, Snackbar
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { db } from '../firebase/config';
import { collection, query, where, orderBy, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { addActivity, markAsRead } from '../services/activityService';
import { getProjectMembers } from '../services/projectService';

interface Message {
  id: string;
  projectId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: any;
  read?: boolean;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suscripción en tiempo real a los mensajes del proyecto actual
  useEffect(() => {
    if (!currentProject) return;
    setLoading(true);
    const q = query(
      collection(db, 'messages'),
      where('projectId', '==', currentProject.id),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError('Error al cargar mensajes');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentProject]);

  // Marcar las notificaciones de mensajes como leídas cuando el usuario entra al chat
  useEffect(() => {
    if (!user) return;

    const notificationsQuery = query(
      collection(db, 'activities'),
      where('userId', '==', user.uid),
      where('action', '==', 'new_message'),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      snapshot.docs.forEach((activityDoc) => {
        markAsRead(activityDoc.id).catch((err) => console.error('Error marcando mensaje como leído:', err));
      });
    });

    return unsubscribe;
  }, [user]);

  // Auto-scroll al final cuando llegan nuevos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentProject || !user) return;
    setSending(true);
    try {
      const docRef = await addDoc(collection(db, 'messages'), {
        projectId: currentProject.id,
        senderId: user.uid,
        senderName: user.displayName || user.email?.split('@')[0] || 'Anónimo',
        text: newMessage.trim(),
        timestamp: serverTimestamp(),
        read: false
      });

      const members = await getProjectMembers(currentProject.id);
      const recipients = members
        .map((member) => member.userId)
        .filter((recipientId) => recipientId !== user.uid);

      await Promise.all(
        recipients.map((recipientId) =>
          addActivity(recipientId, 'new_message', currentProject.name, {
            projectId: currentProject.id,
            messageId: docRef.id
          })
        )
      );

      setNewMessage('');
    } catch (err) {
      console.error(err);
      setError('No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    const date = typeof timestamp?.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getInitial = (name: string) => name.trim().charAt(0).toUpperCase();

  if (!currentProject) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5">Selecciona un proyecto para ver sus mensajes</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', p: 2 }}>
      {/* Cabecera */}
      <Paper elevation={2} sx={{ p: 3, mb: 2, borderRadius: 3, bgcolor: '#4564a5', color: 'common.white' }}>
        <Typography variant="h5" sx={{ mb: 1, fontWeight: '700' }}>
          {currentProject.name}
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.92)' }}>
          Chat colaborativo en tiempo real · {messages.length} mensajes
        </Typography>
      </Paper>

      {/* Área de mensajes */}
      <Paper sx={{ flexGrow: 1, overflow: 'hidden', borderRadius: 3, mb: 2, bgcolor: '#e5e7eb', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : messages.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 4 }}>
            <Typography variant="body1" color="textSecondary">No hay mensajes aún. ¡Envía el primero!</Typography>
          </Box>
        ) : (
          <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 3 }}>
            {messages.map((msg, idx) => {
              const isOwn = msg.senderId === user?.uid;
              const previousSender = idx > 0 ? messages[idx - 1].senderId : null;
              const showAvatar = idx === 0 || msg.senderId !== previousSender;
              const bubbleBg = isOwn ? '#345fa5' : '#ffffff';
              const textColor = isOwn ? '#ffffff' : '#111827';
              const alignRight = isOwn ? 'flex-end' : 'flex-start';
              const timestamp = formatTimestamp(msg.timestamp);

              return (
                <Box key={msg.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: alignRight, mb: showAvatar ? 2.5 : 1.2 }}>
                  {showAvatar && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8, width: '100%', justifyContent: alignRight }}>
                      {!isOwn && (
                        <Avatar sx={{ width: 34, height: 34, bgcolor: '#325ca0', fontSize: '0.9rem' }}>
                          {getInitial(msg.senderName)}
                        </Avatar>
                      )}
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151' }}>
                          {msg.senderName}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {timestamp}
                        </Typography>
                      </Box>
                      {isOwn && (
                        <Avatar sx={{ width: 34, height: 34, bgcolor: '#0f172a', fontSize: '0.9rem' }}>
                          {getInitial(msg.senderName)}
                        </Avatar>
                      )}
                    </Box>
                  )}

                  <Box sx={{
                    maxWidth: '78%',
                    minWidth: 100,
                    px: 2.2,
                    py: 1.5,
                    borderRadius: 3,
                    bgcolor: bubbleBg,
                    color: textColor,
                    boxShadow: 1,
                    borderTopLeftRadius: isOwn ? 18 : 4,
                    borderTopRightRadius: isOwn ? 4 : 18,
                    borderBottomLeftRadius: 18,
                    borderBottomRightRadius: 18,
                    wordBreak: 'break-word'
                  }}>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {msg.text}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
            <div ref={messagesEndRef} />
          </Box>
        )}
      </Paper>

      {/* Input de mensajes */}
      <Paper elevation={3} sx={{ p: 2, borderRadius: 3, bgcolor: '#ffffff' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <AttachIcon sx={{ color: 'text.secondary' }} />
          <Typography variant="subtitle2" color="textSecondary">Mensaje rápido</Typography>
          <Typography variant="caption" color="textSecondary" sx={{ ml: 'auto' }}>
            Enter para enviar · Shift+Enter para salto de línea
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Escribe un mensaje..."
            multiline
            maxRows={6}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            sx={{ bgcolor: '#ffffff', borderRadius: 3 }}
          />
          <IconButton onClick={handleSendMessage} disabled={!newMessage.trim() || sending} color="primary" sx={{ bgcolor: '#2563eb', color: '#ffffff', '&:hover': { bgcolor: '#1d4ed8' } }}>
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>

      {/* Snackbar de error */}
      <Snackbar open={!!error} autoHideDuration={4000} onClose={() => setError('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
      </Snackbar>
    </Box>
  );
}