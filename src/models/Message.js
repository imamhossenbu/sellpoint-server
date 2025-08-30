import mongoose from "mongoose";
const { Schema, Types } = mongoose;

const MessageSchema = new Schema(
    {
        conversation: { type: Types.ObjectId, ref: "Conversation", required: true, index: true },
        from: { type: Types.ObjectId, ref: "User", required: true, index: true },
        to: { type: Types.ObjectId, ref: "User", required: true, index: true },
        text: { type: String, required: true, trim: true, maxlength: 2000 },
        read: { type: Boolean, default: false },
        readAt: { type: Date },
    },
    { timestamps: true }
);

export default mongoose.models.Message || mongoose.model("Message", MessageSchema);
