// controllers/wishlistController.js
import User from '../models/User.js';

export const toggle = async (req, res) => {
    const { listingId } = req.params;
    const u = await User.findById(req.user._id);
    const target = String(listingId);

    // ensure array exists
    if (!Array.isArray(u.wishlist)) u.wishlist = [];

    const exists = u.wishlist.some(id => String(id) === target);
    if (exists) {
        // remove
        u.wishlist = u.wishlist.filter(id => String(id) !== target);
    } else {
        // add (avoid dupes)
        u.wishlist.push(listingId);
    }

    await u.save();

    const ids = u.wishlist.map(id => String(id));
    res.json({ wishlist: ids, on: ids.includes(target) });
};

export const mine = async (req, res) => {
    // if you want fully-populated listings in the wishlist page:
    const u = await User.findById(req.user._id).populate('wishlist', '_id title price coverUrl');
    const ids = (u.wishlist || []).map(x => String(x?._id ?? x));
    res.json({ wishlist: u.wishlist, ids });
};
