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
  if (projectIds.length === 0) return [];

  const projects = await Promise.all(
    projectIds.map(async (id) => {
      const projDoc = await getDoc(doc(db, 'projects', id));
      return projDoc.exists() ? { id: projDoc.id, ...projDoc.data() } : null;
    })
  );

  return projects.filter(Boolean);
};

// Obtener miembros de un proyecto
export const getProjectMembers = async (projectId) => {
  const membersQuery = query(collection(db, 'projectMembers'), where('projectId', '==', projectId));
  const snap = await getDocs(membersQuery);
  const memberMap = new Map();

  for (const memberDoc of snap.docs) {
    const data = memberDoc.data();
    const userId = data.userId;
    if (memberMap.has(userId)) continue;

    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      memberMap.set(userId, {
        userId,
        role: data.role,
        email: userDoc.data().email,
        fullName: userDoc.data().fullName
      });
    }
  }

  return Array.from(memberMap.values());
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

export const updateProjectName = async (projectId, name) => {
  const projectRef = doc(db, 'projects', projectId);
  await updateDoc(projectRef, { name });
};

// Remover un miembro del proyecto
export const removeProjectMember = async (projectId, userId) => {
  const memberQuery = query(collection(db, 'projectMembers'), where('projectId', '==', projectId), where('userId', '==', userId));
  const snap = await getDocs(memberQuery);
  for (const memberDoc of snap.docs) {
    await deleteDoc(doc(db, 'projectMembers', memberDoc.id));
  }
};