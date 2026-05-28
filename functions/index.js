const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

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

exports.sendInvitationEmail = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Only POST requests are allowed.');
  }

  const { recipientEmail, projectName, invitationLink, senderName } = req.body || {};
  if (!recipientEmail || !projectName || !invitationLink || !senderName) {
    return res.status(400).send('recipientEmail, projectName, invitationLink and senderName are required.');
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM || `Task Core <no-reply@taskcore.example.com>`,
      to: recipientEmail,
      subject: `Invitación a ${projectName}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #111;">
          <h2>Has recibido una invitación para un proyecto</h2>
          <p>Hola,</p>
          <p><strong>${senderName}</strong> te ha invitado a unirte al proyecto <strong>${projectName}</strong>.</p>
          <p>Haz clic en el siguiente enlace para aceptar la invitación:</p>
          <p><a href="${invitationLink}" target="_blank">Aceptar invitación</a></p>
          <p>Si no solicitaste esta invitación, puedes ignorar este correo.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return res.status(200).send('Invitation email sent successfully.');
  } catch (error) {
    console.error('Error sending invitation email:', error);
    return res.status(500).send(`Failed to send invitation email: ${error.message || error}`);
  }
});
