const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  inputText: {
    type: String,
    required: true,
  },
  task: {
    type: String,
    required: true,
  },
  result: {
    type: String,
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('History', historySchema);
