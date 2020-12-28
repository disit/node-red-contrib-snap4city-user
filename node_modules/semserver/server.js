const express = require('express');
const semver = require('semver');
const bodyParser = require('body-parser');
const {Unauthorized} = require('http-errors')
const url = require('url');
const {addToRegistry, resolveRegistry, getService} = require('./registry');

const app = express();

const port = process.env.PORT || 7888;
const auth = (req, res, next) => next(process.env.APIKEY && req.headers.authorization !== `Token ${process.env.APIKEY}` && new Unauthorized('Bad API key'));

app.options('/:service', (req, res, next) => getService(req.params.service)
	.then(service => res.json(service))
	.catch(next)
);

app.post('/:service/:version', auth, bodyParser.urlencoded({extended: false}), (req, res, next) => {
	const {service, version} = req.params;
	const {endpoint} = req.body;
	addToRegistry({service, version, endpoint})
		.then(o => res.json(o))
		.catch(next);
});

app.all('/:service/:version/*', (req, res, next) => {
	const {service, version, 0: path} = req.params;

	resolveRegistry({service, version}).then(endpoint => {
		res.redirect(
			semver.valid(version) ? 308 : 307, // permanent redirect for exact version
			url.resolve(endpoint, path)
		);
	}).catch(next);
});

app.use((err, req, res, next) => {
	res.status(err.status || 500);
	res.send(err.message);
	next(err);
});

app.listen(port, () => console.log(`⛭ listening on port ${port}`));
