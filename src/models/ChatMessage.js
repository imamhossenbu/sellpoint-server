import mongoose from 'mongoose';
const { Schema } = mongoose;

const chatMessageSchema = new Schema(
    {
        listing: { type: Schema.Types.ObjectId, ref: 'Listing', index: true },
        from: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        to: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        text: { type: String, trim: true, maxlength: 2000 },
        replyTo: { type: Schema.Types.ObjectId, ref: 'ChatMessage', default: null },
        readAt: { type: Date },
        editedAt: { type: Date },
    },
    { timestamps: true }
);

export default mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);
