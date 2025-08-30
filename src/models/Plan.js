// models/Plan.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const planSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, unique: true, trim: true, index: true },
        description: String,
        priceBDT: { type: Number, default: 0 },
        period: { type: String, enum: ["month", "year", "one_time"], default: "month" },
        features: [{ type: String }],
        popular: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        sort: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export default mongoose.model("Plan", planSchema);
