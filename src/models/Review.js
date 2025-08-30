// src/models/Review.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const reviewSchema = new Schema(
    {
        listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
        user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

        rating: { type: Number, min: 1, max: 5, required: true },
        comment: { type: String, trim: true, maxlength: 3000 },

        // Optional denormalized fields you can send from FE
        authorName: { type: String, trim: true, maxlength: 120 },       // optional
        avatarUrl: { type: String, trim: true, maxlength: 2048 },      // optional

        status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
        moderatedBy: { type: Schema.Types.ObjectId, ref: "User" },
        moderatedAt: { type: Date },
    },
    { timestamps: true }
);

// If you want to prevent multiple reviews per (listing,user), make it unique.
// Be careful: turning this on with existing dupes will throw an index error.
// reviewSchema.index({ listing: 1, user: 1 }, { unique: true });
reviewSchema.index({ listing: 1, user: 1 });

export default mongoose.models.Review || mongoose.model("Review", reviewSchema);
