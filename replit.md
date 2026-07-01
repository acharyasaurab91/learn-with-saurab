# Learn With Saurab — Ed-Tech Platform

Nepal's #1 exam preparation platform for CEE, IOE, Loksewa, License, SEE & NEB.

## Tech Stack
- **Backend:** Node.js + Express.js (MVC pattern)
- **Database:** MongoDB + Mongoose
- **Views:** EJS templates
- **Auth:** express-session + connect-mongo + bcryptjs
- **Payments:** eSewa + Khalti (Nepal-specific gateways)
- **Uploads:** Multer (videos, images, PDFs)
- **Email:** Nodemailer (Gmail SMTP)

## Running the App
```
npm start
```
App runs on port 5000.

## Admin Access
- URL: `/admin`
- Default credentials: `admin@learnwithsaurab.com` / `Admin@1234`
- Create admin: `node scripts/createAdmin.js`
- Seed categories: `node scripts/seedCategories.js`

## Exam Categories (seeded)
1. CEE — Medical & Paramedical (slug: `cee-medical`)
2. CEE — BNS / B.N.Sc. (slug: `cee-bns`)
3. IOE — Engineering (slug: `ioe-engineering`)
4. Loksewa / लोकसेवा (slug: `loksewa`)
5. License Exams (slug: `license`)
6. SEE & NEB (slug: `see-neb`)

## Required Environment Variables
See `.env.example` for all required variables. Key ones:
- `MONGODB_URI` — MongoDB Atlas connection string
- `SESSION_SECRET` — 64-char random string
- `ESEWA_MERCHANT_CODE` — from eSewa merchant dashboard
- `KHALTI_SECRET_KEY` — from Khalti merchant dashboard (Live Keys)
- `EMAIL_USER` / `EMAIL_PASS` — Gmail App Password for nodemailer
- `BASE_URL` — your production domain (for payment callbacks)

## Payment Gateway Setup
### eSewa (Test)
- No setup needed — uses `EPAYTEST` merchant code automatically in dev
- For live: get merchant code from merchant.esewa.com.np

### Khalti (Test)
- No setup needed — uses public test key automatically in dev
- For live: get secret key from khalti.com/dashboard → Settings → Live Keys
- Set `KHALTI_SECRET_KEY` env variable in Replit Secrets

## User Preferences
- Payment: eSewa first (launch), Khalti second (already integrated)
- Business model: Free content + per-course paid (lifetime access)
- No monthly subscriptions at launch
- Nepal-focused: all prices in NPR (Rs.)
- Social: YouTube @learnwithsaurabsir, Facebook, Instagram @learnwithsaurab, TikTok (13K followers)
- Contact: contactsaurabsir@gmail.com
