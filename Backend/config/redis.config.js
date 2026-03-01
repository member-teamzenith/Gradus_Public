const { createClient } = require("redis");
require("dotenv").config();

const getRedisClient = async (url, label) => {
  if (!url) {
    throw new Error(`${label} REDIS URL is missing`);
  }

  const client = createClient({ url });

  client.on("error", (err) =>
    console.error(`${label} Redis Error`, err)
  );

  client.on("connect", () =>
    console.log(`${label} Redis connected successfully`)
  );

  await client.connect();
  return client;
};

exports.connectRedis = () =>
  getRedisClient(process.env.REDIS_URL, "Primary");

exports.connectRedisSummary = () =>
  getRedisClient(process.env.REDIS_URL_TWO, "Summary");
