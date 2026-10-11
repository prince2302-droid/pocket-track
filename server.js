const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const Transaction = require('./models/Transaction');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection
let isDbConnected = false;

if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      isDbConnected = true;
      console.log('✅ Connected to MongoDB Atlas Cloud Database');
    })
    .catch((err) => {
      isDbConnected = false;
      console.error('❌ MongoDB Connection Error:', err.message);
      console.log('ℹ️  Ensure your IP is whitelisted (0.0.0.0/0) in MongoDB Atlas Network Access.');
    });
} else {
  console.log('⚠️  MONGODB_URI is not set in .env. Server will run in demo/offline mode.');
  console.log('👉 Add your MongoDB Atlas connection string to .env to enable cloud storage.');
}

// In-memory fallback if MongoDB is not yet configured by the user
let localDemoStore = [
  {
    _id: 'demo-1',
    title: 'Monthly Pocket Money from Parents',
    amount: 6000,
    type: 'income',
    account: 'UPI',
    category: 'Pocket Money',
    date: new Date('2026-10-01'),
    notes: 'Google Pay transfer for the month'
  },
  {
    _id: 'demo-2',
    title: 'Emergency Cash from Grandparents',
    amount: 1500,
    type: 'income',
    account: 'Cash',
    category: 'Pocket Money',
    date: new Date('2026-10-02'),
    notes: 'Given in hand'
  },
  {
    _id: 'demo-3',
    title: 'College Semester Lab Manuals & Books',
    amount: 780,
    type: 'expense',
    account: 'Cash',
    category: 'College & Academics',
    date: new Date('2026-10-03'),
    notes: 'Bookstore near campus gate'
  },
  {
    _id: 'demo-4',
    title: 'Campus Canteen Lunch & Chai',
    amount: 140,
    type: 'expense',
    account: 'UPI',
    category: 'Food & Canteen',
    date: new Date('2026-10-05'),
    notes: 'PhonePe QR code scan'
  },
  {
    _id: 'demo-5',
    title: 'Metro Smart Card Monthly Recharge',
    amount: 500,
    type: 'expense',
    account: 'UPI',
    category: 'Transport',
    date: new Date('2026-10-06'),
    notes: 'Daily college commute'
  },
  {
    _id: 'demo-6',
    title: 'Weekend Movie & Hangout with Friends',
    amount: 450,
    type: 'expense',
    account: 'UPI',
    category: 'Entertainment',
    date: new Date('2026-10-08'),
    notes: 'Split movie ticket and snacks'
  },
  {
    _id: 'demo-7',
    title: 'Monthly Mobile Recharge (5G Data)',
    amount: 299,
    type: 'expense',
    account: 'UPI',
    category: 'Recharge & Bills',
    date: new Date('2026-10-09'),
    notes: 'Jio 28-day unlimited pack'
  }
];

