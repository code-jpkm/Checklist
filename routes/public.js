import express from 'express';
import { submitByToken } from './tasks.js';

const router = express.Router();

// Email links land here
router.get('/email-submit', async (req, res) => {
  const token = req.query.t;
  const s = req.query.s;
  const status = s === 'done' ? 'DONE' : 'NOT_APPLICABLE';

  try {
    await submitByToken(token, status, 'EMAIL');
    res.send('Thank you, your task status is recorded.');
  } catch (err) {
    res.status(400).send('Unable to record status: ' + err.message);
  }
});

export default router;
