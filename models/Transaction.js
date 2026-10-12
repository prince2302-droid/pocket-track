const mongoose = require('mongoose');
const crypto = require('crypto');

const transactionSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => crypto.randomUUID()
    },
    id: {
      type: String,
      default: function() {
        return this._id;
      }
    },
    title: {
      type: String,
      required: [true, 'Please provide a title or description'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters']
    },
    amount: {
      type: Number,
      required: [true, 'Please provide an amount'],
      min: [0.01, 'Amount must be greater than zero']
    },
    type: {
      type: String,
      required: [true, 'Transaction type is required'],
      enum: {
        values: ['expense', 'income', 'transfer'],
        message: '{VALUE} is not a valid transaction type'
      },
      default: 'expense'
    },
    account: {
      type: String,
      enum: {
        values: ['UPI', 'Cash', null],
        message: '{VALUE} is not a valid account type'
      },
      default: 'UPI'
    },
    from_account: {
      type: String,
      enum: {
        values: ['UPI', 'Cash', null],
        message: '{VALUE} is not a valid source account'
      },
      default: null
    },
    to_account: {
      type: String,
      enum: {
        values: ['UPI', 'Cash', null],
        message: '{VALUE} is not a valid destination account'
      },
      default: null
    },
    category: {
      type: String,
      required: [true, 'Please select a category'],
      trim: true
    },
    date: {
      type: Date,
      required: [true, 'Transaction date is required'],
      default: Date.now
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [300, 'Notes cannot exceed 300 characters'],
      default: ''
    },
    created_at: {
      type: String,
      default: () => new Date().toISOString()
    }
  },
  {
    timestamps: true,
    _id: false
  }
);

// Virtual field or index for fast querying
transactionSchema.index({ date: -1 });
transactionSchema.index({ account: 1 });
transactionSchema.index({ type: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
