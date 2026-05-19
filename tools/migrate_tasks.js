/*
Safe Firestore task migration script
Usage:
  node migrate_tasks.js --serviceAccount ./serviceAccount.json --oldProjectId proyecto-ejemplo-id --newProjectId <UID> [--dry-run]

This script will find documents in collection `tasks` with field `projectId` === oldProjectId and update them to set:
  - originalProjectId: <oldProjectId> (keeps original value)
  - projectId: <newProjectId>
  - migratedAt: <timestamp>
It supports --dry-run to only print what it would change.

IMPORTANT: Provide a Firebase Admin service account JSON with proper privileges. The script will NOT delete any data.
*/

const admin = require('firebase-admin');
const fs = require('fs');
const { program } = require('commander');

program
  .requiredOption('--serviceAccount <path>', 'Path to Firebase service account JSON')
  .option('--oldProjectId <id>', 'Old projectId to replace')
  .option('--newProjectId <id>', 'New projectId (e.g. user uid)')
  .option('--map <path>', 'Path to JSON file with mapping of old->new projectIds')
  .option('--dry-run', 'Do not perform writes, only print changes')
  .option('--limit <n>', 'Limit number of documents to process per mapping', parseInt)
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

async function migrate() {
    const { oldProjectId, newProjectId, map, dryRun, limit } = opts;
    console.log('Starting migration');
    console.log('Dry run:', Boolean(dryRun));
    if (limit) console.log('Limit per mapping:', limit);

    let mappings = {};
    if (map) {
      if (!fs.existsSync(map)) {
        console.error('Mapping file not found:', map);
        process.exit(1);
      }
      try {
        const raw = fs.readFileSync(map, 'utf8');
        mappings = JSON.parse(raw);
      } catch (err) {
        console.error('Failed to read/parse map file:', err);
        process.exit(1);
      }
      console.log('Loaded mapping file with', Object.keys(mappings).length, 'entries');
    } else if (oldProjectId && newProjectId) {
      mappings[oldProjectId] = newProjectId;
    } else {
      console.error('You must provide either --oldProjectId and --newProjectId, or --map <file>');
      process.exit(1);
    }

    let totalProcessed = 0;
    for (const [oldId, newId] of Object.entries(mappings)) {
      console.log(`\nProcessing mapping: "${oldId}" -> "${newId}"`);
      let q = db.collection('tasks').where('projectId', '==', oldId);
      if (limit) q = q.limit(limit);
      const snapshot = await q.get();
      console.log('Found', snapshot.size, 'documents to inspect.');
      if (snapshot.empty) {
        console.log('No documents to migrate for this mapping.');
        continue;
      }

      let count = 0;
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const id = doc.id;
        const original = data.projectId;
        const update = {
          originalProjectId: original,
          projectId: newId,
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        console.log(`- Doc ${id}: projectId "${original}" -> "${newId}"`);
        if (!dryRun) {
          await doc.ref.update(update);
          console.log('  updated');
        } else {
          console.log('  dry-run: not updated');
        }
        count++;
      }
      console.log('Mapping processed. Documents processed for this mapping:', count);
      totalProcessed += count;
    }

    console.log('\nMigration complete. Total documents processed:', totalProcessed);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
