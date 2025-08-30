// src/controllers/listingController.js
import Listing from '../models/Listing.js';
import dayjs from 'dayjs';

// Public /listings
export const list = async (req, res) => {
    const {
        q,
        minPrice,
        maxPrice,
        category,
        type,
        lat,
        lng,
        radiusKm = 20,
        page = 1,
        limit = 12,
    } = req.query;

    const filter = { status: 'approved' };
    if (q) filter.title = { $regex: q, $options: 'i' };
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (minPrice) filter.price = { ...filter.price, $gte: Number(minPrice) };
    if (maxPrice) filter.price = { ...filter.price, $lte: Number(maxPrice) };

    if (lat && lng) {
        filter.location = {
            $near: {
                $geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
                $maxDistance: Number(radiusKm) * 1000,
            },
        };
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const perPage = Math.min(50, Math.max(1, Number(limit) || 12));
    const skip = (pageNum - 1) * perPage;

    const [items, total] = await Promise.all([
        Listing.find(filter).sort({ createdAt: -1 }).skip(skip).limit(perPage),
        Listing.countDocuments(filter),
    ]);

    res.json({ items, total, page: pageNum, pages: Math.ceil(total / perPage) });
};

// GET /listings/:id  -> include full seller profile + active plan summary
export const detail = async (req, res) => {
    const id = req.params.id;

    // Deep-populate seller (safe fields only) and seller.activePlan (Plan doc)
    const item = await Listing.findById(id)
        .populate({
            path: 'seller',
            // DO NOT select password or other sensitive internals
            select:
                'name email phone avatarUrl about city country role activePlan sellerUntil createdAt',
            populate: {
                path: 'activePlan',
                select: 'name priceBDT period', // from Plan model
            },
        })
        .lean();

    if (!item) return res.status(404).json({ message: 'Not found' });

    // atomically increment views (no need to re-read)
    await Listing.updateOne({ _id: id }, { $inc: { views: 1 } });

    res.json(item);
};

// POST /listings  (seller/admin)
export const create = async (req, res) => {
    const {
        title,
        price,
        type,
        category,
        area,
        address,
        lat,
        lng,
        images = [],
        description,
        location,
    } = req.body;

    let finalLocation = undefined;
    if (
        location?.type === 'Point' &&
        Array.isArray(location.coordinates) &&
        location.coordinates.length === 2
    ) {
        finalLocation = location; // honor client-provided GeoJSON
    } else if (
        Number.isFinite(Number(lat)) &&
        Number.isFinite(Number(lng))
    ) {
        finalLocation = { type: 'Point', coordinates: [Number(lng), Number(lat)] };
    }

    const listing = await Listing.create({
        title,
        price,
        type,
        category,
        area,
        address,
        location: finalLocation,
        images,
        description,
        seller: req.user._id,
        status: 'approved',
    });

    res.status(201).json(listing);
};

// PATCH /listings/:id  (seller/admin)
export const update = async (req, res) => {
    const item = await Listing.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    if (String(item.seller) !== String(req.user._id))
        return res.status(403).json({ message: 'Forbidden' });

    Object.assign(item, req.body);
    await item.save();
    res.json(item);
};

// DELETE /listings/:id  (seller/admin)
export const remove = async (req, res) => {
    const item = await Listing.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    if (String(item.seller) !== String(req.user._id))
        return res.status(403).json({ message: 'Forbidden' });

    await item.deleteOne();
    res.json({ ok: true });
};

// ✅ used by payments: mark listing approved with paidUntil
export const markApprovedWithExpiry = async (listingId, days = 30) => {
    const item = await Listing.findById(listingId);
    if (!item) return null;

    item.status = 'approved';
    item.paidUntil = dayjs().add(days, 'day').toDate();
    await item.save();

    return item;
};
