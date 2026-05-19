const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const DUE_SOON_HOURS = parseInt(process.env.DUE_SOON_HOURS || '24', 10);

// Helper: check if activity exists for task/action in last N days
async function hasRecentActivity(taskId, action, days = 7) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const q = db.collection('activities')
    .where('taskId', '==', taskId)
    .where('action', '==', action)
    .where('timestamp', '>=', admin.firestore.Timestamp.fromMillis(since))
    .limit(1);
  const snap = await q.get();
  return !snap.empty;
}

exports.checkTaskDueDates = functions.pubsub.schedule('every 15 minutes').onRun(async (context) => {
  const now = new Date();
  const snapshot = await db.collection('tasks').get();
  const tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  const dueSoonMs = DUE_SOON_HOURS * 60 * 60 * 1000;

  for (const task of tasks) {
    try {
      if (!task.dueDate) continue;
      const due = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
      const diff = due.getTime() - now.getTime();

      if (diff < 0) {
        // overdue
        const exists = await hasRecentActivity(task.id, 'overdue', 30);
        if (!exists) {
          await db.collection('activities').add({
            userId: task.projectId || task.ownerId || 'system',
            action: 'overdue',
            taskTitle: task.title || 'Tarea',
            taskId: task.id,
            timestamp: admin.firestore.Timestamp.now(),
            read: false
          });
        }
      } else if (diff <= dueSoonMs) {
        const exists = await hasRecentActivity(task.id, 'due_soon', 7);
        if (!exists) {
          await db.collection('activities').add({
            userId: task.projectId || task.ownerId || 'system',
            action: 'due_soon',
            taskTitle: task.title || 'Tarea',
            taskId: task.id,
            timestamp: admin.firestore.Timestamp.now(),
            read: false
          });
        }
      }
    } catch (err) {
      console.error('Error checking task', task.id, err);
    }
  }

  return null;
});
