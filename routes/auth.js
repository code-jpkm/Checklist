// server/routes/auth.js
import express from 'express';
import { User } from '../models/User.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { signToken, authMiddleware } from '../middleware/auth.js';
import { sendWelcomeMessage, sendResetOtp } from '../services/notify.js';

const router = express.Router();

// -------- Register (optional – can also be done only via admin) --------
router.post('/register', async (req, res) => {
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

    // send welcome mail + whatsapp
    await sendWelcomeMessage({
      email: user.email,
      name: user.name,
      password: plainPassword,
      whatsapp: user.whatsappNumber,
      role: user.role,
    });

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

// -------- Login --------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: 'Invalid credentials' });
  const ok = await user.comparePassword(password);
  if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// -------- Who am I --------
router.get('/me', authMiddleware, (req, res) => {
  const u = req.user;
  res.json({
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department,
    whatsappNumber: u.whatsappNumber,
  });
});

// -------- Change password (logged-in user) --------
router.post('/change-password', authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: 'Both old and new password required' });
  }

  const user = req.user;
  const ok = await user.comparePassword(oldPassword);
  if (!ok) return res.status(400).json({ message: 'Old password is incorrect' });

  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();

  res.json({ message: 'Password updated successfully' });
});

// -------- Request password reset (OTP to email + WhatsApp) --------
router.post('/password-reset/request', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required' });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'User not found' });

  const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // invalidate any previous tokens for this email
  await PasswordResetToken.updateMany(
    { email, used: false },
    { used: true }
  );

  await PasswordResetToken.create({
    user: user._id,
    email,
    otp,
    expiresAt,
    used: false,
  });

  await sendResetOtp({
    email: user.email,
    name: user.name,
    otp,
    whatsapp: user.whatsappNumber,
  });

  res.json({ message: 'OTP sent to email and WhatsApp (if configured)' });
});

// -------- Verify OTP & set new password --------
router.post('/password-reset/verify', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: 'Email, OTP, newPassword required' });
  }

  const tokenDoc = await PasswordResetToken.findOne({
    email,
    otp,
    used: false,
  });

  if (!tokenDoc) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }

  if (tokenDoc.expiresAt < new Date()) {
    return res.status(400).json({ message: 'OTP expired' });
  }

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'User not found' });

  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();

  tokenDoc.used = true;
  await tokenDoc.save();

  res.json({ message: 'Password reset successfully' });
});

export default router;
