import { db } from '../firebase/config';
import { collection, addDoc, query, where, getDocs, orderBy, limit, updateDoc, doc } from 'firebase/firestore';

// Guardar una actividad (extras permitidos en payload)
export const addActivity = async (userId, action, taskTitle, extras = {}) => {
  await addDoc(collection(db, 'activities'), {
    userId,
    action,
    taskTitle,
    timestamp: new Date(),
    read: false,
    ...extras
  });
};

// Obtener actividades de un usuario (máximo 10, ordenadas por fecha)
export const getActivities = async (userId) => {
  const q = query(
    collection(db, 'activities'),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(10)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Marcar una actividad como leída
export const markAsRead = async (activityId) => {
  const ref = doc(db, 'activities', activityId);
  await updateDoc(ref, { read: true });
};

// Eliminar una actividad
export const deleteActivity = async (activityId) => {
  const ref = doc(db, 'activities', activityId);
  await import('firebase/firestore').then(({ deleteDoc }) => deleteDoc(ref));
};