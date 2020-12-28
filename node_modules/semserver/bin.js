#!/usr/bin/env node

const {
	npm_package_name: service,
	npm_package_version: version,
	npm_package_semserver_host: host,
	SEMSERVER_KEY: apiKey,
} = process.env;

const endpoint = process.argv[2];

console.assert(!!endpoint, 'Usage: semserver endpoint.example.com');

const {post} = require('got');
const logPromise = require('@quarterto/log-promise');
const error = require('./error');

logPromise(
	`registered ${service}@${version} on ${host}`,
	e => e.stack
)(
	post(`http://${host}/${service}/${version}`, {
		body: {endpoint},
		headers: {
			authorization: `Token ${apiKey}`,
		},
	}).catch(error)
).catch(
	() => process.exit(1)
);
