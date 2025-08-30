import Testimonial from "../models/Testimonial.js";

// PUBLIC — homepage pulls published items
export const listPublishedTestimonials = async (_req, res) => {
    const items = await Testimonial.find({ isPublished: true })
        .sort({ createdAt: -1 })
        .limit(12)
        .lean();
    res.json({ items });
};

// ADMIN — CRUD
export const listTestimonialsAdmin = async (req, res) => {
    const { q = "" } = req.query;
    const filter = q
        ? { $or: [{ name: { $regex: q, $options: "i" } }, { quote: { $regex: q, $options: "i" } }] }
        : {};
    const items = await Testimonial.find(filter).sort({ createdAt: -1 });
    res.json({ items });
};

export const createTestimonial = async (req, res) => {
    const { name, role, avatarUrl, quote, isPublished } = req.body;
    const t = await Testimonial.create({ name, role, avatarUrl, quote, isPublished: !!isPublished });
    res.json(t);
};

export const updateTestimonial = async (req, res) => {
    const { id } = req.params;
    const t = await Testimonial.findByIdAndUpdate(id, req.body, { new: true });
    if (!t) return res.status(404).json({ message: "Not found" });
    res.json(t);
};

export const publishTestimonial = async (req, res) => {
    const { id } = req.params;
    const t = await Testimonial.findById(id);
    if (!t) return res.status(404).json({ message: "Not found" });
    t.isPublished = !t.isPublished;
    await t.save();
    res.json({ id: t._id, isPublished: t.isPublished });
};

export const deleteTestimonial = async (req, res) => {
    const { id } = req.params;
    await Testimonial.findByIdAndDelete(id);
    res.json({ ok: true });
};
