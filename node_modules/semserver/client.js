const got = require('got');
const error = require('./error');

module.exports = registry => (service, version) => (path, options = {}) => got(
	`${registry}/${service}/${version}/${path}`,
	options
).catch(error);
