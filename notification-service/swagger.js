const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' });

const PORT = process.env.PORT || 3001;

const doc = {
  info: {
    title: 'Notification Service API',
    version: '1.0.0',
    description: 'Microservice de notifications bancaires (email, SMS, push)',
  },
  servers: [{ url: `http://localhost:${PORT}` }],
};

swaggerAutogen('./swagger-output.json', ['./index.js'], doc);
