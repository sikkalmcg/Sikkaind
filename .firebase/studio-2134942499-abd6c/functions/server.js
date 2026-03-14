const { onRequest } = require('firebase-functions/v2/https');
  const server = import('firebase-frameworks');
  exports.ssrstudio2134942499abd6 = onRequest({}, (req, res) => server.then(it => it.handle(req, res)));
  