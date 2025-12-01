import mongoose from 'mongoose';

const taskTemplateSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    doer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    department: String,
    frequency: {
      type: String,
      enum: ['D', 'W', 'M', 'Y', 'Q', 'F', 'E1st', 'E2nd', 'E3rd', 'E4th', 'ELast'],
      required: true
    },
    // For W: 0=Sun..6=Sat (we'll use Mon-Sat only)
    dayOfWeek: { type: Number },
    // For some patterns
    dayOfMonth: { type: Number },
    startDate: { type: Date, default: () => new Date() },
    active: { type: Boolean, default: true },
    timeDue: { type: String, default: '18:30' } // HH:mm
  },
  { timestamps: true }
);

export const TaskTemplate = mongoose.model('TaskTemplate', taskTemplateSchema);
