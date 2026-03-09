const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' });
const { PORT } = require('./config');

const doc = {
  info: {
    title: 'Account Service API',
    version: '1.0.0',
    description: 'Gestion des comptes bancaires et transactions',
  },
  servers: [{ url: `http://localhost:${PORT}` }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
};

swaggerAutogen('./swagger-output.json', ['./index.js'], doc);
