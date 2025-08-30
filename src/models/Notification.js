import mongoose from 'mongoose';
const { Schema } = mongoose;


const notificationSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, default: 'general' },
    message: { type: String, required: true },
    read: { type: Boolean, default: false }
}, { timestamps: true });


export default mongoose.model('Notification', notificationSchema);