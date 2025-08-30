// src/utils/mailer.js
import nodemailer from 'nodemailer';

export const mailer = () => {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,                 // e.g. smtp.gmail.com
        port: Number(process.env.SMTP_PORT || 587),  // 587 for TLS, 465 for SSL
        secure: false,                                // set true if you use port 465
        auth: {
            user: process.env.SMTP_USER,               // your email
            pass: process.env.SMTP_PASS,               // app password (for Gmail)
        },
    });

    return transporter;
};

export const sendMail = async ({ to, subject, html }) => {
    const t = mailer();
    await t.sendMail({
        from: process.env.SMTP_USER,
        to,
        subject,
        html,
    });
};
