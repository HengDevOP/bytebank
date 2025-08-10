const express = require("express");
const router = express.Router();
const Plugin = require("../models/plugins");
const Guild = require("../models/guildData");

router.get("/api/plugins", async (req, res) => {
  try {
    const plugins = await Plugin.find({});
    res.json(plugins);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch plugins" });
  }
});

router.get("/api/guild-profile", async (req, res) => {
  const guildId = req.query.guildId; // Assuming guildId is passed as a query parameter
  if (!guildId) {
    return res.status(400).json({ error: "Guild ID is required" });
  }

  try {
    const guildData = await Guild.findOne({ guildId });
    if (!guildData) {
      return res.status(404).json({ error: "Guild not found" });
    }
    res.json(guildData.plugins);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch guild profile" });
  }
});

module.exports = router;
