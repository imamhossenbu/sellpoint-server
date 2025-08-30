import nodemailer from 'nodemailer';


export const mailer = () => {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    return transporter;
};


export const sendMail = async ({ to, subject, html }) => {
    const t = mailer();
    await t.sendMail({ from: process.env.SMTP_USER, to, subject, html });
};