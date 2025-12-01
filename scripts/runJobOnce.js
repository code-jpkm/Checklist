// server/scripts/runJobsOnce.js

// Load environment variables (.env)
import '../config/env.js';

// Connect to MongoDB
import { connectDb } from '../config/db.js';

// Cron job logic (generate tasks, close tasks, cleanup tokens)
import {
  generateOccurrencesForToday,
  closeExpiredTasks,
  cleanupResetTokens,
} from '../services/scheduler.js';

// IMPORTANT: register the User model so populate('doer') works
import '../models/User.js';

const run = async () => {
  try {
    // 1) connect to DB
    await connectDb();

    // 2) run the same jobs that cron would run
    console.log('Running: generateOccurrencesForToday...');
    await generateOccurrencesForToday();

    console.log('Running: closeExpiredTasks...');
    await closeExpiredTasks();

    console.log('Running: cleanupResetTokens...');
    await cleanupResetTokens();

    console.log('✅ All jobs completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error running jobs:', err);
    process.exit(1);
  }
};

run();
