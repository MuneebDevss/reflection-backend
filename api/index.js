let cachedHandler;

module.exports = async (req, res) => {
  if (!cachedHandler) {
    const mod = require('../dist/src/api/index.js');
    cachedHandler = mod.default || mod.handler;
  }
  return cachedHandler(req, res);
};