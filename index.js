require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const pool = require("./src/configs/database");
const app = express();
const swaggerUi = require("swagger-ui-express");

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

/* ================= DEFINE ROUTES ================= */
const swaggerSpec = require("./src/configs/swagger");
const userRoutes = require("./src/routes/userRoutes");
const authRoutes = require("./src/routes/authRoutes");
const storeRoutes = require("./src/routes/storeRoutes");
const inventoryRoutes = require("./src/routes/inventoryRoutes");
const materialInventoryRoutes = require("./src/routes/materialInventoryRoutes");
const categoryRoutes = require("./src/routes/categoryRoutes");
const materialRoutes = require("./src/routes/materialRoutes");
const materialBatchRoutes = require("./src/routes/materialBatchRoutes");
const productRoutes = require("./src/routes/productRoutes");
const productRecipeRoutes = require("./src/routes/productRecipeRoutes");
const orderRoutes = require("./src/routes/orderRoutes");
const reservationRoutes = require("./src/routes/reservationRoutes");
const goodsIssueRoutes = require("./src/routes/goodsIssueRoutes");
const goodsReceiptRoutes = require("./src/routes/goodsReceiptRoutes.js");
const goodsReceiptMaterialRoutes = require("./src/routes/goodsReceiptMaterialRoutes");
const startAutoCancelJob = require("./src/services/autoCancelJob");


/* ================= USE ROUTES ================= */
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api", userRoutes);
app.use("/api", authRoutes);
app.use("/api", storeRoutes);
app.use("/api", inventoryRoutes);
app.use("/api", materialInventoryRoutes);
app.use("/api", categoryRoutes);
app.use("/api", materialRoutes);
app.use("/api", materialBatchRoutes);
app.use("/api", productRoutes);
app.use("/api", productRecipeRoutes);
app.use("/api", orderRoutes);
app.use("/api", reservationRoutes);
app.use("/api", goodsIssueRoutes);
app.use("/api", goodsReceiptRoutes);
app.use("/api", goodsReceiptMaterialRoutes);




/* ================= DB CONNECTION ================= */
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log("✅ MySQL connected");
    conn.release();
  } catch (err) {
    console.error("❌ MySQL error:", err.message);
  }
})();

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

startAutoCancelJob();