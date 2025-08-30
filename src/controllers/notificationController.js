import Notification from '../models/Notification.js';


export const list = async (req, res) => {
    const items = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(items);
};


export const markRead = async (req, res) => {
    const it = await Notification.findById(req.params.id);
    if (!it || String(it.user) !== String(req.user._id)) return res.status(404).json({ message: 'Not found' });
    it.read = true;
    await it.save();
    res.json(it);
};