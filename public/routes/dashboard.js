const express = require("express");
const router = express.Router();
const Plugin = require("../models/plugins");

router.get("/dashboard/:guildId", ensureAuth, (req, res) => {
  const { guildId } = req.params;
  const allGuilds = req.user.guilds || [];
  const guild = allGuilds.find((g) => g.id === guildId);

  if (!guild) {
    return res.status(404).send("Guild not found or you don't have access.");
  }

  res.render("guildDashboard", {
    user: req.user,
    guild: guild,
  });
});

module.exports = router;
