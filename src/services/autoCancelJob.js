const cron = require("node-cron");
const orderModel = require("../models/orderModel");

const startAutoCancelJob = () => {
  // Chạy mỗi ngày lúc 01:00 sáng
  cron.schedule("0 1 * * *", async () => {
    console.log("Running auto-cancel job...");

    try {
      const affectedRows = await orderModel.autoCancelExpiredOrders();
      console.log(`Auto-cancelled ${affectedRows} orders`);
    } catch (error) {
      console.error("Auto-cancel job error:", error);
    }
  });
};

module.exports = startAutoCancelJob;