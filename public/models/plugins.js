const mongoose = require("mongoose");

const pluginSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  tags: [
    {
      type: String,
    },
  ],
  id: { type: String, required: true, unique: true },
  premium: { type: Boolean, default: false },
  description: String,
  image: { type: String },
  downloadCount: { type: Number, default: 0 },
  rateCount: [
    {
      star: { type: Number },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Plugins", pluginSchema);
