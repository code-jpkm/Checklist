// server/routes/tasks.js
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { TaskOccurrence } from '../models/TaskOccurrence.js';
import { getCutoffDateTime, getTodayDateString } from '../utils/dates.js';

const router = express.Router();

router.get('/today', authMiddleware, async (req, res) => {
  const todayStr = getTodayDateString();

  const tasks = await TaskOccurrence.find({
    doer: req.user._id,
    date: todayStr,
  }).populate('template');

  res.json(tasks);
});

router.get('/by-date/:date', authMiddleware, async (req, res) => {
  const dateStr = req.params.date;

  const tasks = await TaskOccurrence.find({
    doer: req.user._id,
    date: dateStr,
  }).populate('template');

  res.json(tasks);
});

router.post('/:id/submit', authMiddleware, async (req, res) => {
  const { status } = req.body;

  if (!['DONE', 'NOT_APPLICABLE'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const task = await TaskOccurrence.findById(req.params.id).populate('template');
  if (!task) return res.status(404).json({ message: 'Not found' });

  if (!task.doer.equals(req.user._id)) {
    return res.status(403).json({ message: 'Not yours' });
  }

  const cutoff = getCutoffDateTime(task.date);
  if (new Date() > cutoff) {
    return res.status(400).json({ message: 'Cutoff time passed' });
  }

  task.status = status;
  task.actualTime = new Date();
  task.submittedVia = 'WEB';
  await task.save();

  res.json(task);
});

export const submitByToken = async (token, status, via) => {
  const task = await TaskOccurrence.findOne({ submissionToken: token }).populate('template');
  if (!task) throw new Error('Invalid token');

  const cutoff = getCutoffDateTime(task.date);
  if (new Date() > cutoff) throw new Error('Cutoff passed');

  task.status = status;
  task.actualTime = new Date();
  task.submittedVia = via;
  await task.save();
};

export default router;