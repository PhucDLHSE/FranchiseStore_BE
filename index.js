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
const categoryRoutes = require("./src/routes/categoryRoutes");

/* ================= USE ROUTES ================= */
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api", userRoutes);
app.use("/api", authRoutes);
app.use("/api", storeRoutes);
app.use("/api", categoryRoutes);



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
