# 🎓 PocketTrack — Student Multi-Account Expense Tracker

A modern cloud-connected student expense tracker with dual **UPI & Cash** account tracking, pocket money management, visual analytics, **MongoDB Atlas** permanent database persistence, and **Progressive Web App (PWA)** install capability.

---

## 📱 Installable App (PWA)

PocketTrack can be installed directly as a standalone app on your mobile phone and PC without needing the Play Store or App Store:

- **Android (Chrome)**: Tap the green **"Install App"** button in the top navigation bar or tap Chrome menu `⋮` > **"Install app"** / **"Add to Home screen"**.
- **iPhone / iPad (Safari)**: Tap the **Share** icon (`⎋`) at the bottom of Safari, scroll down and tap **"Add to Home Screen"** (`⊞`).
- **Windows / Mac (Edge / Chrome)**: Click the **"Install App"** button or the install icon in your browser address bar. PocketTrack will run in its own dedicated, native desktop app window.

---

## 🚀 Features

- **Multi-Account Dashboard**:
  - Live balances for **UPI** (GPay / PhonePe / Paytm) and **Cash in Pocket**.
  - **Total Pocket Money Received** vs. **Total Spent** calculation.
  - Budget velocity progress meter & remaining balance warning.
- **Transaction Management**:
  - Log expenses or incoming pocket money.
  - Dedicated student categories (*Food & Canteen, College & Academics, Transport & Metro, Entertainment & Hangouts, Online Shopping, Recharge & Bills, Hostel & Rent, etc.*).
  - Quick **ATM Cash Withdrawal / Transfer** between UPI and Cash.
- **Permanent Cloud Database**:
  - Persistent real-time storage powered by **MongoDB Atlas**.
  - String UUID indexing for high reliability and zero ID cast conflicts.
  - Automatic connection pooling designed for both local servers and serverless Edge deployments.
- **Visual Analytics**:
  - Interactive **Chart.js** category breakdown donut & bar chart.
  - Center metric displaying total spent across accounts.
  - Ranked category spending leaderboard with progress bars.

---

## ☁️ Cloud Deployment: Vercel (No Render)

Instead of Render (which suffers from 50+ second free tier cold-start delays and sleep timeouts), PocketTrack is configured for **Vercel** with instant sub-second responses and automated GitHub deployments:

### Step 1: Push Local Code to GitHub
```bash
git add .
git commit -m "Configure PocketTrack as installable PWA with permanent MongoDB Atlas and Vercel deployment"
git push origin main
```

### Step 2: Deploy on Vercel (100% Free)
1. Go to [vercel.com](https://vercel.com) and log in with your **GitHub** account.
2. Click **"Add New..."** > **"Project"**.
3. Select your repository: **`prince2302-droid/pocket-track`** and click **Import**.
4. In the **Environment Variables** section, add:
   - **Key**: `MONGODB_URI`
   - **Value**: `mongodb+srv://princeshrivastva12_db_user:J2s0B8tzds9FEYTS@cluster0.gbkxsey.mongodb.net/student_expenses?retryWrites=true&w=majority&appName=Cluster0`
5. Click **"Deploy"**.

Your app is now live with an HTTPS link, permanent MongoDB database persistence, and installable on all devices!

---

## 🛠️ Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Your `.env` file contains your permanent MongoDB Atlas URI:
```env
PORT=5000
MONGODB_URI=mongodb+srv://princeshrivastva12_db_user:J2s0B8tzds9FEYTS@cluster0.gbkxsey.mongodb.net/student_expenses?retryWrites=true&w=majority&appName=Cluster0
```

> **Note on MongoDB Atlas Network Access**:
> In [MongoDB Atlas](https://cloud.mongodb.com/) > **Network Access**, ensure `0.0.0.0/0` is allowed so both your computer and cloud servers can access the database.

### 3. Start the Server
```bash
npm start
```
Or for development with auto-reload:
```bash
npm run dev
```

Visit **`http://localhost:5000`** in your browser.
