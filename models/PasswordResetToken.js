// server/models/PasswordResetToken.js
import mongoose from 'mongoose';

const passwordResetTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true },
    otp: { type: String, required: true }, // 6-digit
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

passwordResetTokenSchema.index({ email: 1, otp: 1 });
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 }); // auto-remove after 1 day

export const PasswordResetToken = mongoose.model(
  'PasswordResetToken',
  passwordResetTokenSchema
);
