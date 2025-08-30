import mongoose from 'mongoose';
const { Schema } = mongoose;


const txnSchema = new Schema({
    seller: { type: Schema.Types.ObjectId, ref: 'User' },
    listing: { type: Schema.Types.ObjectId, ref: 'Listing' },
    amount: Number,
    gateway: { type: String, default: 'sslcommerz' },
    status: { type: String, enum: ['initiated', 'success', 'failed', 'canceled'], default: 'initiated' },
    tranId: String,
    valId: String,
    payload: Schema.Types.Mixed
}, { timestamps: true });


export default mongoose.model('Transaction', txnSchema);