const mongoose = require("mongoose");
const Plugin = require("./public/models/plugins");

mongoose.connect("mongodb://localhost:27017/discordAuth");

const sampleTags = [
  "utility",
  "moderation",
  "fun",
  "logging",
  "music",
  "admin",
  "games",
];

(async () => {
  await Plugin.deleteMany({}); // Optional: clear old plugins

  for (let i = 1; i <= 10; i++) {
    const shuffled = sampleTags.sort(() => 0.5 - Math.random());
    const tags = shuffled.slice(0, Math.floor(Math.random() * 3) + 1);
    await Plugin.create({
      name: `Plugin ${i}`,
      id: `plugin-${i}`,
      description: `This is a description for Plugin ${i}. It's awesome and useful.`,
      image: `https://example.com/icons/plugin${i}.png`,
      downloadCount: Math.floor(Math.random() * 1000000) + 100,
      rateCount: Array.from({ length: 5 }, (_, j) => ({
        star: j + 1,
      })),
      createdAt: new Date(
        Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 30
      ),
    });
  }

  console.log("Sample plugins inserted.");
  mongoose.connection.close();
})();
