require("dotenv").config();
const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const path = require("path");
const ejs = require("ejs");
const fs = require("fs");
const routePlugins = require("./public/routes/plugins");
const Guilds = require("./public/models/guildData");

const app = express();

const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
} = require("discord.js");

const prefix = process.env.PREFIX || "!";
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();

// Load commands from commands folder
const commandsPath = path.join(__dirname, "public/commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ("name" in command && "execute" in command) {
    client.commands.set(command.name, command);
  } else {
    console.warn(
      `[WARNING] The command at ${filePath} is missing a required "name" or "execute" property.`
    );
  }
}

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);

  if (!command) return;

  try {
    command.execute(message, args);
  } catch (error) {
    console.error(error);
    message.reply("There was an error executing that command.");
  }
});

client.login(process.env.DISCORD_TOKEN);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {})
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// app.use(express.static("public", { maxAge: "7d" })); // cache for 7 days
// app.use(express.static("public")); // Disable caching for development
// Session middleware (before passport)
app.use(
  session({
    secret: "supersecretkey", // Replace in production
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
    }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
  })
);

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: process.env.REDIRECT_URI,
      scope: ["identify", "guilds"],
    },
    (accessToken, refreshToken, profile, done) => {
      process.nextTick(() => done(null, profile));
    }
  )
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(routePlugins);

