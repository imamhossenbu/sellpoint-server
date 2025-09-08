# Backend — SellPoint API

## Overview
Backend API for **SellPoint — Paid Real‑Estate Classifieds**.  
Built with **Node.js + Express**, **MongoDB (Mongoose)**, and **Socket.IO**.  
Provides authentication, listing management, subscriptions, payments, chat, and admin functionality.

---

## Features
- Auth (register/login, JWT tokens, bcrypt hashing)
- Roles: buyer, seller, admin
- Listings CRUD with plan‑based limits
- Wishlist, reviews/testimonials
- Realtime chat and notifications (Socket.IO)
- Payments: SSLCommerz integration (success, fail, cancel, IPN)
- Blog, subscribers, support tickets
- Admin console (moderation, health checks)

---

## Tech Stack
- **Express**, **Socket.IO**, **Mongoose**
- **JWT**, **bcrypt**
- **CORS**, **helmet**, **morgan**
- **SSLCommerz**, **NodeMailer**

---

## Setup

### Prerequisites
- Node.js 18+
- MongoDB Atlas/local instance
- SSLCommerz merchant account
- SMTP credentials

### Environment Variables (`.env`)
```env
PORT=4000
MONGODB_URI=mongodb+srv://user:pass@cluster/dbname
JWT_ACCESS_SECRET=super_secret_key
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://sell-point.netlify.app

# SSLCommerz
SSLC_STORE_ID=your_store_id
SSLC_STORE_PASSWD=your_store_password

# SMTP
SMTP_HOST=smtp.host.com
SMTP_USER=no-reply@example.com
SMTP_PASS=your_password
```

### Run
```bash
npm install
npm run dev      # http://localhost:4000
npm run start
```

---

## API Routes (Examples)
- `POST /auth/register`, `POST /auth/login`
- `GET /listings`, `POST /listings`
- `GET /reviews`, `POST /reviews`
- `POST /subscriptions/checkout`
- `POST /payments/ssl/success|fail|cancel`
- `POST /payments/ssl/ipn`
- `GET /conversations`, `POST /messages`
- `GET /admin/*`
