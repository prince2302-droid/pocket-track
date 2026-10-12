const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const Transaction = require('./models/Transaction');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection Manager (with caching for Serverless & Vercel environments)
let cachedDbPromise = null;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!MONGODB_URI) {
    return null;
  }

  if (!cachedDbPromise) {
    cachedDbPromise = mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    }).then((conn) => {
      console.log('✅ Connected to MongoDB Atlas Cloud Database permanently');
      return conn;
    }).catch((err) => {
      cachedDbPromise = null;
      console.error('❌ MongoDB Connection Error:', err.message);
      throw err;
    });
  }

  await cachedDbPromise;
  return mongoose.connection;
}

// Initial connection attempt on process startup
if (MONGODB_URI) {
  connectToDatabase().catch((err) => {
    console.log('ℹ️  Ensure your IP is whitelisted (0.0.0.0/0) in MongoDB Atlas Network Access.');
  });
} else {
  console.log('⚠️  MONGODB_URI is not set in .env. Server will run in demo/offline mode.');
}

// Auto-connect middleware for all API requests
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api') && MONGODB_URI && mongoose.connection.readyState !== 1) {
    try {
      await connectToDatabase();
    } catch (e) {
      // Continue so route handlers can provide fallback response
    }
  }
  next();
});

// In-memory fallback only used if MongoDB URI is missing or disconnected
let localDemoStore = [
  {
    _id: 'demo-1',
    id: 'demo-1',
    title: 'Monthly Pocket Money from Parents',
    amount: 5000,
    type: 'income',
    account: 'UPI',
    category: 'Pocket Money',
    date: new Date(),
    notes: 'Direct transfer to UPI'
  },
  {
    _id: 'demo-2',
    id: 'demo-2',
    title: 'Campus ATM Cash Withdrawal',
    amount: 1500,
    type: 'transfer',
    account: 'UPI',
    from_account: 'UPI',
    to_account: 'Cash',
    category: 'Transfer',
    date: new Date(),
    notes: 'Cash in pocket'
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
    const amt = Number(tx.amount) || 0;
    const txType = tx.type;

    if (txType === 'income') {
      totalPocketMoney += amt;
      if (tx.account === 'UPI') upiBalance += amt;
      else if (tx.account === 'Cash') cashBalance += amt;
    } else if (txType === 'expense') {
      totalSpent += amt;
      if (tx.account === 'UPI') upiBalance -= amt;
      else if (tx.account === 'Cash') cashBalance -= amt;

      const cat = tx.category || 'Other Expense';
      categoryMap[cat] = (categoryMap[cat] || 0) + amt;
    } else if (txType === 'transfer') {
      const fromAcc = tx.from_account || (tx.account === 'UPI' ? 'UPI' : 'Cash');
      const toAcc = tx.to_account || (fromAcc === 'UPI' ? 'Cash' : 'UPI');

      if (fromAcc === 'UPI') upiBalance -= amt;
      else if (fromAcc === 'Cash') cashBalance -= amt;

      if (toAcc === 'UPI') upiBalance += amt;
      else if (toAcc === 'Cash') cashBalance += amt;
      // Transfer does not change total pocket money or total spent
    }
  });

  return {
    upiBalance,
    cashBalance,
    totalBalance: upiBalance + cashBalance,
    totalPocketMoney,
    totalSpent,
    remainingPocketMoney: totalPocketMoney - totalSpent,
    spendRatio: totalPocketMoney > 0 ? parseFloat(((totalSpent / totalPocketMoney) * 100).toFixed(1)) : 0,
    categoryBreakdown: categoryMap
  };
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Database Connection Status
app.get('/api/status', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.json({
    connected: isConnected,
    mode: isConnected ? 'MongoDB Atlas (Permanent Cloud DB)' : 'Local Demo Mode (Cloud URI Not Configured)',
    message: isConnected
      ? 'Connected permanently to MongoDB Atlas cloud database.'
      : 'Running in demo storage. Add your MongoDB Atlas connection string in .env to persist to the cloud.'
  });
});

// 2. Get All Transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const { account, type, category } = req.query;
    const isConnected = mongoose.connection.readyState === 1;

    if (isConnected) {
      const filter = {};
      if (account && account !== 'all') {
        filter.$or = [
          { account: account },
          { from_account: account },
          { to_account: account }
        ];
      }
      if (type && type !== 'all') filter.type = type;
      if (category && category !== 'all') filter.category = category;

      const transactions = await Transaction.find(filter).sort({ date: -1, createdAt: -1 });
      const allTxForSummary = await Transaction.find({});
      const summary = calculateSummary(allTxForSummary);

      return res.json({ success: true, transactions, summary, isCloud: true });
    } else {
      let filtered = [...localDemoStore];
      if (account && account !== 'all') {
        filtered = filtered.filter((t) => t.account === account || t.from_account === account || t.to_account === account);
      }
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

    const txId = crypto.randomUUID();
    const parsedDate = date ? new Date(date) : new Date();

    const txPayload = {
      _id: txId,
      id: txId,
      title: title.trim(),
      amount: parseFloat(parseFloat(amount).toFixed(2)),
      type: type || 'expense',
      account: account || 'UPI',
      from_account: null,
      to_account: null,
      category: category.trim(),
      date: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
      notes: notes ? notes.trim() : '',
      created_at: new Date().toISOString()
    };

    const isConnected = mongoose.connection.readyState === 1;

    if (isConnected) {
      const newTx = await Transaction.create(txPayload);
      const allTx = await Transaction.find({});
      const summary = calculateSummary(allTx);
      return res.status(201).json({ success: true, transaction: newTx, summary });
    } else {
      const newTx = {
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

    const txId = crypto.randomUUID();
    const memo = notes || `Transfer from ${fromAccount} to ${toAccount}`;

    const transferTx = {
      _id: txId,
      id: txId,
      title: `Transfer to ${toAccount}`,
      amount: numAmount,
      type: 'transfer',
      account: fromAccount,
      from_account: fromAccount,
      to_account: toAccount,
      category: 'Transfer',
      date: new Date(),
      notes: memo,
      created_at: new Date().toISOString()
    };

    const isConnected = mongoose.connection.readyState === 1;

    if (isConnected) {
      const createdTransfer = await Transaction.create(transferTx);
      const allTx = await Transaction.find({});
      const summary = calculateSummary(allTx);
      return res.json({ success: true, transactions: [createdTransfer], summary });
    } else {
      localDemoStore.unshift(transferTx);
      const summary = calculateSummary(localDemoStore);
      return res.json({ success: true, transactions: [transferTx], summary });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Delete a Transaction
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isConnected = mongoose.connection.readyState === 1;

    if (isConnected) {
      const deleted = await Transaction.findOneAndDelete({
        $or: [{ _id: id }, { id: id }]
      });

      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Transaction not found.' });
      }

      const allTx = await Transaction.find({});
      const summary = calculateSummary(allTx);
      return res.json({ success: true, message: 'Transaction permanently deleted from MongoDB Atlas.', summary });
    } else {
      const initialLength = localDemoStore.length;
      localDemoStore = localDemoStore.filter((t) => t._id !== id && t.id !== id);
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

// Start Server locally if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Student Expense Tracker server running at: http://localhost:${PORT}`);
  });
}

module.exports = app;
