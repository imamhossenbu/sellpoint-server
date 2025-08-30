import mongoose from 'mongoose';
const { Schema } = mongoose;

const attachmentSchema = new Schema({
    url: String,
    publicId: String,
    format: String,
    bytes: Number,
    width: Number,
    height: Number,
    originalFilename: String,
    resourceType: String,
}, { _id: false });

const messageSchema = new Schema({
    authorType: { type: String, enum: ['seller', 'admin'], required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User' }, // admin id for admin, seller id for seller
    body: { type: String, trim: true },
    attachments: [attachmentSchema],
}, { timestamps: true });

const ticketSchema = new Schema({
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true, trim: true },
    category: { type: String, enum: ['general', 'listing', 'payment', 'bug', 'account'], default: 'general' },
    status: { type: String, enum: ['open', 'pending', 'resolved', 'closed'], default: 'open' },
    messages: [messageSchema], // first message at creation
}, { timestamps: true });

ticketSchema.index({ seller: 1, status: 1, createdAt: -1 });
ticketSchema.index({ subject: 'text' });

export default mongoose.model('SupportTicket', ticketSchema);
