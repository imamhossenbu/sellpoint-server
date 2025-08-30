// models/SellerRequest.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const sellerRequestSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        plan: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
        status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
        note: String,
        reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
        reviewedAt: Date,
    },
    { timestamps: true }
);

export default mongoose.model("SellerRequest", sellerRequestSchema);
