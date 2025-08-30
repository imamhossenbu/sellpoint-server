// src/models/User.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

/**
 * Subscription entry references a Plan document now.
 * Keep it simple: status = active | canceled | expired
 */
const subscriptionSchema = new Schema(
    {
        plan: { type: Schema.Types.ObjectId, ref: 'Plan' }, // <- Plan ref
        startDate: Date,
        endDate: Date,
        status: {
            type: String,
            enum: ['active', 'canceled', 'expired'],
            default: 'active',
        },
    },
    { _id: false }
);

const userSchema = new Schema(
    {
        name: { type: String, required: true },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            index: true,
        },
        password: { type: String, required: true },

        role: { type: String, enum: ['buyer', 'seller', 'admin'], default: 'buyer' },
        isActive: { type: Boolean, default: true },

        // Profile fields
        avatarUrl: { type: String },
        phone: { type: String },
        about: { type: String, maxlength: 280 },
        city: { type: String },
        country: { type: String },

        wishlist: [{ type: Schema.Types.ObjectId, ref: 'Listing' }],

        // Subscriptions (now tied to Plan _id)
        subscriptions: [subscriptionSchema],

        /**
         * NEW:
         * - activePlan: which plan is currently giving seller access
         * - sellerUntil: when seller access expires (auto-downgrade back to buyer)
         */
        activePlan: { type: Schema.Types.ObjectId, ref: 'Plan', default: null },
        sellerUntil: { type: Date, default: null },

        // invalidate JWTs when password changes
        passwordChangedAt: { type: Date },

        // (Optional) kept if you referenced it in other places
        sellerApprovedAt: { type: Date },
    },
    { timestamps: true }
);

export default mongoose.model('User', userSchema);
