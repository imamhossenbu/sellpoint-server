import mongoose from 'mongoose';
const { Schema } = mongoose;

const subscriberSchema = new Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    status: { type: String, enum: ['subscribed', 'unsubscribed'], default: 'subscribed' },
    unsubToken: { type: String, index: true }, // for one-click unsubscribe links
}, { timestamps: true });

export default mongoose.model('Subscriber', subscriberSchema);
