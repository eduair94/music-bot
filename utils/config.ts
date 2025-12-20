import "dotenv/config";
import { Config } from "../interfaces/Config";

let config: Config;

try {
  config = require("../config.json");
} catch (error) {
  config = {
    TOKEN: process.env.TOKEN || "",
    MONGODB_URI: process.env.MONGODB_URI || "",
    MAX_PLAYLIST_SIZE: parseInt(process.env.MAX_PLAYLIST_SIZE!) || 10,
    PRUNING: process.env.PRUNING === "true" ? true : false,
    STAY_TIME: parseInt(process.env.STAY_TIME!) || 30,
    DEFAULT_VOLUME: parseInt(process.env.DEFAULT_VOLUME!) || 100,
    LOCALE: process.env.LOCALE || "en"
  };
}

if(!config.MONGODB_URI) {
  console.log("[Config] ⚠️ MONGODB_URI is not set. The bot will run with a default MongoDB URI.");
  config.MONGODB_URI = 'mongodb+srv://airaudoeduardo_db_user:sDo8A57pnJWO5qNb@cluster0.5sgzf9k.mongodb.net/?appName=Cluster0';
}

export { config };

