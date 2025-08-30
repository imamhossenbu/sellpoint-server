import mongoose from 'mongoose';
const { Schema } = mongoose;


const listingSchema = new Schema({
    title: { type: String, required: true },
    price: { type: Number, required: true },
    type: { type: String, enum: ['sale', 'rent'], required: true },
    category: { type: String, enum: ['house', 'flat', 'land'], required: true },
    area: { type: String, required: true },
    address: { type: String, required: true },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], index: '2dsphere', default: [0, 0] }
    },
    images: [{ type: String }],
    description: { type: String },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'expired'], default: 'pending' },
    paidUntil: { type: Date },
    views: { type: Number, default: 0 }
}, { timestamps: true });


export default mongoose.model('Listing', listingSchema);