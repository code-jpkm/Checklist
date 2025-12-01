import mongoose from 'mongoose';

const taskOccurrenceSchema = new mongoose.Schema(
  {
    template: { type: mongoose.Schema.Types.ObjectId, ref: 'TaskTemplate', required: true },
    doer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    status: {
      type: String,
      enum: ['PENDING', 'DONE', 'NOT_APPLICABLE', 'MISSED'],
      default: 'PENDING'
    },
    plannedTime: { type: String, default: '18:30' }, // 'HH:mm'
    actualTime: { type: Date },
    submittedVia: { type: String, enum: ['WEB', 'WHATSAPP', 'EMAIL', null], default: null },
    submissionToken: { type: String, required: true, unique: true }
  },
  { timestamps: true }
);

taskOccurrenceSchema.index({ doer: 1, date: 1 });

export const TaskOccurrence = mongoose.model('TaskOccurrence', taskOccurrenceSchema);
