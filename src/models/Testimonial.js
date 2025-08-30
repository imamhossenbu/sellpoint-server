import mongoose from "mongoose";
const { Schema } = mongoose;

const testimonialSchema = new Schema({
    name: { type: String, required: true },
    role: { type: String, default: "" },          // e.g. "Seller • Dhaka"
    avatarUrl: { type: String, default: "" },     // Cloudinary URL
    quote: { type: String, required: true, maxlength: 600 },
    isPublished: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model("Testimonial", testimonialSchema);
