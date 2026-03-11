const { consumeNotifications, closeConnection } = require("./amqp");
const { sendNotification } = require("./index");

async function start() {
  console.log("\n🚀 Notification Worker démarré");
  console.log("   En attente de messages RabbitMQ...\n");

  await consumeNotifications((payload) => {
    const { type, recipient, message, metadata } = payload;
    console.log(`[WORKER] 📨 Message reçu: ${type} → ${recipient}`);
    sendNotification(type, recipient, message, metadata || {});
  });
}

const shutdown = async () => {
  console.log("\n[WORKER] Fermeture en cours...");
  await closeConnection();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start().catch((err) => {
  console.error("[WORKER] ❌ Erreur fatale:", err.message);
  process.exit(1);
});
