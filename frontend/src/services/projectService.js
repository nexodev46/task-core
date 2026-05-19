import { db } from '../firebase/config';
import { collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// Crear un nuevo proyecto (automáticamente añade al creador como admin)
export const createProject = async (name, ownerId) => {
  const projectRef = await addDoc(collection(db, 'projects'), {
    name,
    ownerId,
    createdAt: new Date()
  });
  // Añadir al creador como miembro (rol admin)
  await addDoc(collection(db, 'projectMembers'), {
    projectId: projectRef.id,
    userId: ownerId,
    role: 'admin',
    joinedAt: new Date()
  });
  return projectRef.id;
};

// Obtener todos los proyectos donde el usuario es miembro
export const getUserProjects = async (userId) => {
  const membersQuery = query(collection(db, 'projectMembers'), where('userId', '==', userId));
  const membersSnap = await getDocs(membersQuery);
  const projectIds = membersSnap.docs.map(doc => doc.data().projectId);
  const projects = [];
  for (const id of projectIds) {
    const projDoc = await getDoc(doc(db, 'projects', id));
    if (projDoc.exists()) projects.push({ id: projDoc.id, ...projDoc.data() });
  }
  return projects;
};

// Obtener miembros de un proyecto
export const getProjectMembers = async (projectId) => {
  const membersQuery = query(collection(db, 'projectMembers'), where('projectId', '==', projectId));
  const snap = await getDocs(membersQuery);
  const members = [];
  for (const memberDoc of snap.docs) {
    const userDoc = await getDoc(doc(db, 'users', memberDoc.data().userId));
    if (userDoc.exists()) {
      members.push({
        userId: memberDoc.data().userId,
        role: memberDoc.data().role,
        email: userDoc.data().email,
        fullName: userDoc.data().fullName
      });
    }
  }
  return members;
};

export const deleteProject = async (projectId) => {
  const projectRef = doc(db, 'projects', projectId);
  await deleteDoc(projectRef);

  const memberQuery = query(collection(db, 'projectMembers'), where('projectId', '==', projectId));
  const memberSnap = await getDocs(memberQuery);
  for (const memberDoc of memberSnap.docs) {
    await deleteDoc(doc(db, 'projectMembers', memberDoc.id));
  }

  const taskQuery = query(collection(db, 'tasks'), where('projectId', '==', projectId));
  const taskSnap = await getDocs(taskQuery);
  for (const taskDoc of taskSnap.docs) {
    await deleteDoc(doc(db, 'tasks', taskDoc.id));
  }
};