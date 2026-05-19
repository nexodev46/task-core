/*
Safe Firestore task revert script
Reverts tasks that were migrated (have originalProjectId field) back to their original projectId.

Usage:
  node revert_tasks.js --serviceAccount ./serviceAccount.json [--limit <n>] [--dry-run]

This script will find documents in collection `tasks` that have field `originalProjectId` and:
  - Set projectId back to originalProjectId value
  - Keep migratedAt as audit trail
  - Remove originalProjectId field

IMPORTANT: This only reverts documents that were previously migrated. Documents without
originalProjectId will be skipped. The script is SAFE and will not delete any data.
*/

const admin = require('firebase-admin');
const fs = require('fs');
const { program } = require('commander');

program
  .requiredOption('--serviceAccount <path>', 'Path to Firebase service account JSON')
  .option('--dry-run', 'Do not perform writes, only print changes (default: true)')
  .option('--limit <n>', 'Limit number of documents to process', parseInt)
  .parse(process.argv);

const opts = program.opts();

if (!fs.existsSync(opts.serviceAccount)) {
  console.error('Service account file not found:', opts.serviceAccount);
  process.exit(1);
}

const serviceAccount = require(opts.serviceAccount);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function revert() {
  const { dryRun = true, limit } = opts;
  console.log('Starting revert');
  console.log('Dry run:', Boolean(dryRun));
  if (limit) console.log('Limit:', limit);

  // Query for documents that have originalProjectId (i.e., were migrated)
  let q = db.collection('tasks').where('originalProjectId', '!=', '');
  if (limit) q = q.limit(limit);

  const snapshot = await q.get();
  console.log('Found', snapshot.size, 'documents to inspect.');
  if (snapshot.empty) {
    console.log('No migrated documents to revert. Exiting.');
    return;
  }

  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const id = doc.id;
    const originalProjectId = data.originalProjectId;
    const currentProjectId = data.projectId;

    if (!originalProjectId) {
      console.log(`- Doc ${id}: skipped (no originalProjectId field)`);
      continue;
    }

    const update = {
      projectId: originalProjectId,
      originalProjectId: admin.firestore.FieldValue.delete(), // Remove originalProjectId
      revertedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    console.log(`- Doc ${id}: projectId "${currentProjectId}" -> "${originalProjectId}" (revert)`);
    if (!dryRun) {
      await doc.ref.update(update);
      console.log('  reverted');
    } else {
      console.log('  dry-run: not reverted');
    }
    count++;
  }

  console.log('Revert complete. Documents processed:', count);
}

revert().catch(err => {
  console.error('Revert failed:', err);
  process.exit(1);
});
