const semver = require('semver');
const merge = require('lodash.merge');
const {NotFound, Conflict, BadRequest, NotImplemented} = require('http-errors')

const registry = {};
const swear = fn => (...args) => Promise.resolve().then(() => fn(...args));

exports.addToRegistry = swear(({service, version, endpoint}) => {
	if(!semver.valid(version)) throw new BadRequest(`${version} is not a valid semver version`);
	if(registry[service] && registry[service][version]) throw new Conflict(`${service}@${version} already exists`);

	merge(registry, {
		[service]: {
			[version]: endpoint,
		},
	});

	return Promise.resolve({service, version, endpoint});
});

exports.getService = swear(service => {
	if(!registry[service]) throw new NotFound(`Service ${service} is not in registry`);
	return registry[service];
});

exports.resolveRegistry = swear(({service, version}) => exports.getService(service).then(serviceEntry => {
	const versions = Object.keys(serviceEntry);
	const match = semver.maxSatisfying(versions, version);
	if(!semver.validRange(version)) throw new BadRequest(`${version} is not a valid semver range`);
	if(!match) throw new NotImplemented(`No compatible version for ${service}@${version}. Available versions: ${versions.join(', ')}`);
	return Promise.resolve(registry[service][match]);
}));