// Helper to compute summary calculations
function calculateSummary(transactions) {
  let upiBalance = 0;
  let cashBalance = 0;
  let totalPocketMoney = 0;
  let totalSpent = 0;
  const categoryMap = {};

  transactions.forEach((tx) => {
    const amt = Number(tx.amount);
    if (tx.type === 'income') {
      totalPocketMoney += amt;
      if (tx.account === 'UPI') upiBalance += amt;
      else if (tx.account === 'Cash') cashBalance += amt;
    } else if (tx.type === 'expense') {
      totalSpent += amt;
      if (tx.account === 'UPI') upiBalance -= amt;
      else if (tx.account === 'Cash') cashBalance -= amt;

      categoryMap[tx.category] = (categoryMap[tx.category] || 0) + amt;
    }
  });

  return {
    upiBalance,
    cashBalance,
    totalBalance: upiBalance + cashBalance,
    totalPocketMoney,
    totalSpent,
    remainingPocketMoney: totalPocketMoney - totalSpent,
    spendRatio: totalPocketMoney > 0 ? ((totalSpent / totalPocketMoney) * 100).toFixed(1) : 0,
    categoryBreakdown: categoryMap
  };
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Database Connection Status
app.get('/api/status', (req, res) => {
  res.json({
    connected: isDbConnected,
    mode: isDbConnected ? 'MongoDB Atlas (Cloud)' : 'Local Demo Mode (Cloud URI Not Configured)',
    message: isDbConnected
      ? 'Connected to MongoDB Atlas cloud database.'
      : 'Running in demo storage. Add your MongoDB Atlas connection string in .env to persist to the cloud.'
  });
});

// 2. Get All Transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const { account, type, category } = req.query;

    if (isDbConnected) {
      const filter = {};
      if (account && account !== 'all') filter.account = account;
      if (type && type !== 'all') filter.type = type;
      if (category && category !== 'all') filter.category = category;

      const transactions = await Transaction.find(filter).sort({ date: -1, createdAt: -1 });
      const allTxForSummary = await Transaction.find({});
      const summary = calculateSummary(allTxForSummary);

      return res.json({ success: true, transactions, summary, isCloud: true });
    } else {
      let filtered = [...localDemoStore];
      if (account && account !== 'all') filtered = filtered.filter((t) => t.account === account);
      if (type && type !== 'all') filtered = filtered.filter((t) => t.type === type);
      if (category && category !== 'all') filtered = filtered.filter((t) => t.category === category);

      filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
      const summary = calculateSummary(localDemoStore);

      return res.json({ success: true, transactions: filtered, summary, isCloud: false });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Create a Transaction
app.post('/api/transactions', async (req, res) => {
  try {
    const { title, amount, type, account, category, date, notes } = req.body;

    if (!title || !amount || !category) {
      return res.status(400).json({ success: false, error: 'Please provide Title, Amount, and Category.' });
    }

    const txPayload = {
      title: title.trim(),
      amount: parseFloat(parseFloat(amount).toFixed(2)),
      type: type || 'expense',
      account: account || 'UPI',
      category: category.trim(),
      date: date ? new Date(date) : new Date(),
      notes: notes ? notes.trim() : ''
    };

    if (isDbConnected) {
      const newTx = await Transaction.create(txPayload);
      const allTx = await Transaction.find({});
      const summary = calculateSummary(allTx);
      return res.status(201).json({ success: true, transaction: newTx, summary });
    } else {
      const newTx = {
        _id: 'local-' + Date.now(),
        ...txPayload,
        createdAt: new Date()
      };
      localDemoStore.unshift(newTx);
      const summary = calculateSummary(localDemoStore);
      return res.status(201).json({ success: true, transaction: newTx, summary });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 4. Quick Account Transfer (e.g. ATM Cash Withdrawal from UPI)
app.post('/api/transactions/transfer', async (req, res) => {
  try {
    const { fromAccount, toAccount, amount, notes } = req.body;
    const numAmount = parseFloat(amount);

    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Enter a valid transfer amount.' });
    }

    if (fromAccount === toAccount) {
      return res.status(400).json({ success: false, error: 'Source and destination accounts must be different.' });
    }

    const transferDate = new Date();
    const memo = notes || `Transfer from ${fromAccount} to ${toAccount}`;

    const debitTx = {
      title: `Transfer to ${toAccount}`,
      amount: numAmount,
      type: 'expense',
      account: fromAccount,
      category: 'Transfer',
      date: transferDate,
      notes: memo
    };

    const creditTx = {
      title: `Transfer from ${fromAccount}`,
      amount: numAmount,
      type: 'income',
      account: toAccount,
      category: 'Transfer',
      date: transferDate,
      notes: memo
    };

    if (isDbConnected) {
      const createdDebit = await Transaction.create(debitTx);
      const createdCredit = await Transaction.create(creditTx);
      const allTx = await Transaction.find({});
      const summary = calculateSummary(allTx);
      return res.json({ success: true, transactions: [createdDebit, createdCredit], summary });
    } else {
      const deb = { _id: 'local-' + Date.now() + '-1', ...debitTx };
      const cred = { _id: 'local-' + Date.now() + '-2', ...creditTx };
      localDemoStore.unshift(deb, cred);
      const summary = calculateSummary(localDemoStore);
      return res.json({ success: true, transactions: [deb, cred], summary });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Delete a Transaction
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (isDbConnected) {
      const deleted = await Transaction.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Transaction not found.' });
      }
      const allTx = await Transaction.find({});
      const summary = calculateSummary(allTx);
      return res.json({ success: true, message: 'Transaction deleted successfully.', summary });
    } else {
      const initialLength = localDemoStore.length;
      localDemoStore = localDemoStore.filter((t) => t._id !== id);
      if (localDemoStore.length === initialLength) {
        return res.status(404).json({ success: false, error: 'Transaction not found.' });
      }
      const summary = calculateSummary(localDemoStore);
      return res.json({ success: true, message: 'Transaction deleted successfully.', summary });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve frontend for all standard requests
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Student Expense Tracker server running at: http://localhost:${PORT}`);
});
