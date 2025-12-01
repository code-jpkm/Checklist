import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true}, // 'YYYY-MM-DD'
    description: String
  },
  { timestamps: true }
);

export const Holiday = mongoose.model('Holiday', holidaySchema);
