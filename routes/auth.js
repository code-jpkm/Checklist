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
    if (existing) {
      return res.status(400).json({ message: 'Email exists' });
    }

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

    // Best-effort welcome notification – don't fail if this breaks
    try {
      await sendWelcomeMessage({
        email: user.email,
        name: user.name,
        password: plainPassword,
        whatsapp: user.whatsappNumber,
        role: user.role,
      });
    } catch (notifyErr) {
      console.error('Failed to send welcome message (self-register):', notifyErr);
    }

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({
      message: 'Error',
      error: err.message,
    });
  }
});

// -------- Login --------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        whatsappNumber: user.whatsappNumber,
      },
    });

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Login error", error: err.message });
  }
});

// -------- Login --------
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, department, whatsappNumber, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email exists' });
    }

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

    // Try to send welcome mail/WhatsApp, but don't break if it fails
    try {
      await sendWelcomeMessage({
        email: user.email,
        name: user.name,
        password: plainPassword,
        whatsapp: user.whatsappNumber,
        role: user.role,
      });
    } catch (notifyErr) {
      console.error('Failed to send welcome message (admin create user):', notifyErr);
      // Don't rethrow – user is already created and should stay created
    }

    const plain = user.toObject();
    delete plain.passwordHash;

    return res.json(plain);
  } catch (err) {
    console.error('Error creating user (admin):', err);
    return res.status(500).json({
      message: 'Error creating user',
      error: err.message,
    });
  }
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
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // invalidate previous tokens
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

    // Try to send OTP via email/WhatsApp – don't fail hard if this breaks
    try {
      await sendResetOtp({
        email: user.email,
        name: user.name,
        otp,
        whatsapp: user.whatsappNumber,
      });
    } catch (notifyErr) {
      console.error('Failed to send reset OTP:', notifyErr);
      // we still return success so the user can proceed with the OTP we generated
    }

    return res.json({
      message:
        'OTP generated; if email/WhatsApp is configured it will be sent.',
    });
  } catch (err) {
    console.error('Password reset request error:', err);
    return res.status(500).json({
      message: 'Error requesting password reset',
      error: err.message,
    });
  }
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
