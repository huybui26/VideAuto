const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "videauto-tts",
      script: path.join(__dirname, "scripts/omnivoice-server.py"),
      cwd: "../OmniVoice", // Path relative to where ecosystem.config.cjs is
      interpreter: "/Users/macbook/VSCode/AI_Gen/OmniVoice/venv/bin/python3",
      autorestart: true,
      watch: false
    },
    {
      name: "videauto-bot",
      script: "npm",
      args: "run bot",
      cwd: "./",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
