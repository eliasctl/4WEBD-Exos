module.exports = {
  PORT: process.env.PORT || 3003,
  JWT_SECRET: process.env.JWT_SECRET || 'supersecret_jwt_key_for_course',
  SERVICE_NUMBER: process.env.SERVICE_NUMBER || 'UNKNOWN',
};
