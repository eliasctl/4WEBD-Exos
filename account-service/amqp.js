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

async function publishNotification(payload) {
  try {
    const ch = await getChannel();
    ch.sendToQueue(QUEUE, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
    });
    console.log(
      `[AMQP] 📤 Notification publiée: ${payload.type} → ${payload.recipient}`,
    );
  } catch (err) {
    console.error(
      "[AMQP] ⚠️ Impossible de publier la notification:",
      err.message,
    );
  }
}

async function closeConnection() {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
  } catch (_) {}
  channel = null;
  connection = null;
  console.log("[AMQP] Connexion fermée");
}

module.exports = { publishNotification, getChannel, closeConnection, QUEUE };
