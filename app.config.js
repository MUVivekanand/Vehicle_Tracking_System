import 'dotenv/config';

export default {
  name: "vehicle",
  version: "1.0.0",
  extra: {
    CHANNEL_ID: process.env.CHANNEL_ID,
    READ_API_KEY: process.env.READ_API_KEY,
  },
};