const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const User = require('./models/User');
const Transaction = require('./models/Transaction');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'pockettrack_super_secure_jwt_secret_student_2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection Manager (with connection reuse for Serverless & Vercel)
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
  console.log('⚠️  MONGODB_URI is not set in .env. Server running in fallback mode.');
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

// JWT Helper
function generateToken(id) {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
}

// Auth Helper to extract user from token
async function getAuthUser(req) {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) return null;
    const user = await User.findOne({ _id: decoded.id }).select('-password');
    return user;
  } catch (err) {
    return null;
  }
}

// Middleware: Require Authentication
async function requireAuth(req, res, next) {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
  }
  req.user = user;
  next();
}

// Middleware: Optional Authentication (attaches req.user if token present)
async function optionalAuth(req, res, next) {
  req.user = await getAuthUser(req);
  next();
}

// Fallback in-memory demo data
let localDemoStore = [
  {
    _id: 'demo-1',
    id: 'demo-1',
    userId: null,
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
    userId: null,
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
// 1. AUTHENTICATION ROUTES
// ==========================================

// Signup: Register new user
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Please enter Name, Email, and Password.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists. Please log in.' });
    }

    const userId = crypto.randomUUID();
    const newUser = await User.create({
      _id: userId,
      name: name.trim(),
      email: cleanEmail,
      password: password
    });

    // Adopt any legacy unassigned transactions in MongoDB so existing data is preserved
    const adopted = await Transaction.updateMany(
      { $or: [{ userId: null }, { userId: { $exists: false } }] },
      { userId: newUser._id }
    );

    // If no transactions exist, create starter pocket money
    const count = await Transaction.countDocuments({ userId: newUser._id });
    if (count === 0) {
      await Transaction.create({
        _id: crypto.randomUUID(),
        userId: newUser._id,
        title: 'Monthly Pocket Money from Parents',
        amount: 5000,
        type: 'income',
        account: 'UPI',
        category: 'Pocket Money',
        date: new Date(),
        notes: 'Initial pocket money transfer'
      });
    }

    const token = generateToken(newUser._id);

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        defaultCurrency: newUser.defaultCurrency
      },
      message: 'Account created successfully! Your data is saved permanently.'
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error during signup.' });
  }
});

// Login: Authenticate existing user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Please provide both email and password.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(401).json({ success: false, error: 'No account found with this email address.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Incorrect password. Please try again.' });
    }

    // Adopt any orphaned transactions
    await Transaction.updateMany(
      { $or: [{ userId: null }, { userId: { $exists: false } }] },
      { userId: user._id }
    );

    const token = generateToken(user._id);

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        defaultCurrency: user.defaultCurrency
      },
      message: `Welcome back, ${user.name}!`
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error during login.' });
  }
});

// Get Current User Profile
app.get('/api/auth/me', requireAuth, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      defaultCurrency: req.user.defaultCurrency,
      createdAt: req.user.createdAt
    }
  });
});

// Update Profile Settings (Currency preference, name)
app.put('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    const { name, defaultCurrency } = req.body;
    if (name) req.user.name = name.trim();
    if (defaultCurrency) req.user.defaultCurrency = defaultCurrency;
    await req.user.save();

    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        defaultCurrency: req.user.defaultCurrency
      },
      message: 'Profile updated successfully.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. TRANSACTION ROUTES (USER-PARTITIONED)
// ==========================================

// Database Connection Status
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

// Get All Transactions for Active User
app.get('/api/transactions', optionalAuth, async (req, res) => {
  try {
    const { account, type, category } = req.query;
    const isConnected = mongoose.connection.readyState === 1;
    const userId = req.user ? req.user._id : null;

    if (isConnected) {
      const filter = {};

      if (userId) {
        filter.userId = userId;
      }

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
      const allTxForSummary = await Transaction.find(userId ? { userId } : {});
      const summary = calculateSummary(allTxForSummary);

      return res.json({
        success: true,
        transactions,
        summary,
        isCloud: true,
        authenticated: !!req.user,
        user: req.user ? { id: req.user._id, name: req.user.name, email: req.user.email } : null
      });
    } else {
      let filtered = [...localDemoStore];
      if (account && account !== 'all') {
        filtered = filtered.filter((t) => t.account === account || t.from_account === account || t.to_account === account);
      }
      if (type && type !== 'all') filtered = filtered.filter((t) => t.type === type);
      if (category && category !== 'all') filtered = filtered.filter((t) => t.category === category);

      filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
      const summary = calculateSummary(localDemoStore);

      return res.json({ success: true, transactions: filtered, summary, isCloud: false, authenticated: !!req.user });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a Transaction
app.post('/api/transactions', optionalAuth, async (req, res) => {
  try {
    const { title, amount, type, account, category, date, notes } = req.body;

    if (!title || !amount || !category) {
      return res.status(400).json({ success: false, error: 'Please provide Title, Amount, and Category.' });
    }

    const txId = crypto.randomUUID();
    const parsedDate = date ? new Date(date) : new Date();
    const userId = req.user ? req.user._id : null;

    const txPayload = {
      _id: txId,
      id: txId,
      userId: userId,
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
      const allTx = await Transaction.find(userId ? { userId } : {});
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

// Quick Account Transfer
app.post('/api/transactions/transfer', optionalAuth, async (req, res) => {
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
    const userId = req.user ? req.user._id : null;
    const memo = notes || `Transfer from ${fromAccount} to ${toAccount}`;

    const transferTx = {
      _id: txId,
      id: txId,
      userId: userId,
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
      const allTx = await Transaction.find(userId ? { userId } : {});
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

// Delete a Transaction
app.delete('/api/transactions/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const isConnected = mongoose.connection.readyState === 1;
    const userId = req.user ? req.user._id : null;

    if (isConnected) {
      const deleteQuery = {
        $or: [{ _id: id }, { id: id }]
      };
      if (userId) {
        deleteQuery.userId = userId;
      }

      const deleted = await Transaction.findOneAndDelete(deleteQuery);

      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Transaction not found or unauthorized.' });
      }

      const allTx = await Transaction.find(userId ? { userId } : {});
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
