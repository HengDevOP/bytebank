const mongoose = require("mongoose");

const guildSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
  },
  prefix: { type: String, default: "!" },
  subscription: {
    type: String, // or you can use Object if you want detailed subscription info
    default: "free", // example default value
  },
  plugins: [
    {
      pluginId: { type: String, required: true },
      enabled: { type: Boolean, default: true },
    },
  ],
  users: { type: [String], default: [] }, // array of user IDs
});

module.exports = mongoose.model("Guild", guildSchema);
