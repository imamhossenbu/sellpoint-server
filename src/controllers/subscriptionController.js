import dayjs from 'dayjs';
import User from '../models/User.js';


export const start = async (req, res) => {
    const { plan = 'basic' } = req.body;
    const now = dayjs();
    const end = plan === 'pro' ? now.add(30, 'day') : now.add(7, 'day');
    const u = await User.findById(req.user._id);
    u.subscriptions.push({ plan, startDate: now.toDate(), endDate: end.toDate(), status: 'active' });
    await u.save();
    res.json({ active: u.subscriptions[u.subscriptions.length - 1] });
};


export const cancel = async (req, res) => {
    const u = await User.findById(req.user._id);
    const active = u.subscriptions.find(s => s.status === 'active');
    if (!active) return res.status(400).json({ message: 'No active subscription' });
    active.status = 'canceled';
    await u.save();
    res.json({ canceled: active });
};


export const mine = async (req, res) => {
    const u = await User.findById(req.user._id);
    res.json({ subscriptions: u.subscriptions });
};