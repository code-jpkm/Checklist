import express from 'express';
import { submitByToken } from './tasks.js';

const router = express.Router();

// Maytapi webhook
router.post('/whatsapp', async (req, res) => {
  try {
    const body = req.body;
    const text = body?.message?.text?.body || body?.message?.text || '';
    if (!text) return res.sendStatus(200);

    const parts = text.trim().split(/\s+/);
    if (parts.length < 2) return res.sendStatus(200);

    const code = parts[0];
    const token = parts[1];

    let status = null;
    if (code === '1') status = 'DONE';
    if (code === '2') status = 'NOT_APPLICABLE';

    if (!status) return res.sendStatus(200);

    await submitByToken(token, status, 'WHATSAPP');
    res.sendStatus(200);
  } catch (err) {
    console.error('WhatsApp webhook error', err.message);
    res.sendStatus(200);
  }
});

export default router;
