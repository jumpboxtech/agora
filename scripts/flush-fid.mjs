import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const FID = 2574393;

const patterns = [
  `agora:claimed:${FID}:*`,
  `agora:cooldown:${FID}`,
  `agora:claims:${FID}:*`,
  `agora:daily-amount:${FID}:*`,
  `agora:lifetime:${FID}`,
  `agora:state:${FID}`,
  `agora:quests:${FID}`,
];

let total = 0;
for (const pat of patterns) {
  let cursor = 0;
  do {
    const [next, keys] = await redis.scan(cursor, { match: pat, count: 100 });
    cursor = next;
    if (keys.length > 0) {
      console.log("Deleting:", keys);
      await redis.del(...keys);
      total += keys.length;
    }
  } while (cursor !== 0);
}
console.log(`Deleted ${total} keys for FID ${FID}`);
