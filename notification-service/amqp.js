const amqp = require("amqplib");

const AMQP_URL = process.env.AMQP_URL || "amqp://localhost";
const QUEUE = "transaction_notifications";

let connection;
let channel;

async function getChannel(retries = 10, delay = 3000) {
  if (channel) return channel;
  for (let i = 1; i <= retries; i++) {
    try {
      connection = await amqp.connect(AMQP_URL);
      channel = await connection.createChannel();
      await channel.assertQueue(QUEUE, { durable: true });

      connection.on("close", () => {
        console.log("[AMQP] Connexion fermée");
        channel = null;
        connection = null;
      });

      console.log("[AMQP] ✅ Connecté à RabbitMQ");
      return channel;
    } catch (err) {
      console.warn(`[AMQP] ⏳ Tentative ${i}/${retries} échouée: ${err.message}`);
      if (i === retries) throw err;
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

async function consumeNotifications(handler) {
  const ch = await getChannel();
  await ch.prefetch(1);
  ch.consume(
    QUEUE,
    async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        await handler(payload);
        ch.ack(msg);
      } catch (err) {
        console.error("[AMQP] ❌ Erreur traitement message:", err.message);
        ch.nack(msg, false, true);
      }
    },
    { noAck: false },
  );
  console.log(`[AMQP] 🎧 En écoute sur la queue "${QUEUE}"`);
}

async function closeConnection() {
  if (channel) await channel.close();
  if (connection) await connection.close();
  channel = null;
  connection = null;
}

module.exports = { getChannel, consumeNotifications, closeConnection, QUEUE };
