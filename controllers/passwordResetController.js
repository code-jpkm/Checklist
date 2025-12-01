import { User } from '../models/User.js';
import crypto from 'crypto';
import { sendResetOtp } from '../services/notify.js';

let otpStore = {}; // in-memory store; consider DB later

export const requestReset = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  const otp = ("000000" + Math.floor(Math.random() * 999999)).slice(-6);
  otpStore[email] = { otp, expires: Date.now() + 10 * 60 * 1000 }; // 10 mins

  await sendResetOtp(email, user.name, otp, user.whatsappNumber);

  res.json({ message: "OTP sent" });
};

export const verifyReset = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const record = otpStore[email];
  if (!record) return res.status(400).json({ message: "No OTP requested" });

  if (record.expires < Date.now())
    return res.status(400).json({ message: "OTP expired" });

  if (record.otp !== otp)
    return res.status(400).json({ message: "Invalid OTP" });

  const user = await User.findOne({ email });
  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();

  delete otpStore[email];
  res.json({ message: "Password updated successfully" });
};
