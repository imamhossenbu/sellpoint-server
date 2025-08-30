import { Router } from 'express';
import { protect, requireRoles } from '../middleware/auth.js';
import {
    // users
    listUsers, toggleUser, banUser, unbanUser, deleteUser,
    // listings
    listAdminListings, approveListing, rejectListing, reviewPending,
    // transactions
    listTransactions,
    // stats + support
    adminStats, listSupportTicketsAdmin, getListingAdmin
} from '../controllers/adminController.js';

const router = Router();
router.use(protect, requireRoles('admin'));

// Users
router.get('/users', listUsers);
router.patch('/users/:id/toggle', toggleUser);   // legacy toggle
router.patch('/users/:id/ban', banUser);
router.patch('/users/:id/unban', unbanUser);
router.delete('/users/:id', deleteUser);

// Listings
router.get('/listings', listAdminListings);
router.patch('/listings/:id/approve', approveListing);
router.patch('/listings/:id/reject', rejectListing);
router.get('/review/pending', reviewPending);

// Transactions
router.get('/transactions', listTransactions);

// Dashboard stats
router.get('/stats', adminStats);

// Support (optional; returns empty if SupportTicket model not present)
router.get('/support/tickets', listSupportTicketsAdmin);
// src/routes/adminRoutes.js
router.get('/listings/:id', getListingAdmin);


export default router;
