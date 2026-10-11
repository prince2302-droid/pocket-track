const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide a title or description'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters']
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
        values: ['expense', 'income'],
        message: '{VALUE} is not a valid transaction type'
      },
      default: 'expense'
    },
    account: {
      type: String,
      required: [true, 'Source account is required'],
      enum: {
        values: ['UPI', 'Cash'],
        message: '{VALUE} is not a valid account type'
      },
      default: 'UPI'
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
      maxlength: [250, 'Notes cannot exceed 250 characters'],
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Virtual field or index for fast querying
transactionSchema.index({ date: -1 });
transactionSchema.index({ account: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
