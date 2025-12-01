import mongoose, { Schema, model, models, Model, Types, Document } from 'mongoose';

export type EventStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'FINALIZED';

export interface IEvent extends Document {
  requestId: string;
  txHash: string;
  eventName?: string;
  payload?: Record<string, unknown>;
  status: EventStatus;
  confirmations: number;
  nextRetryAt?: Date | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>({
  requestId: { type: String, required: true, index: true },
  txHash: { type: String, required: true, index: true },
  eventName: { type: String },
  payload: { type: Schema.Types.Mixed },
  status: { type: String, enum: ['PENDING', 'CONFIRMED', 'FAILED', 'FINALIZED'], default: 'PENDING' },
  confirmations: { type: Number, default: 0 },
  nextRetryAt: { type: Date, default: null },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

EventSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Event: Model<IEvent> = (models.Event as Model<IEvent>) || model<IEvent>('Event', EventSchema);
export default Event;
