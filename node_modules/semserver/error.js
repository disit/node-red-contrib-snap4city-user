const HTTPError = require('http-errors');

module.exports = err => Promise.reject(new HTTPError[err.response.statusCode](err.response.body));
