import { db } from '../firebase/config';
import { collection, addDoc, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { addActivity } from './activityService';

// Validar que el email existe en la colección users
export const validateEmailExists = async (email) => {
  try {
    const normalized = String(email || '').trim().toLowerCase();
    const userQ = query(collection(db, 'users'), where('email', '==', normalized));
    const userSnap = await getDocs(userQ);
    if (userSnap.empty) return null;
    return userSnap.docs[0].id; // devuelve el userId
  } catch (err) {
    console.error('Error validando email:', err);
    throw new Error('Error validando email');
  }
};

// Enviar email vía Cloud Function
export const sendInvitationEmail = async (email, projectName, invitationLink, senderName) => {
  try {
    const response = await fetch('https://us-central1-tu-proyecto.cloudfunctions.net/sendInvitationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientEmail: email,
        projectName,
        invitationLink,
        senderName
      })
    });
    if (!response.ok) {
      console.warn('Error enviando email:', await response.text());
    }
  } catch (err) {
    // Non-fatal: email sending failed, but invitation was created
    console.warn('Error enviando email de invitación:', err);
  }
};

// Crear una invitación (guarda en Firestore)
export const createInvitation = async (email, projectId, invitedBy, projectName = 'Proyecto', senderName = 'Usuario') => {
  // Validar que el email existe
  const invitedUserId = await validateEmailExists(email);
  if (!invitedUserId) {
    throw new Error(`El email ${email} no está registrado en Task Core. Debe registrarse primero.`);
  }

  const token = crypto.randomUUID();
  const docRef = await addDoc(collection(db, 'invitations'), {
    email,
    projectId,
    token,
    status: 'pending',
    invitedBy,
    createdAt: new Date()
  });

  // Enviar email de invitación
  const invitationLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/accept-invite/${token}`;
  await sendInvitationEmail(email, projectName, invitationLink, senderName);

  // Crear actividad/notificación en la app
  try {
    await addActivity(invitedUserId, 'project_invitation', `Has sido invitado a "${projectName}"`, { 
      projectId, 
      invitationId: docRef.id, 
      token 
    });
  } catch (err) {
    console.error('Error creando actividad de invitación:', err);
  }

  return { id: docRef.id, token };
};

// Obtener invitación por token (solo pendientes)
export const getInvitationByToken = async (token) => {
  const q = query(collection(db, 'invitations'), where('token', '==', token), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
};

// Aceptar invitación: cambiar estado y agregar miembro
export const acceptInvitation = async (invitationId, projectId, userId) => {
  // 1. Marcar invitación como aceptada
  await updateDoc(doc(db, 'invitations', invitationId), { status: 'accepted' });
  // 2. Añadir al usuario como miembro (rol member)
  await addDoc(collection(db, 'projectMembers'), {
    projectId,
    userId,
    role: 'member',
    joinedAt: new Date()
  });
};