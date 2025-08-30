import mongoose from 'mongoose';
const { Schema } = mongoose;

const passwordResetSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
}, { timestamps: true });

// TTL cleanup at the "expiresAt" time
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PasswordReset', passwordResetSchema);
