import { db } from '../firebase/config';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, onSnapshot } from 'firebase/firestore';

const tasksCollection = collection(db, 'tasks');

export const getTasks = async (projectId) => {
  const q = query(tasksCollection, where('projectId', '==', projectId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Subscribe to real-time updates for tasks in a project.
// Returns an unsubscribe function.
export const subscribeToTasks = (projectId, callback) => {
  const q = query(tasksCollection, where('projectId', '==', projectId));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(tasks);
  }, (err) => console.error('subscribeToTasks error', err));
  return unsubscribe;
};

export const createTask = async (taskData) => {
  const docRef = await addDoc(tasksCollection, {
    ...taskData,
    createdAt: new Date(),
    updatedAt: new Date(),
    commentsCount: taskData.commentsCount || 0,
    tags: taskData.tags || []
  });
  return { id: docRef.id, ...taskData };
};

export const updateTask = async (taskId, updatedData) => {
  const taskRef = doc(db, 'tasks', taskId);
  await updateDoc(taskRef, { ...updatedData, updatedAt: new Date() });
};

export const deleteTask = async (taskId) => {
  const taskRef = doc(db, 'tasks', taskId);
  await deleteDoc(taskRef);
};