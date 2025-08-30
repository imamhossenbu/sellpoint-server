// src/controllers/paymentController.js
import { v4 as uuidv4 } from 'uuid';
import { initiatePayment, validateIPN } from '../utils/sslcommerz.js';
import Transaction from '../models/Transaction.js';
import { markApprovedWithExpiry } from './listingController.js';

export const sslInitiate = async (req, res) => {
    try {
        const { listingId = null, amount, email, phone, name } = req.body || {};
        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        const tranId = uuidv4();
        await Transaction.create({
            listing: listingId || undefined,
            seller: req.user?._id,
            amount: numAmount,
            tranId,
        });

        const base = process.env.BACKEND_URL?.replace(/\/$/, '');
        if (!base) return res.status(500).json({ message: 'BACKEND_URL not configured' });

        const success_url = `${base}/api/payments/ssl/success?tran_id=${tranId}`;
        const fail_url = `${base}/api/payments/ssl/cancel?tran_id=${tranId}`;
        const cancel_url = fail_url;
        const ipn_url = `${base}/api/payments/ssl/ipn`;

        const data = await initiatePayment({
            amount: numAmount,
            tranId,
            success_url,
            fail_url,
            cancel_url,
            ipn_url,
            cus_email: email,
            cus_phone: phone,
            cus_name: name,
        });

        const redirectURL = data?.GatewayPageURL || data?.redirectGatewayURL || null;
        if (!redirectURL) {
            return res.status(502).json({
                message: 'Gateway did not return a redirect URL',
                status: data?.status || 'FAILED',
                details: data,
            });
        }

        res.json({ redirectURL, status: data?.status || 'SUCCESS', tranId });
    } catch (e) {
        res.status(500).json({ message: 'Failed to initiate payment', error: e?.message });
    }
};

export const sslSuccess = async (req, res) => {
    const tran_id = req.body?.tran_id || req.query?.tran_id;
    if (!tran_id) return res.status(400).send('Missing tran_id');

    const txn = await Transaction.findOne({ tranId: tran_id });
    if (!txn) return res.status(404).send('Transaction not found');

    txn.status = 'success';
    await txn.save();

    if (txn.listing) await markApprovedWithExpiry(txn.listing);

    // OPTIONAL: send users back to frontend
    // after verifying txn success:
    const fe = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!doctype html><html><body>
<script>location.href='${fe}/pricing/checkout/success?tran_id=${tran_id}&amount=${txn.amount || ''}';</script>
<p>Redirecting…</p></body></html>`);

};

export const sslCancel = async (req, res) => {
    const tran_id = req.body?.tran_id || req.query?.tran_id;
    const txn = tran_id ? await Transaction.findOne({ tranId: tran_id }) : null;
    if (txn) {
        txn.status = 'canceled';
        await txn.save();
    }

    const fe = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!doctype html><html><body>
<script>location.href='${fe}/pricing/checkout/cancel?status=cancel';</script>
<p>Payment canceled.</p></body></html>`);
};

export const sslIPN = async (req, res) => {
    const body = req.body || {};
    if (!validateIPN(body)) return res.status(400).json({ ok: false });
    const txn = await Transaction.findOne({ tranId: body.tran_id });
    if (!txn) return res.status(404).json({ message: 'Transaction not found' });

    txn.status = 'success';
    txn.valId = body.val_id;
    txn.payload = body;
    await txn.save();

    if (txn.listing) await markApprovedWithExpiry(txn.listing);

    res.json({ ok: true });
};
