import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react';
import {
  Box, Typography, Paper, TextField, IconButton,
  Avatar, CircularProgress,
  Alert, Snackbar, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Popover
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachIcon,
  Delete as DeleteIcon,
  EmojiEmotions as EmojiIcon,
  Mic as MicIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { db, storage } from '../firebase/config';
import {
  collection,
  query,
  where,
  orderBy,
  addDoc,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
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
  reactions?: Record<string, string[]>;
  imageUrl?: string | null;
  audioUrl?: string | null;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLElement | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreview, setAudioPreview] = useState('');
  const [error, setError] = useState('');
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Record<string, { avatar?: string; name: string }>>({});
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);
  const [hoverReactionMessageId, setHoverReactionMessageId] = useState<string | null>(null);
  const [showMoreQuickReplies, setShowMoreQuickReplies] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const lastSentRef = useRef<{ text: string; time: number }>({ text: '', time: 0 });

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
    if (!user || !currentProject) return;

    const notificationsQuery = query(
      collection(db, 'activities'),
      where('userId', '==', user.uid),
      where('action', '==', 'new_message'),
      where('projectId', '==', currentProject.id),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const ids = snapshot.docs.map(d => d.id);
      if (ids.length === 0) return;
      // Optimistic local broadcast so the notifications UI updates immediately
      try { window.dispatchEvent(new CustomEvent('activitiesMarkedRead', { detail: { ids } })); } catch (err) { /* ignore */ }
      ids.forEach((activityId) => {
        markAsRead(activityId).catch((err) => console.error('Error marcando mensaje como leído:', err));
      });
    });

    return unsubscribe;
  }, [user, currentProject]);

  // Auto-scroll al final cuando llegan nuevos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      if (audioPreview) {
        URL.revokeObjectURL(audioPreview);
      }
    };
  }, [imagePreview, audioPreview]);

  useEffect(() => {
    if (!messages.length) return;

    const fetchProfiles = async () => {
      const uniqueIds = Array.from(new Set(messages.map((msg) => msg.senderId)));
      const profiles: Record<string, { avatar?: string; name: string }> = {};

      await Promise.all(uniqueIds.map(async (uid) => {
        if (userProfiles[uid]) return;

        try {
          const userRef = doc(db, 'users', uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            profiles[uid] = {
              avatar: data.avatarBase64 || data.photoURL,
              name: data.fullName || data.displayName || ''
            };
            return;
          }

          const profileRef = doc(db, 'profiles', uid);
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            const data = profileSnap.data();
            profiles[uid] = {
              avatar: data.avatarBase64 || data.photoURL,
              name: data.fullName || data.displayName || ''
            };
          }
        } catch (err) {
          console.error('Error cargando perfil de mensaje:', err);
        }
      }));

      if (Object.keys(profiles).length > 0) {
        setUserProfiles((prev) => ({ ...prev, ...profiles }));
      }
    };

    fetchProfiles();
  }, [messages, userProfiles]);

  const handleSendMessage = async (overrideText?: string | MouseEvent<HTMLElement>) => {
    const messageText = typeof overrideText === 'string' ? overrideText : newMessage.trim();
    if ((!messageText && !attachedImage && !audioBlob) || !currentProject || !user) return;
    // prevent accidental rapid duplicate sends of identical content
    try {
      const now = Date.now();
      if (messageText && lastSentRef.current.text === messageText && (now - lastSentRef.current.time) < 800) return;
      lastSentRef.current = { text: messageText, time: now };
    } catch (err) { /* ignore */ }
    // Clear the input immediately so the user doesn't see the previous text lingering
    setNewMessage('');
    setSending(true);
    let imageUrl: string | null = null;
    let audioUrl: string | null = null;

    try {
      if (attachedImage) {
        setUploadingImage(true);
        const storagePath = `chat_images/${currentProject.id}/${Date.now()}_${attachedImage.name}`;
        const imageRef = storageRef(storage, storagePath);
        await uploadBytes(imageRef, attachedImage);
        imageUrl = await getDownloadURL(imageRef);
      }

      if (audioBlob) {
        const storagePath = `chat_audio/${currentProject.id}/${Date.now()}.webm`;
        const audioRef = storageRef(storage, storagePath);
        await uploadBytes(audioRef, audioBlob);
        audioUrl = await getDownloadURL(audioRef);
      }

      const docRef = await addDoc(collection(db, 'messages'), {
        projectId: currentProject.id,
        senderId: user.uid,
        senderName: user.displayName || user.email?.split('@')[0] || 'Anónimo',
        timestamp: new Date(),
        text: messageText,
        read: false,
        reactions: {},
        imageUrl: imageUrl || null,
        audioUrl: audioUrl || null
      });

      const newMessageEntry: Message = {
        id: docRef.id,
        projectId: currentProject.id,
        senderId: user.uid,
        senderName: user.displayName || user.email?.split('@')[0] || 'Anónimo',
        timestamp: new Date(),
        text: messageText,
        read: false,
        reactions: {},
        imageUrl: imageUrl || null,
        audioUrl: audioUrl || null
      };
      setMessages((prev) => [...prev, newMessageEntry]);

      const members = await getProjectMembers(currentProject.id);
      const recipients = members
        .map((member) => member.userId)
        .filter((recipientId) => recipientId !== user.uid);

      Promise.all(
        recipients.map((recipientId) =>
          addActivity(recipientId, 'new_message', currentProject.name, {
            projectId: currentProject.id,
            messageId: docRef.id
          })
        )
      ).catch((err) => {
        console.error('Error al crear notificaciones de mensaje:', err);
      });

      setNewMessage('');
      setAttachedImage(null);
      setImagePreview('');
      if (audioPreview) {
        URL.revokeObjectURL(audioPreview);
      }
      setAudioBlob(null);
      setAudioPreview('');
    } catch (err) {
      console.error(err);
      setError('No se pudo enviar el mensaje');
    } finally {
      setUploadingImage(false);
      setSending(false);
    }
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecciona una imagen válida.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('La imagen no debe superar 20 MB.');
      return;
    }

    setAttachedImage(file);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleStartRecording = async () => {
    if (recording) {
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Tu navegador no soporta grabación de audio.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioPreview) {
          URL.revokeObjectURL(audioPreview);
        }
        setAudioBlob(audioBlob);
        setAudioPreview(URL.createObjectURL(audioBlob));
        setRecording(false);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      console.error(err);
      setError('No se pudo iniciar la grabación de audio.');
    }
  };

  const handleStopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
  };

  const handleCancelAudio = () => {
    if (audioPreview) {
      URL.revokeObjectURL(audioPreview);
    }
    setAudioBlob(null);
    setAudioPreview('');
  };

  const handleRemoveImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setAttachedImage(null);
    setImagePreview('');
  };

  const handleOpenEmojiPicker = (event: MouseEvent<HTMLElement>) => {
    setEmojiAnchorEl(event.currentTarget);
  };

  const handleCloseEmojiPicker = () => {
    setEmojiAnchorEl(null);
  };

  const emojiOptions = ['😀', '😉', '😍', '😎', '🤩', '😂', '🥳', '👍', '🎉', '🔥'];

  const handleSelectEmoji = async (emoji: string) => {
    if (!currentProject || !user) return;

    if (!newMessage.trim() && !attachedImage && !audioBlob) {
      await handleSendMessage(emoji);
    } else {
      setNewMessage((prev) => `${prev}${emoji}`);
    }
    setEmojiAnchorEl(null);
  };

  const handleRequestDeleteMessage = (messageId: string) => {
    setMessageToDelete(messageId);
    setDeleteDialogOpen(true);
  };

  const handleCancelDelete = () => {
    setMessageToDelete(null);
    setDeleteDialogOpen(false);
  };

  const reactionOptions = [
    { key: 'like', emoji: '👍' },
    { key: 'love', emoji: '❤️' },
    { key: 'smile', emoji: '😄' }
  ];

  const handleToggleReaction = async (message: Message, reaction: string) => {
    if (!user?.uid || !message.id) return;
    const messageRef = doc(db, 'messages', message.id);
    const userId = user.uid;
    const existing = message.reactions?.[reaction] || [];
    const hasReacted = existing.includes(userId);
    const updates: Record<string, any> = {};

    if (hasReacted) {
      updates[`reactions.${reaction}`] = arrayRemove(userId);
    } else {
      updates[`reactions.${reaction}`] = arrayUnion(userId);
      reactionOptions.forEach((option) => {
        if (option.key !== reaction) {
          const other = message.reactions?.[option.key] || [];
          if (other.includes(userId)) {
            updates[`reactions.${option.key}`] = arrayRemove(userId);
          }
        }
      });
    }

    try {
      await updateDoc(messageRef, updates);
    } catch (err) {
      console.error('Error al reaccionar al mensaje:', err);
    }
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;
    setDeleteDialogOpen(false);
    try {
      await deleteDoc(doc(db, 'messages', messageToDelete));
      setMessageToDelete(null);
    } catch (err) {
      console.error(err);
      setError('No se pudo eliminar el mensaje');
    }
  };

  const quickReplies = ['HOLA', 'COMO VAN', 'GENIAL'];
  const moreQuickReplies = ['Gracias', 'Perfecto', '¿Listo ya?'];

  const handleQuickReply = (reply: string) => {
    setNewMessage(reply);
  };

  const handleToggleMoreQuickReplies = () => {
    setShowMoreQuickReplies((prev) => !prev);
  };

  const parseTimestamp = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp?.toDate === 'function') {
      return timestamp.toDate();
    }
    if (typeof timestamp === 'object' && timestamp?.seconds != null) {
      return new Date((timestamp.seconds * 1000) + Math.floor((timestamp.nanoseconds || 0) / 1000000));
    }
    if (typeof timestamp === 'number') {
      return new Date(timestamp);
    }
    const parsed = new Date(String(timestamp));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getDayLabel = (timestamp: any) => {
    const date = parseTimestamp(timestamp);
    if (!date) return '';

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoy';
    if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
  };

  const isSameDay = (a: any, b: any) => {
    const dateA = parseTimestamp(a);
    const dateB = parseTimestamp(b);
    if (!dateA || !dateB) return false;
    return dateA.toDateString() === dateB.toDateString();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';

    let date: Date;
    if (typeof timestamp?.toDate === 'function') {
      date = timestamp.toDate();
    } else if (typeof timestamp === 'object' && timestamp?.seconds != null) {
      date = new Date((timestamp.seconds * 1000) + Math.floor((timestamp.nanoseconds || 0) / 1000000));
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      date = new Date(String(timestamp));
    }

    if (Number.isNaN(date.getTime())) return '';

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
      <Paper sx={{ flexGrow: 1, overflow: 'hidden', borderRadius: 4, mb: 2, bgcolor: '#eef5ff', display: 'flex', flexDirection: 'column', border: '1px solid rgba(148,163,184,0.24)' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : messages.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 4 }}>
            <Typography variant="body1" color="textSecondary">No hay mensajes aún. ¡Envía el primero!</Typography>
          </Box>
        ) : (
          <Box sx={{
            flexGrow: 1,
            overflowY: 'auto',
            p: 3,
            bgcolor: '#f8fbff',
            '&::-webkit-scrollbar': {
              width: '8px'
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: 'rgba(15,23,42,0.16)',
              borderRadius: 4
            },
            '&::-webkit-scrollbar-track': {
              bgcolor: 'transparent'
            }
          }}>
            {messages.map((msg, idx) => {
              const isOwn = msg.senderId === user?.uid;
              const previousSender = idx > 0 ? messages[idx - 1].senderId : null;
              const isSystem = msg.senderId === 'system' || (msg.senderName || '').toLowerCase().includes('sistema');
              const showAvatar = !isSystem && (idx === 0 || msg.senderId !== previousSender);
              const alignRight = isSystem ? 'center' : isOwn ? 'flex-end' : 'flex-start';
              const timestamp = formatTimestamp(msg.timestamp);

              return (
                <Box key={msg.id} sx={{ width: '100%' }}>
                  {/* fecha */}
                  {(!idx || (idx > 0 && !isSameDay(messages[idx - 1].timestamp, msg.timestamp))) && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 1.5 }}>
                      <Box sx={{ px: 2.5, py: 0.5, borderRadius: 99, bgcolor: '#e2e8f0', color: '#475569', fontSize: '0.75rem', fontWeight: 600 }}>
                        {getDayLabel(msg.timestamp)}
                      </Box>
                    </Box>
                  )}

                  <Box
                    onMouseEnter={() => setHoverReactionMessageId(msg.id)}
                    onMouseLeave={() => setHoverReactionMessageId(null)}
                    onClick={() => setActiveReactionMessageId((prev) => (prev === msg.id ? null : msg.id))}
                    sx={{ display: 'flex', flexDirection: 'column', alignItems: alignRight, mb: showAvatar ? 0.6 : 0.2, cursor: 'pointer' }}
                  >
                    {showAvatar && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.12, width: '100%', justifyContent: alignRight }}>
                        {!isOwn && (
                          <Avatar src={userProfiles[msg.senderId]?.avatar || undefined} sx={{ width: 34, height: 34 }}>
                            {!userProfiles[msg.senderId]?.avatar && (msg.senderName || '').charAt(0).toUpperCase()}
                          </Avatar>
                        )}
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{msg.senderName}</Typography>
                          <Typography variant="caption" color="textSecondary">{timestamp}</Typography>
                        </Box>
                        {isOwn && (
                          <Avatar src={user?.photoURL || undefined} sx={{ width: 34, height: 34 }}>
                            {!user?.photoURL && (user?.displayName || '').charAt(0).toUpperCase()}
                          </Avatar>
                        )}
                      </Box>
                    )}

                    <Box sx={{
                      width: 'fit-content',
                      minWidth: '22%',
                      maxWidth: '72%',
                      px: 2.3,
                      py: 1.25,
                      borderRadius: isOwn ? '22px 22px 5px 22px' : '22px 22px 22px 5px',
                      bgcolor: isOwn ? '#24a95a' : '#ffffff',
                      backgroundImage: isOwn ? 'linear-gradient(140deg, #34d399 0%, #22c55e 100%)' : 'none',
                      color: isOwn ? '#f8fafc' : '#0f172a',
                      position: 'relative',
                      overflow: 'visible',
                      boxShadow: isOwn ? '0 18px 28px rgba(34, 116, 64, 0.16)' : '0 10px 22px rgba(15, 23, 42, 0.08)',
                      border: isOwn ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(148,163,184,0.20)',
                      alignSelf: isOwn ? 'flex-end' : 'flex-start',
                      transition: 'transform 180ms ease, box-shadow 180ms ease, background-color 150ms ease',
                      zIndex: 1,
                      '&:hover': {
                        transform: 'translateY(-6px)',
                        boxShadow: isOwn ? '0 34px 50px rgba(34, 116, 64, 0.22)' : '0 20px 36px rgba(15, 23, 42, 0.16)'
                      }
                    }}>
                      {isOwn && (
                        <Tooltip title="Eliminar mensaje">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); handleRequestDeleteMessage(msg.id); }}
                            className="delete-button"
                            sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', opacity: hoverReactionMessageId === msg.id || activeReactionMessageId === msg.id ? 1 : 0, visibility: hoverReactionMessageId === msg.id || activeReactionMessageId === msg.id ? 'visible' : 'hidden', transition: 'opacity 150ms ease, visibility 150ms ease' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {msg.imageUrl && (
                        <Box component="img" src={msg.imageUrl} alt="Imagen adjunta" sx={{ width: '100%', maxWidth: 360, maxHeight: 420, borderRadius: 20, objectFit: 'cover', mb: msg.text ? 1.2 : 0 }} />
                      )}
                      {msg.text && (
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, letterSpacing: '0.01em' }}>{msg.text}</Typography>
                      )}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.2, alignItems: 'center' }}>
                        <Typography component="span" sx={{ fontSize: '0.72rem', color: isOwn ? 'rgba(248,250,252,0.84)' : 'rgba(15,23,42,0.68)' }}>{timestamp}</Typography>
                        {isOwn && <Typography component="span" sx={{ fontSize: '0.72rem', color: 'rgba(248,250,252,0.84)' }}>{msg.read ? '✓✓' : '✓'}</Typography>}
                      </Box>

                      {reactionOptions.map((option) => ({
                        ...option,
                        users: msg.reactions?.[option.key] || []
                      })).filter((option) => option.users.length > 0).length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.2 }}>
                          {reactionOptions.map((option) => {
                            const users = msg.reactions?.[option.key] || [];
                            if (!users.length) return null;
                            const names = users.map((uid) => {
                              if (uid === user?.uid) return 'Tú';
                              return userProfiles[uid]?.name || uid.substring(0, 6);
                            });
                            const tooltipTitle = names.length ? names.join(', ') : 'Sin reacciones';

                            return (
                              <Tooltip key={option.key} title={tooltipTitle} arrow>
                                <Box sx={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 0.35,
                                  px: 0.9,
                                  py: 0.45,
                                  borderRadius: 3,
                                  bgcolor: isOwn ? 'rgba(255,255,255,0.18)' : 'rgba(229,231,235,0.92)',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  color: isOwn ? '#fff' : '#0f172a',
                                  fontSize: '0.85rem'
                                }}>
                                  <Box component="span" sx={{ fontSize: '0.95rem' }}>{option.emoji}</Box>
                                  <Typography variant="caption" sx={{ fontWeight: 700 }}>{users.length}</Typography>
                                </Box>
                              </Tooltip>
                            );
                          })}
                        </Box>
                      )}
                    </Box>

                    {!isOwn && (
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.3 }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, opacity: hoverReactionMessageId === msg.id || activeReactionMessageId === msg.id ? 1 : 0, visibility: hoverReactionMessageId === msg.id || activeReactionMessageId === msg.id ? 'visible' : 'hidden', transition: 'opacity 180ms ease, visibility 180ms ease' }}>
                          {reactionOptions.map((option) => {
                            const users = msg.reactions?.[option.key] || [];
                            const selected = user?.uid ? users.includes(user.uid) : false;
                            const names = users.map((uid) => {
                              if (uid === user?.uid) return 'Tú';
                              return userProfiles[uid]?.name || uid.substring(0, 6);
                            });
                            const tooltipTitle = names.length ? names.join(', ') : 'Sin reacciones';

                            return (
                              <Tooltip key={option.key} title={tooltipTitle} arrow>
                                <span>
                                  <Button
                                    size="small"
                                    onClick={(e) => { e.stopPropagation(); handleToggleReaction(msg as any, option.key); }}
                                    sx={{
                                      textTransform: 'none',
                                      minWidth: 'auto',
                                      px: 0.6,
                                      py: 0.45,
                                      borderRadius: 3,
                                      fontSize: '0.85rem',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 0.25,
                                      border: '1px solid',
                                      borderColor: selected ? 'primary.main' : 'divider',
                                      bgcolor: selected ? 'primary.main' : 'rgba(255,255,255,0.92)',
                                      color: selected ? '#fff' : '#374151'
                                    }}
                                  >
                                    <Box component="span" sx={{ fontSize: '0.95rem', lineHeight: 1 }}>{option.emoji}</Box>
                                    {users.length > 0 && <Box component="span" sx={{ fontSize: '0.75rem', fontWeight: 600, ml: 0.4 }}>{users.length}</Box>}
                                  </Button>
                                </span>
                              </Tooltip>
                            );
                          })}
                        </Box>
                      </Box>
                    )}
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
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'center' }}>
          {quickReplies.map((reply) => (
            <Button
              key={reply}
              size="small"
              variant="outlined"
              onClick={() => handleQuickReply(reply)}
              sx={{
                textTransform: 'none',
                borderRadius: 20,
                px: 1.75,
                py: 0.65,
                bgcolor: '#eef2ff',
                color: '#1e3a8a',
                borderColor: 'transparent',
                '&:hover': {
                  bgcolor: '#e0e7ff'
                }
              }}
            >
              {reply}
            </Button>
          ))}
          <Button
            size="small"
            variant="outlined"
            onClick={handleToggleMoreQuickReplies}
            sx={{
              textTransform: 'none',
              borderRadius: 20,
              px: 1.75,
              py: 0.65,
              bgcolor: '#f8fafc',
              color: '#475569',
              borderColor: '#cbd5e1'
            }}
          >
            <AddIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
            Más
          </Button>
          {showMoreQuickReplies && moreQuickReplies.map((reply) => (
            <Button
              key={reply}
              size="small"
              variant="outlined"
              onClick={() => handleQuickReply(reply)}
              sx={{
                textTransform: 'none',
                borderRadius: 20,
                px: 1.75,
                py: 0.65,
                bgcolor: '#eef2ff',
                color: '#1e3a8a',
                borderColor: 'transparent',
                '&:hover': {
                  bgcolor: '#e0e7ff'
                }
              }}
            >
              {reply}
            </Button>
          ))}
        </Box>
        {audioPreview && (
          <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column', mb: 1.5, p: 1.5, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid #d1d5db' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Mensaje de voz</Typography>
              <IconButton size="small" onClick={handleCancelAudio} sx={{ color: '#64748b' }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
            <audio controls src={audioPreview} style={{ width: '100%', outline: 'none', borderRadius: 12 }} />
          </Box>
        )}
        {attachedImage && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5, p: 1.5, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid #d1d5db' }}>
            <Box component="img" src={imagePreview} alt="Vista previa" sx={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 2, border: '1px solid #cbd5e1' }} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{attachedImage.name}</Typography>
              <Typography variant="caption" color="textSecondary">{Math.round(attachedImage.size / 1024)} KB · Imagen adjunta</Typography>
            </Box>
            <IconButton size="small" onClick={handleRemoveImage} sx={{ color: '#64748b' }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <IconButton sx={{ color: '#64748b' }} type="button" onClick={handleOpenEmojiPicker}>
              <EmojiIcon />
            </IconButton>
            <Popover
              open={Boolean(emojiAnchorEl)}
              anchorEl={emojiAnchorEl}
              onClose={handleCloseEmojiPicker}
              anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              slotProps={{
                paper: {
                  sx: {
                    p: 1.25,
                    borderRadius: 3,
                    boxShadow: '0 18px 50px rgba(15, 23, 42, 0.12)'
                  }
                }
              }}
            >
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(34px, 1fr))', gap: 1 }}>
                {emojiOptions.map((emoji) => (
                  <IconButton
                    key={emoji}
                    onClick={() => handleSelectEmoji(emoji)}
                    sx={{ width: 36, height: 36, fontSize: '1.1rem', bgcolor: '#f8fafc', '&:hover': { bgcolor: '#eef2ff' } }}
                  >
                    {emoji}
                  </IconButton>
                ))}
              </Box>
            </Popover>
            <IconButton sx={{ color: '#64748b' }} component="label" type="button">
              <AttachIcon />
              <input
                hidden
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
            </IconButton>
            <IconButton
              sx={{ color: recording ? '#dc2626' : '#64748b' }}
              type="button"
              onClick={recording ? handleStopRecording : handleStartRecording}
            >
              <MicIcon />
            </IconButton>
          </Box>
          {recording && (
            <Typography variant="caption" sx={{ color: '#dc2626', ml: 1 }}>
              Grabando... pulsa el micrófono para detener
            </Typography>
          )}
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Escribe un mensaje..."
            multiline
            maxRows={6}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            // keep input enabled while sending so user can type another message
            disabled={false}
            sx={{
              bgcolor: '#ffffff',
              borderRadius: 2.5,
              border: '1px solid #cbd5e1',
              '& .MuiOutlinedInput-root': {
                borderRadius: 2.5,
                '& fieldset': {
                  borderColor: '#cbd5e1'
                },
                '&:hover fieldset': {
                  borderColor: '#93c5fd'
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#6366f1'
                }
              }
            }}
          />
          <IconButton
            onClick={() => handleSendMessage()}
            disabled={sending || (!newMessage.trim() && !attachedImage && !audioBlob) || uploadingImage || recording}
            color="primary"
            sx={{
              bgcolor: '#6366f1',
              color: '#ffffff',
              borderRadius: '18px',
              px: 1.5,
              py: 1.1,
              '&:hover': {
                bgcolor: '#4f46e5'
              }
            }}
          >
            {sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
          </IconButton>
        </Box>
      </Paper>

      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        aria-labelledby="delete-message-dialog-title"
      >
        <DialogTitle id="delete-message-dialog-title">Eliminar mensaje</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Estás seguro de que quieres eliminar este mensaje? Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>Cancelar</Button>
          <Button onClick={handleDeleteMessage} color="error" variant="contained">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar de error */}
      <Snackbar open={!!error} autoHideDuration={4000} onClose={() => setError('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
      </Snackbar>
    </Box>
  );
}