app.post("/install-plugin", async (req, res) => {
  const { id, guildId } = req.body; // <-- read both from body

  console.log("Request body:", req.body);

  if (!id) {
    return res.status(400).json({ error: "Plugin id is required" });
  }

  if (!guildId) {
    return res.status(400).json({ error: "Guild ID is required" });
  }

  try {
    // Find the guild document by guildId
    const guild = await Guilds.findOne({ guildId });

    if (!guild) {
      return res.status(404).json({ error: "Guild not found" });
    }

    // Check if plugin already installed
    const pluginIndex = guild.plugins.findIndex((p) => p.pluginId === id);

    if (pluginIndex !== -1) {
      // If found, update enabled to true (or whatever logic you want)
      guild.plugins[pluginIndex].enabled = true;
    } else {
      // Else, add new plugin with enabled = true
      guild.plugins.push({ pluginId: id, enabled: true });
    }

    // Save updated guild document
    await guild.save();

    res.json({
      message: `Plugin ${id} installed successfully for guild ${guildId}.`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to install plugin" });
  }
});

// Routes
app.get("/", (req, res) => {
  renderWithLayout(res, "Home", "home", { user: req.user });
});

// Routes
app.get("/status", (req, res) => {
  renderWithLayout(res, "Status", "status", { user: req.user });
});

// Routes
app.get("/premium", (req, res) => {
  renderWithLayout(res, "Premium", "premium", { user: req.user });
});

app.get("/dashboard", ensureAuth, async (req, res) => {
  try {
    const { code, guild_id } = req.query;

    if (code && guild_id) {
      // Exchange code for access token (if needed)

      // Check if guild exists in DB, create if not
      let guildProfile = await Guilds.findOne({ guildId: guild_id });
      if (!guildProfile) {
        guildProfile = new Guilds({
          guildId: guild_id,
          plugins: [],
        });
        await guildProfile.save();
      }

      // Redirect to clean URL after processing
      return res.redirect("/dashboard");
    }
    const allGuilds = req.user.guilds || [];
    const ownedGuilds = allGuilds.filter((guild) => guild.owner);

    // Fetch existing guild data from DB
    const existingGuildDocs = await Guilds.find({
      guildId: { $in: ownedGuilds.map((g) => g.id) },
    }).lean();

    const existingGuildIds = existingGuildDocs.map((g) => g.guildId);

    // Separate and tag guilds
    const guildList = ownedGuilds.map((guild) => {
      const existsInDB = existingGuildIds.includes(guild.id);
      return {
        ...guild,
        existsInDB,
        styleClass: existsInDB ? "" : "transparent", // For CSS rendering
      };
    });

    // Sort so existing guilds are at the top
    guildList.sort((a, b) => {
      if (a.existsInDB && !b.existsInDB) return -1;
      if (!a.existsInDB && b.existsInDB) return 1;
      return 0;
    });

    // Get current hour (server time)
    const hour = new Date().getHours();
    let timeOfDay;

    if (hour >= 5 && hour < 12) {
      timeOfDay = "Good Morning";
    } else if (hour >= 12 && hour < 17) {
      timeOfDay = "Good Afternoon";
    } else if (hour >= 17 && hour < 21) {
      timeOfDay = "Good Evening";
    } else {
      timeOfDay = "Good Night";
    }

    // Render dashboard as normal
    renderWithLayout(res, "Dashboard", "dashboard", {
      user: req.user,
      guilds: guildList,
      timeOfDay,
      clientId: process.env.CLIENT_ID,
      redirectUri: "https://localhost:3000/discord/callback",
    });
  } catch (err) {
    console.error("❌ Dashboard error:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/dashboard/:guildId", ensureAuth, (req, res) => {
  const { guildId } = req.params;
  const allGuilds = req.user.guilds || [];
  const guild = allGuilds.find((g) => g.id === guildId);

  if (!guild) {
    res.status(404).render("404", { title: "Page Not Found" });
    return;
  }

  renderWithLayout(res, `${guild.name} Dashboard`, "guildDashboard", {
    user: req.user,
    guild: guild,
  });
});

// Partial: Overview
app.get("/dashboard/:guildId/overview", async (req, res) => {
  const { guildId } = req.params;
  const guildProfile = await Guilds.findOne({ guildId });

  if (req.xhr || req.headers.accept.indexOf("text/html") === -1) {
    return res.render("pages/dashboardPages/overview", {
      guildId,
      user: req.user,
    });
  }

  await renderWithLayout(res, "Overview", "/dashboardPages/overview", {
    guildId,
    section: "overview",
    user: req.user,
  });
});

// Partial: Subscription
app.get("/dashboard/:guildId/subscription", async (req, res) => {
  if (req.xhr || req.headers.accept.indexOf("text/html") === -1) {
    return res.render(`pages/dashboardPages/subscription"`, {
      guildId: req.params.guildId,
    });
  }

  await renderWithLayout(res, "Subscription", "dashboard/guildDashboard", {
    guildId: req.params.guildId,
    section: "subscription",
    user: req.user,
  });
});

// Partial: Plugins Carts
app.get("/dashboard/:guildId/plugins-carts", async (req, res) => {
  if (req.xhr || req.headers.accept.indexOf("text/html") === -1) {
    return res.render(`pages/dashboardPages/plugins-carts"`, {
      guildId: req.params.guildId,
    });
  }

  await renderWithLayout(res, "Plugins Carts", "dashboard/guildDashboard", {
    guildId: req.params.guildId,
    section: "plugins-carts",
    user: req.user,
  });
});

// Partial: Contact Support
app.get("/dashboard/:guildId/contact-support", async (req, res) => {
  if (req.xhr || req.headers.accept.indexOf("text/html") === -1) {
    return res.render(`dashboard/partials/contact-support`, {
      guildId: req.params.guildId,
    });
  }

  await renderWithLayout(res, "Contact Support", "dashboard/guildDashboard", {
    guildId: req.params.guildId,
    section: "contact-support",
    user: req.user,
  });
});

app.get("/plugins", (req, res) => {
  renderWithLayout(res, "Plugins", "plugins", { user: req.user });
});

// Auth routes
app.get("/login", passport.authenticate("discord"));

app.get(
  "/auth/discord/callback",
  passport.authenticate("discord", {
    failureRedirect: "/",
  }),
  (req, res) => {
    res.redirect("/dashboard");
  }
);

app.get("/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy(() => res.redirect("/"));
  });
});

// Protect middleware
function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

// 404
app.use((req, res) => {
  res.status(404).render("404", { title: "Page Not Found" });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

// Helper layout rendering
async function renderWithLayout(res, title, page, data = {}) {
  try {
    const isAuthenticated = !!data.user;
    if (isAuthenticated) {
      data.user = {
        id: data.user.id,
        username: data.user.username,
        avatar: `https://cdn.discordapp.com/avatars/${data.user.id}/${data.user.avatar}.png?size=128`,
      };
    }

    const content = await ejs.renderFile(
      path.join(__dirname, `views/pages/${page}.ejs`),
      data
    );

    const fullPage = await ejs.renderFile(
      path.join(__dirname, "views/layout.ejs"),
      {
        title,
        body: content,
        user: isAuthenticated ? data.user : null,
      }
    );

    res.send(fullPage);
  } catch (err) {
    console.error("❌ Rendering error:", err);
    res.status(500).send("Internal Server Error");
  }
}
