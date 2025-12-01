// server/routes/admin.js
import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { TaskTemplate } from '../models/TaskTemplate.js';
import { TaskOccurrence } from '../models/TaskOccurrence.js';
import { Holiday } from '../models/Holiday.js';
import { sendWelcomeMessage } from '../services/notify.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// all routes here require admin
router.use(authMiddleware, adminMiddleware);

/* ========= USERS CRUD ========= */

// list users
router.get('/users', async (req, res) => {
  const users = await User.find({}, '-passwordHash').sort({ createdAt: -1 });
  res.json(users);
});

// create user (send welcome email + WhatsApp)
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, department, whatsappNumber, role } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email exists' });

    const plainPassword = password || '123456';
    const passwordHash = await User.hashPassword(plainPassword);

    const user = await User.create({
      name,
      email,
      passwordHash,
      department,
      whatsappNumber,
      role: role === 'ADMIN' ? 'ADMIN' : 'USER',
    });

    await sendWelcomeMessage({
      email: user.email,
      name: user.name,
      password: plainPassword,
      whatsapp: user.whatsappNumber,
      role: user.role,
    });

    const plain = user.toObject();
    delete plain.passwordHash;
    res.json(plain);
  } catch (err) {
    console.log(err)
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

// update user
router.put('/users/:id', async (req, res) => {
  try {
    const { name, email, password, department, whatsappNumber, role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.name = name ?? user.name;
    user.email = email ?? user.email;
    user.department = department ?? user.department;
    user.whatsappNumber = whatsappNumber ?? user.whatsappNumber;
    if (role) user.role = role === 'ADMIN' ? 'ADMIN' : 'USER';
    if (password) {
      user.passwordHash = await User.hashPassword(password);
    }

    await user.save();

    const plain = user.toObject();
    delete plain.passwordHash;
    res.json(plain);
  } catch (err) {
    res.status(500).json({ message: err.message, error: err.message });
  }
});

// delete user
router.delete('/users/:id', async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

/* ========= TASK TEMPLATES CRUD + SEARCH/PAGINATION + EXCEL IMPORT ========= */

// list templates with pagination & search
router.get('/templates', async (req, res) => {
  const { userId, search } = req.query;
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '10', 10);

  const filter = {};
  if (userId) filter.doer = userId;
  if (search) {
    filter.title = { $regex: search, $options: 'i' };
  }

  const total = await TaskTemplate.countDocuments(filter);
  const items = await TaskTemplate.find(filter)
    .populate('doer')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.json({
    items,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

// create template
router.post('/templates', async (req, res) => {
  try {
    const {
      title,
      doerId,
      department,
      frequency,
      dayOfWeek,
      dayOfMonth,
      startDate,
      active,
      timeDue,
    } = req.body;

    const t = await TaskTemplate.create({
      title,
      doer: doerId,
      department,
      frequency,
      dayOfWeek: dayOfWeek ?? null,
      dayOfMonth: dayOfMonth ?? null,
      startDate: startDate ? new Date(startDate) : new Date(),
      active: active !== undefined ? active : true,
      timeDue: timeDue || '18:30',
    });

    const populated = await TaskTemplate.findById(t._id).populate('doer');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

// update template
router.put('/templates/:id', async (req, res) => {
  try {
    const {
      title,
      doerId,
      department,
      frequency,
      dayOfWeek,
      dayOfMonth,
      startDate,
      active,
      timeDue,
    } = req.body;

    const t = await TaskTemplate.findById(req.params.id);
    if (!t) return res.status(404).json({ message: 'Not found' });

    if (title !== undefined) t.title = title;
    if (doerId !== undefined) t.doer = doerId;
    if (department !== undefined) t.department = department;
    if (frequency !== undefined) t.frequency = frequency;
    if (dayOfWeek !== undefined) t.dayOfWeek = dayOfWeek;
    if (dayOfMonth !== undefined) t.dayOfMonth = dayOfMonth;
    if (startDate !== undefined) t.startDate = new Date(startDate);
    if (active !== undefined) t.active = active;
    if (timeDue !== undefined) t.timeDue = timeDue;

    await t.save();
    const populated = await TaskTemplate.findById(t._id).populate('doer');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

// delete template
router.delete('/templates/:id', async (req, res) => {
  await TaskTemplate.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

/**
 * Import templates from Excel file.
 * Expected columns (header row) – case-insensitive:
 *   Title, DoerEmail, Department, Frequency, DayOfWeek, DayOfMonth, StartDate, TimeDue, Active
 * Frequency can be words like "Daily", "Weekly", "Monthly" – will be mapped.
 */
function mapFrequency(raw) {
  if (!raw) return 'D';
  const v = String(raw).trim().toLowerCase();
  if (['d', 'daily', 'everyday', 'every day'].includes(v)) return 'D';
  if (['w', 'weekly', 'week'].includes(v)) return 'W';
  if (['m', 'monthly', 'month'].includes(v)) return 'M';
  if (['f', 'fortnight', 'fortnightly', '15d'].includes(v)) return 'F';
  if (['q', 'quarterly', 'quarter'].includes(v)) return 'Q';
  if (['y', 'yearly', 'annual', 'annually'].includes(v)) return 'Y';
  if (['e1', 'e1st', '1st working', 'first working'].includes(v)) return 'E1st';
  if (['e2', 'e2nd', '2nd working', 'second working'].includes(v)) return 'E2nd';
  if (['e3', 'e3rd', '3rd working', 'third working'].includes(v)) return 'E3rd';
  if (['e4', 'e4th', '4th working', 'fourth working'].includes(v)) return 'E4th';
  if (['elast', 'last working', 'e-last'].includes(v)) return 'ELast';
  // fallback to code itself if it's valid
  const upper = raw.toString().toUpperCase();
  const allowed = ['D','W','M','F','Q','Y','E1ST','E2ND','E3RD','E4TH','ELAST'];
  if (allowed.includes(upper)) return upper.replace('E1ST','E1st').replace('E2ND','E2nd')
    .replace('E3RD','E3rd').replace('E4TH','E4th');
  return 'D';
}

router.post(
  '/templates/import-excel',
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(worksheet);

      const created = [];
      const skipped = [];

      for (const row of rows) {
        const title = row.Title || row.title;
        const email = row.DoerEmail || row.email || row.Doer || row.User;
        if (!title || !email) {
          skipped.push({ row, reason: 'Missing title or email' });
          continue;
        }

        const user = await User.findOne({ email });
        if (!user) {
          skipped.push({ row, reason: `User not found for email ${email}` });
          continue;
        }

        const frequency = mapFrequency(row.Frequency || row.frequency || 'D');
        const dayOfWeek =
          row.DayOfWeek !== undefined && row.DayOfWeek !== null
            ? Number(row.DayOfWeek)
            : undefined;
        const dayOfMonth =
          row.DayOfMonth !== undefined && row.DayOfMonth !== null
            ? Number(row.DayOfMonth)
            : undefined;

        const startDate = row.StartDate ? new Date(row.StartDate) : new Date();
        const timeDue = row.TimeDue || '18:30';
        const active =
          row.Active === undefined || row.Active === null
            ? true
            : row.Active === true ||
              row.Active === 'true' ||
              row.Active === 'YES' ||
              row.Active === 'Yes';

        const t = await TaskTemplate.create({
          title,
          doer: user._id,
          department: row.Department || row.department || '',
          frequency,
          dayOfWeek,
          dayOfMonth,
          startDate,
          timeDue,
          active,
        });

        created.push(t);
      }

      res.json({
        created: created.length,
        skippedCount: skipped.length,
      });
    } catch (err) {
      console.error('Excel import error', err);
      res.status(500).json({ message: 'Import failed', error: err.message });
    }
  }
);

/* ========= MONITOR TASK OCCURRENCES (supports date range) ========= */

router.get('/occurrences', async (req, res) => {
  const { date, userId, status, from, to } = req.query;
  const filter = {};

  if (from && to) {
    filter.date = { $gte: from, $lte: to };
  } else if (date) {
    filter.date = date;
  }

  if (userId) filter.doer = userId;
  if (status) filter.status = status;

  const list = await TaskOccurrence.find(filter)
    .populate('doer template')
    .sort({ date: 1, createdAt: -1 });

  res.json(list);
});

/* ========= HOLIDAYS CRUD ========= */

router.get('/holidays', async (req, res) => {
  const holidays = await Holiday.find({}).sort({ date: 1 });
  res.json(holidays);
});

router.post('/holidays', async (req, res) => {
  try {
    const { date, description } = req.body;
    if (!date) return res.status(400).json({ message: 'date is required' });

    const existing = await Holiday.findOne({ date });
    if (existing) {
      existing.description = description || existing.description;
      await existing.save();
      return res.json(existing);
    }

    const h = await Holiday.create({ date, description });
    res.json(h);
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

router.delete('/holidays/:id', async (req, res) => {
  await Holiday.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

export default router;
