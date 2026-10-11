# 🎓 PocketTrack — Student Multi-Account Expense Tracker

A modern cloud-connected student expense tracker with dual **UPI & Cash** account tracking, pocket money management, visual analytics, and **MongoDB Atlas** persistence.

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
- **Visual Analytics**:
  - Interactive **Chart.js** category breakdown donut chart.
  - Center metric displaying total spent across accounts.
  - Ranked category spending leaderboard with progress bars.
- **Cloud Persistence**:
  - REST API built with **Node.js** and **Express**.
  - Data stored in **MongoDB Atlas** using **Mongoose** models.
  - Safe fallback to local demo mode if cloud URI is not yet configured.

---

## 🛠️ Installation & Setup

### 1. Install Dependencies
Open a terminal in this folder and run:
```bash
npm install
```

### 2. Configure MongoDB Atlas
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free shared cluster (M0 sandbox).
3. Set up a Database User with username and password.
4. Go to **Network Access** and add IP `0.0.0.0/0` (Allow Access from Anywhere).
5. Click **Connect** > **Drivers** > Copy your connection string.
6. Open `.env` and paste your connection string:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/student_expenses?retryWrites=true&w=majority
```

### 3. Start the Server
```bash
npm start
```
Or with auto-reload:
```bash
npm run dev
```

Visit **`http://localhost:5000`** in your browser.
