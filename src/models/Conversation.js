import mongoose from "mongoose";
const { Schema, Types } = mongoose;

const ConversationSchema = new Schema(
    {
        listing: { type: Types.ObjectId, ref: "Listing", required: true, index: true },
        participants: [{ type: Types.ObjectId, ref: "User", required: true }],
        participantsKey: { type: String, index: true },
        lastMessage: { type: String, default: "" },
        lastMessageAt: { type: Date },
        unread: { type: Map, of: Number, default: {} },
    },
    { timestamps: true }
);

ConversationSchema.index({ listing: 1, participantsKey: 1 }, { unique: true });

export default mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);
