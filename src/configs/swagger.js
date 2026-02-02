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
      },

      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "integer" },
            username: { type: "string" },
            role: {
              type: "string",
              enum: ["ADMIN", "CK_STAFF", "SC_COORDINATOR", "FR_STAFF", "MANAGER"]
            },
            store_id: {
              type: "integer",
              nullable: true
            }
          }
        },

        Store: {
          type: "object",
          properties: {
            id: { type: "integer" },
            type: {
              type: "string",
              enum: ["FR", "CK", "SC"]
            },
            name: { type: "string" },
            address: { type: "string" }
          }
        }
      }
    },

    security: [
      {
        bearerAuth: []
      }
    ]
  },

  apis: ["./src/routes/*.js"]
};

module.exports = swaggerJSDoc(options);
