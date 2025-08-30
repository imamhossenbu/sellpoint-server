// controllers/planController.js
import Plan from "../models/Plan.js";

export const listPublic = async (req, res) => {
    const items = await Plan.find().sort({ sort: 1, createdAt: -1 }).lean();
    res.json({ items });
};

export const create = async (req, res) => {
    const doc = await Plan.create(req.body);
    res.status(201).json({ plan: doc });
};

export const update = async (req, res) => {
    const { id } = req.params;
    const doc = await Plan.findByIdAndUpdate(id, req.body, { new: true });
    if (!doc) return res.status(404).json({ message: "Plan not found" });
    res.json({ plan: doc });
};

export const remove = async (req, res) => {
    const { id } = req.params;
    await Plan.findByIdAndDelete(id);
    res.json({ ok: true });
};
