<h1 align="center">
	<img width="600" alt="Semserver" src="images/logo.png"><br>
	<sup>microservice semver registry</sup>
</h1>

Register a service version

```http
> POST /my-service/1.0.0
>
> endpoint=http://my-service-adsfghjk.now.sh
```

and you can query it:

```http
> GET /my-service/^1.0.0/thing/1

< HTTP/1.1 307 Temporary Redirect
< Location: http://my-service-adsfghjk.now.sh/thing/1
```

Register another version

```http
> POST /my-service/1.1.0
>
> endpoint=http://my-service-zxcvbnm.now.sh
```

and you get the latest that satisfies the range:

```http
> GET /my-service/^1.0.0/thing/1

< HTTP/1.1 307 Temporary Redirect
< Location: http://my-service-zxcvbnm.now.sh/thing/1
```

## Server
### Running
Run `npm start`. The server listens on port 7888 by default.

### Deployment
Semserver runs as-is on [now.sh](http://now.sh). Run `now` in the folder to deploy it.

### Authentication
If you want to prevent unauthorized users from registering services, start Semserver with an `APIKEY` environment variable, e.g. `APIKEY=abcdef npm start`, or deploy it with `now -e APIKEY=abcdef`. If the variable is set, requests to register a service will return a `401 Unauthorized` unless you send an `Authorization: Token [apikey]` header.

### Endpoints
#### `POST /:service/:version`

URL parameter | Description
--------------|--------------
`service`     | The name of the service you're registering
`version`     | The version of the service you're registering. Must be a valid Semver version.

Post parameter | Description
---------------|--------------
`endpoint`     | The HTTP endpoint for this version of the service

Registers a version of a service. Once registered, the version is immutable and will always point to this endpoint. Trying to register the same version again will return a `409 Conflict`.

Status code | Description
------------|--------------
`400`       | The version is not a valid semver string
`409`       | The version already exists for this service

#### `OPTIONS /:service`

Returns an object listing the registered versions of the service and their endpoints.

#### `* /:service/:versionOrRange/:path`

URL parameter | Description
--------------|--------------
`service`     | The name of the service you're requesting
`version`     | The version of the service you're requesting. Must be a valid Semver version or version range.
`path`        | The path you're requesting of the service

Resolves a service version and issues a redirect to its endpoint.

If you provide an exact version (e.g. `1.2.3`), you'll get a `308 Permanent Redirect`. Service versions are immutable, so you can guarantee this version will always have this endpoint.

If instead you provide a semver range (e.g. `1.x.x`, `^1.0.0`), you'll get a `307 Temporary Redirect`. Semserver resolves the highest version of the service that matches your version range and redirects to its endpoint.

Status code | Description
------------|--------------
`307`       | Temporary redirect to the highest service version that matches the version range
`308`       | Permanent redirect to the exact version requested
`400`       | The version is not a valid semver range string
`404`       | The service doesn't exist in the registry at all
`501`       | The service has no versions that match the range or exact version you wanted

## Command line

So you can automatically register a service to a registry (e.g. on deploy), we provide a command line script. It's intended to be used as an npm script, and it takes your service name and version from package.json, as well as the registry host, which you should put in package.json as `"semserver": {"host": "semserver.example.com"}`. Finally, pass the endpoint you're registering as the single command line argument.

For example, if you're deploying to [now.sh](https://now.sh), you can use the `now-build` lifecycle script to register your service. Now provides the `NOW_URL` environment variable, so your package.json should look like:

```json
{
	"name": "my-service",
	"version": "1.0.0",
	"scripts": {
		"now-start": "...",
		"now-build": "semserver $NOW_URL"
	},
	"dependencies": {
		"semserver": "^1.0.0"
	},
	"semserver": {
		"host": "semserver.example.com"
	}
}
```

If your semserver has an API key configured, use the environment variable `SEMSERVER_KEY` to tell the CLI about it.

## Client library

We also provide a client library, which is a thin wrapper around [`got`](https://github.com/sindresorhus/got).

### Usage

```js
const semserver = require('semserver');
const registry = semserver('https://semserver.example.com');
const service = registry('my-service', '^1.0.0');

service('/thing/1').then(...);
```

## Licence

ISC. &copy; Matt Brennan
