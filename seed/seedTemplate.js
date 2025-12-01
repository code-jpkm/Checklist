import { connectDb } from '../config/db.js';
import { User } from '../models/User.js';
import { TaskTemplate } from '../models/TaskTemplate.js';

const templates = [
  // Example; replace with your real data
  {
    title: 'FOLLOW-UP STORE IMS V.3',
    email: 'aindrila@example.com',
    department: 'PROCESS COORDINATOR',
    frequency: 'D'
  },
  {
    title: 'FOLLOW-UP FACTORY/OFFICE WEEKLY SCHEDULER(EVERY MONDAY)',
    email: 'aindrila@example.com',
    department: 'PROCESS COORDINATOR',
    frequency: 'W',
    dayOfWeek: 1
  }
];

const run = async () => {
  await connectDb();
  for (const t of templates) {
    const user = await User.findOne({ email: t.email });
    if (!user) {
      console.log(`User not found for template ${t.title}`);
      continue;
    }
    await TaskTemplate.create({
      title: t.title,
      doer: user._id,
      department: t.department,
      frequency: t.frequency,
      dayOfWeek: t.dayOfWeek,
      startDate: new Date()
    });
    console.log('Created template:', t.title);
  }
  process.exit(0);
};

run();
