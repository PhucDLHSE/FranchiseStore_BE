const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "FranchiseStore API",
      version: "1.0.0",
      description: "API Documentation for FranchiseStore System"
    },
    servers: [
      {
        url: process.env.BASE_URL || "http://localhost:3000/api",
        description: "API server"
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },

  // 👇 QUAN TRỌNG NHẤT
  apis: ["./src/routes/*.js"] // nơi swagger đọc comment
};

module.exports = swaggerJSDoc(options);
