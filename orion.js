/**
 * Copyright 2016 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

/* NODE-RED-CONTRIB-SNAP4CITY-USER    Copyright (C) 2018 DISIT Lab http://www.disit.org - University of Florence     This program is free software: you can redistribute it and/or modify    it under the terms of the GNU Affero General Public License as    published by the Free Software Foundation, either version 3 of the    License, or (at your option) any later version.     This program is distributed in the hope that it will be useful,    but WITHOUT ANY WARRANTY; without even the implied warranty of    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the    GNU Affero General Public License for more details.     You should have received a copy of the GNU Affero General Public License    along with this program.  If not, see <http://www.gnu.org/licenses/>. */
module.exports = function (RED) {
	"use strict";

	var bodyParser = require("body-parser");
	var getBody = require('raw-body');
	var jsonParser = bodyParser.json();
	var urlencParser = bodyParser.urlencoded({
		extended: true
	});
	var typer = require('media-typer');
	var isUtf8 = require('is-utf8');

	var http = require("follow-redirects").http;
	var https = require("follow-redirects").https;
	var urllib = require("url");
	var util = require('util');
	var https2 = require('https');

	var testSubscriptionIDs = {}; //PB fix
	var subscriptionIDs = {}; //PB fix

	var when = require('when');
	var token = "";

	var LIMIT = 30;


	function OrionService(config) {
		RED.nodes.createNode(this, config);
		var serviceNode = this;

		this.url = config.url;
		this.port = config.port;
		var orionUrl = getOrionUrl(config);
		var credentials = {};
		credentials.user = "";
		credentials.password = "";
		if (/\/$/.test(this.url)) {
			this.url = this.url.substring(this.url.length - 1);
		}

		if (!this.port) {
			throw "Missing port";
		}

		this.init = function (node) {
			node.status({
				fill: "blue",
				shape: "dot",
				text: "Initializing"
			});

			return when.promise(function (resolve) {
				// get token from context broker
				getToken(node, serviceNode.url, credentials).then(function () {
					resolve();
				});
			});
		};

		this.queryContext = function (node, config, payload) {
			node.status({
				fill: "blue",
				shape: "dot",
				text: "Querying data"
			});
			util.log("queryContext");
			//elementID = payload.entities[0].id;
			var orionBrokerService = RED.nodes.getNode(config.service);
			return when.promise(function (resolve, reject) {

				var hostname = orionBrokerService.url;
				var prefixPath = "";
				if (hostname.indexOf("http") != -1) {
					var urlWithoutHttp = orionBrokerService.url.replace("https://", "").replace("http://");
					hostname = urlWithoutHttp.substring(0, urlWithoutHttp.indexOf("/"));
					prefixPath = urlWithoutHttp.substring(urlWithoutHttp.indexOf("/"));
					if (prefixPath == hostname) {
						prefixPath = "";
					}
				}

				var options = {
					hostname: hostname,
					port: orionBrokerService.port,
					path: prefixPath + "/v1/queryContext/?limit=" + config.limit + "&elementid=" + config.enid + (config.userk1 ? "&k1=" + config.userk1 : "") + (config.passk2 ? "&k2=" + config.passk2 : ""),
					method: 'POST',
					rejectUnauthorized: false,
					headers: {
						'Content-Type': 'application/json',
						'Content-Length': JSON.stringify(payload).length
					}
				};

				if (config.apikey != null && config.apikey != "") {
					options.headers.apikey = config.apikey;
				}

				if (config.basicAuth != null && config.basicAuth != "") {
					options.headers.Authorization = config.basicAuth;
				}

				var tlsNode = RED.nodes.getNode(config.tls);

				if (tlsNode != null) {
					if (tlsNode.credentials != null) {
						options.key = tlsNode.credentials.keydata;
						options.cert = tlsNode.credentials.certdata;
						options.ca = tlsNode.credentials.cadata;
					}
				}

				console.log(options);

				var msg = {};

				var req = https2.request(options, function (res) {
					(node.ret === "bin") ? res.setEncoding('binary'): res.setEncoding('utf8');
					msg.statusCode = res.statusCode;
					msg.headers = res.headers;
					msg.payload = "";
					res.on('data', function (chunk) {
						msg.payload += chunk;
					});
					res.on('end', function () {
						if (res.statusCode === 200) {
							node.status({});
							resolve(msg);
						} else {
							node.status({
								fill: "red",
								shape: "ring",
								text: res.statusCode
							});
							reject(msg);
						}
					});
				});

				req.on('error', function (err) {
					reject(err);
				});

				req.write(JSON.stringify(payload));
				req.end();
			});

		}

		this.createContext = function (node, config, payload) {
			node.status({
				fill: "blue",
				shape: "dot",
				text: "sending request"
			});
			//util.log("updateContext PAYLOAD: " + JSON.stringify(payload));
			//elementID = payload.contextElements[0].id;

			var orionBrokerService = RED.nodes.getNode(config.service);
			return when.promise(function (resolve, reject) {

				var hostname = orionBrokerService.url;
				var prefixPath = "";
				if (hostname.indexOf("http") != -1) {
					var urlWithoutHttp = orionBrokerService.url.replace("https://", "").replace("http://");
					hostname = urlWithoutHttp.substring(0, urlWithoutHttp.indexOf("/"));
					prefixPath = urlWithoutHttp.substring(urlWithoutHttp.indexOf("/"));
					if (prefixPath == hostname) {
						prefixPath = "";
					}
				}

				var options = {
					hostname: hostname,
					port: orionBrokerService.port,
					path: prefixPath + "/v1/updateContext/?elementid=" + config.enid + (config.userk1 ? "&k1=" + config.userk1 : "") + (config.passk2 ? "&k2=" + config.passk2 : ""),
					method: 'POST',
					rejectUnauthorized: false,
					headers: {
						'Content-Type': 'application/json',
						'Content-Length': JSON.stringify(payload).length
					}
				};

				if (config.apikey != null && config.apikey != "") {
					options.headers.apikey = config.apikey;
				}

				if (config.basicAuth != null && config.basicAuth != "") {
					options.headers.Authorization = config.basicAuth;
				}

				var tlsNode = RED.nodes.getNode(config.tls);

				if (tlsNode != null) {
					if (tlsNode.credentials != null) {
						options.key = tlsNode.credentials.keydata;
						options.cert = tlsNode.credentials.certdata;
						options.ca = tlsNode.credentials.cadata;
					}
				}

				//util.log(options);


				var req = https2.request(options, function (res) {
					var client = res.client;
					//util.log("updateContext RESULT: " + res.statusMessage + " " + client.authorizationError);
					if (res.statusCode != 200) {
						node.status({
							fill: "red",
							shape: "dot",
							text: res.statusMessage
						});
					} else {
						node.status({
							fill: "green",
							shape: "dot",
							text: "success"
						});
					}
					resolve(res);
				});

				req.on('error', function (e) {
					console.error(e);
					node.status({
						fill: "red",
						shape: "ring",
						text: e.code
					});
				});


				req.write(JSON.stringify(payload));

				req.end();

			});
		};

		this.subscribe = function (node, config, payload) {
			node.status({
				fill: "blue",
				shape: "dot",
				text: "subscribing"
			});
			util.log("subscribeContext in: " + orionUrl + " with node id: " + node.id);
			var reference = payload.reference;

			//elementID = payload.entities[0].id;

			var orionBrokerService = RED.nodes.getNode(config.service);
			var hostname = orionBrokerService.url;
			var prefixPath = "";
			if (hostname.indexOf("http") != -1) {
				var urlWithoutHttp = orionBrokerService.url.replace("https://", "").replace("http://");
				hostname = urlWithoutHttp.substring(0, urlWithoutHttp.indexOf("/"));
				prefixPath = urlWithoutHttp.substring(urlWithoutHttp.indexOf("/"));
				if (prefixPath == hostname) {
					prefixPath = "";
				}
			}

			var options = {
				hostname: hostname,
				port: orionBrokerService.port,
				path: prefixPath + "/v1/subscribeContext/?elementid=" + config.enid + (config.userk1 ? "&k1=" + config.userk1 : "") + (config.passk2 ? "&k2=" + config.passk2 : ""),
				method: 'POST',
				rejectUnauthorized: false,
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
					'Content-Length': JSON.stringify(payload).length
				}
			};

			if (config.apikey != null && config.apikey != "") {
				options.headers.apikey = config.apikey;
			}

			if (config.basicAuth != null && config.basicAuth != "") {
				options.headers.Authorization = config.basicAuth;
			}

			var tlsNode = RED.nodes.getNode(config.tls);

			if (tlsNode != null) {
				if (tlsNode.credentials != null) {
					options.key = tlsNode.credentials.keydata;
					options.cert = tlsNode.credentials.certdata;
					options.ca = tlsNode.credentials.cadata;
				}
			}

			console.log(options);

			var msg = {};

			var req = https2.request(options, function (res) {
				(node.ret === "bin") ? res.setEncoding('binary'): res.setEncoding('utf8');
				msg.statusCode = res.statusCode;
				msg.headers = res.headers;
				msg.payload = "";
				res.on('data', function (chunk) {
					msg.payload += chunk;
				});
				res.on('end', function () {

					util.log("subscribeContext RESULT: " + res.statusMessage);

					try {
						var parsedResponse = JSON.parse(msg.payload);

						if (parsedResponse.subscribeResponse != null) {
							var subscriptionID = parsedResponse.subscribeResponse.subscriptionId;

							var nodeID = (node.id + "").replace('.', '');
							util.log("elementId: " + config.enid + " nodeId: " + nodeID + " oldSubId: " + subscriptionIDs[nodeID] + " newSubId: " + subscriptionID);
							var idToUnsubscribe = subscriptionIDs[nodeID];
							if (typeof subscriptionIDs[nodeID] != "undefined") {
								setTimeout(function () {
									unsubscribeFromOrion(node, idToUnsubscribe, orionUrl, config);
								}, 2000);
							}
							subscriptionIDs[nodeID] = subscriptionID;

						} else if (parsedResponse.result == false) {
							node.status({
								fill: "red",
								shape: "ring",
								text: parsedResponse.message
							});
						}
					} catch (e) {
						node.error(msg.payload);
					}
				});
			});

			req.on('error', function (err) {
				msg.payload = err.toString();
				msg.statusCode = err.code;
				node.send(msg);
				node.status({
					fill: "red",
					shape: "ring",
					text: err.code
				});
			});

			node.status({
				fill: "blue",
				shape: "dot",
				text: "listening on " + reference
			});

			if (payload) {
				util.log(payload);
				req.write(JSON.stringify(payload));
			}

			req.end();

			var nodeID = (node.id + "").replace('.', '');
			listenOnUrl(nodeID, function (req, res) {
				if (req.body.subscriptionId != subscriptionIDs[nodeID]) {
					util.log("Recognized invalid subscription: " + req.body.subscriptionId + " currentId: " + subscriptionIDs[nodeID]);
					unsubscribeFromOrion(node, req.body.subscriptionId, orionUrl, config);
				} else {
					var payload = formatOutput(node, config, req.body);
					node.send({
						payload: payload,
						statusCode: 200
					});
				}
				res.sendStatus(200);
			});
		};
	}

	RED.nodes.registerType("orion-service", OrionService, {
		credentials: {
			user: {
				type: "text"
			},
			password: {
				type: "password"
			}
		}
	});

	function unsubscribeFromOrion(node, subscriptionId, url, config) {
		node.log("in unsubscribeFromOrion with: " + JSON.stringify(subscriptionId));

		var payload = {
			"subscriptionId": subscriptionId
		};

		util.log("elementid " + config.enid + " k1 " + config.userk1 + " k2 " + config.passk2);
		var orionBrokerService = RED.nodes.getNode(config.service);
		return when.promise(function (resolve, reject) {
			var hostname = orionBrokerService.url;
			var prefixPath = "";
			if (hostname.indexOf("http") != -1) {
				var urlWithoutHttp = orionBrokerService.url.replace("https://", "").replace("http://");
				hostname = urlWithoutHttp.substring(0, urlWithoutHttp.indexOf("/"));
				prefixPath = urlWithoutHttp.substring(urlWithoutHttp.indexOf("/"));
				if (prefixPath == hostname) {
					prefixPath = "";
				}
			}

			var options = {
				hostname: hostname,
				port: orionBrokerService.port,
				path: prefixPath + "/v1/unsubscribeContext/?elementid=" + config.enid + (config.userk1 ? "&k1=" + config.userk1 : "") + (config.passk2 ? "&k2=" + config.passk2 : ""),
				method: 'POST',
				rejectUnauthorized: false,
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
					'Content-Length': JSON.stringify(payload).length
				}
			};

			if (config.apikey != null && config.apikey != "") {
				options.headers.apikey = config.apikey;
			}

			if (config.basicAuth != null && config.basicAuth != "") {
				options.headers.Authorization = config.basicAuth;
			}

			util.log(options);

			var tlsNode = RED.nodes.getNode(config.tls);

			if (tlsNode != null) {
				if (tlsNode.credentials != null) {
					options.key = tlsNode.credentials.keydata;
					options.cert = tlsNode.credentials.certdata;
					options.ca = tlsNode.credentials.cadata;
				}
			}

			var req = https2.request(options, function (res) {
				(node.ret === "bin") ? res.setEncoding('binary'): res.setEncoding('utf8');
				var response = "";
				res.on('data', function (chunk) {
					response += chunk;
				});
				res.on('end', function () {
					util.log("elementId: " + config.enid + " Unsubscribed: " + subscriptionId + " Response: " + response);
					resolve({});
				});
			});

			req.on('error', function (err) {
				node.status({
					fill: "red",
					shape: "ring",
					text: err.code
				});
				reject(err.toString());
			});
			util.log("SEND DATA FOR UNSUBSCRIBE: " + JSON.stringify(payload));
			req.write(JSON.stringify(payload));
			req.end();
		});
	}

	// retrieve token from context broker
	function getToken(node, orionUrl, credentials) {
		var tokenUrl = orionUrl + "/token";
		if (tokenUrl.indexOf("http://") >= 0) {
			tokenUrl = "https://" + tokenUrl.substring(7);
		} else if (orionUrl.indexOf("https://") < 0) {
			tokenUrl = "https://" + tokenUrl;
		}

		var opts = urllib.parse(tokenUrl);

		opts.method = "POST";
		opts.headers = {};
		opts.headers['content-type'] = "application/json";
		opts.headers["Accept"] = "application/json";
		var payload = {
			"username": credentials.user,
			"password": credentials.password
		};

		payload = JSON.stringify(payload);

		opts.headers['content-length'] = payload.length;
		token = "";

		return when.promise(function (resolve, reject) {
			if (!credentials.user) {
				resolve();
			} else {
				util.log("--requesting token using payload: " + payload);
				var req = (https).request(opts, function (res) {
					(node.ret === "bin") ? res.setEncoding('binary'): res.setEncoding('utf8');

					res.on('data', function (chunk) {
						token += chunk;
					});

					res.on('end', function () {
						util.log("--resolved token: " + token);
						resolve(token);
					});
				});

				req.on('error', function (err) {
					reject(err);
					node.status({
						fill: "red",
						shape: "ring",
						text: err.code
					});
					node.send({
						payload: err.toString() + " : " + tokenUrl,
						statusCode: err.code
					});
				});

				req.write(payload);
				req.end();
			}
		});
	}

	function formatOutput(node, n, msg) {

		//util.log("MSG: " + JSON.stringify(msg));
		var contextResponses = msg.contextResponses;
		var payload = [];

		contextResponses.forEach(function (entry) {
			var contextElement = entry.contextElement;
			delete contextElement.isPattern;
			if (!n.includeattr) {
				// removing attribute metadata
				node.log("cleaning contextElement.attributes: " + JSON.stringify(contextElement.attributes));
				contextElement.attributes.forEach(function (entry) {
					node.log("deleting: " + JSON.stringify(entry.metadatas));
					delete entry.metadatas;
				});
			}

			payload.push(contextElement);
		});

		return payload;
	}

	function rawBodyParser(req, res, next) {
		if (req._body) {
			return next();
		}
		req.body = "";
		req._body = true;

		var isText = true;
		var checkUTF = false;

		if (req.headers['content-type']) {
			var parsedType = typer.parse(req.headers['content-type'])
			if (parsedType.type === "text") {
				isText = true;
			} else if (parsedType.subtype === "xml" || parsedType.suffix === "xml") {
				isText = true;
			} else if (parsedType.type !== "application") {
				isText = false;
			} else if (parsedType.subtype !== "octet-stream") {
				checkUTF = true;
			}
		}

		getBody(req, {
			length: req.headers['content-length'],
			encoding: isText ? "utf8" : null
		}, function (err, buf) {
			if (err) {
				return next(err);
			}
			if (!isText && checkUTF && isUtf8(buf)) {
				buf = buf.toString()
			}

			req.body = buf;
			next();
		});
	}

	function validateInput(node, n) {
		var err = null;
		n.url = n.url;
		n.port = n.port;
		n.enid = n.enid;
		n.entype = n.entype;
		n.ispattern = n.ispattern;
		n.userk1 = n.userk1;
		n.passk2 = n.passk2;
		n.apikey = n.apikey;
		n.basicAuth = n.basicAuth;
		n.attributes = n.attributes;
		n.condvalues = n.condvalues;
		n.includeattr = n.includeattr;
		n.port = n.port * 1;

		if (!n.enid || !n.entype) {
			err = "Missing subscription parameters";
		}

		if (err) {
			throw err;
		}

		n.attributes = n.attributes || [];
		if (n.attributes.constructor !== Array) {
			n.attributes = (n.attributes || "").split(",");
			for (var i = 0; i < n.attributes.length; i++) {
				n.attributes[i] = n.attributes[i].trim();
			}
		}

		n.condvalues = n.condvalues || [];
		if (n.condvalues.constructor !== Array) {
			n.condvalues = (n.condvalues || "").split(",");
			for (var i = 0; i < n.condvalues.length; i++) {
				n.condvalues[i] = n.condvalues[i].trim();
			}
		}

	}

	function getSubscribePayload(node, n) {
		// prepare payload for context subscription
		// contains node uid and url besides data supplied in node fields

		var nodeID = node.id + "";
		nodeID = nodeID.replace('.', '');

		return when.promise(
			function (resolve, reject) {
				getMyUri(n).then(function (myUri) {
					resolve({
						"entities": [{
							"type": n.entype,
							"isPattern": n.ispattern,
							"id": n.enid
						}],
						"attributes": n.attributes,
						"reference": "http://" + myUri + "/" + nodeID,
						"duration": n.duration,
						"notifyConditions": [{
							"type": "ONCHANGE",
							"condValues": n.condvals
						}],
						"throttling": n.throttle
					});
				})
			}
		);
	}

	function getOrionUrl(n) {
		var orionUrl = n.url;

		if (!/^((http|https):\/\/)/.test(orionUrl)) {
			orionUrl = "https://" + orionUrl + ":" + n.port;
		}

		return orionUrl;
	}

	function request(node, method, payload, url) {
		util.log("URL:  " + url);
		var opts = urllib.parse(url);

		opts.method = method; //"POST";
		opts.headers = {};
		opts.headers['Content-Type'] = "application/json";
		opts.headers["Accept"] = "application/json";
		payload = JSON.stringify(payload);

		opts.headers['content-length'] = payload.length;
		if (token) {
			opts.headers["X-Auth-Token"] = token;
		}

		return when.promise(function (resolve, reject) {
			var req = ((/^https/.test(url)) ? https : http).request(opts, function (res) {
				(node.ret === "bin") ? res.setEncoding('binary'): res.setEncoding('utf8');

				var result = "";
				res.on('data', function (chunk) {
					result += chunk;
				});

				res.on('end', function () {
					resolve(JSON.parse(result));
				});
			});

			req.on('error', function (err) {
				reject(err);
				node.status({
					fill: "red",
					shape: "ring",
					text: err.code
				});
				node.send({
					payload: err.toString(),
					statusCode: err.code
				});
			});

			req.write(payload);
			req.end();
		});
	}

	// To validate two ways connectivity following flow implemented	
	// init: 
	// 1. (v) create context element of type Test with id: node uid
	// 2. temporary subscribe to changes to that element

	// action:
	// 3. change test element
	// 4. validate update message received

	// #cleanup
	// 5. delete element
	// 6. delete subscription
	function validateOrionConnectivityTwoWays(node, orionUrl, createElementPayload) {
		var nodeID = node.id + "";
		nodeID = nodeID.replace('.', '');

		return when.promise(function (resolve, reject) {
			listenOnUrl(nodeID, function (req, res) {
				var result = req.body;
				var testSubscriptionID = testSubscriptionIDs[nodeID]; //PB fix

				/*PB commentato forza la validazione
				if(result.subscriptionId != testSubscriptionID){
                	util.log(nodeID+" result.subscriptionId: " + result.subscriptionId + "!=" + testSubscriptionID);
                	node.error("Communication with context broker failed: received wrong subId");
					unsubscribeFromOrion(node, result.subscriptionId, orionUrl).then(function(res){
						util.log("Unsubscribed invalid subscription: " + result.subscriptionId + " res: " + JSON.stringify(res));
					});
					unsubscribeFromOrion(node, testSubscriptionID, orionUrl).then(function(res){
						util.log("Unsubscribed test subscription: " + testSubscriptionID + " res: " + JSON.stringify(res));
					});
					
                	reject("Communication with context broker failed");
                }else{*/
				util.log(nodeID + " result.subscriptionId: " + result.subscriptionId + "==" + testSubscriptionID);
				resolve();
				//}
			});

			request(node, "POST", createElementPayload, orionUrl + "/v1/updateContext").then(function (result) {

				getSubscribeTestPayload(node).then(function (subscribePayload) {
					request(node, "POST", subscribePayload, orionUrl + "/v1/subscribeContext").then(function (subscription) {

						try {
							var testSubscriptionID = subscription.subscribeResponse.subscriptionId
							util.log(node.id + " " + nodeID + " pre test:" + testSubscriptionIDs[nodeID]);
							testSubscriptionIDs[nodeID] = testSubscriptionID;

							if (testSubscriptionID) {
								var data = {
									"_id": "test_" + node.id,
									"subscriptionId": testSubscriptionID,
									"brokerUrl": orionUrl
								}
							}

						} catch (e) {
							node.error(RED._("httpin.errors.json-error"));
							reject(e);
						}
					});
				});
			});
		});
	}

	function validateOrionConnectivityOneWay(node, orionUrl, createElementPayload) {
		util.log("in validateOrionConnectivityOneWay with createElementPayload: " + JSON.stringify(createElementPayload));

		return when.promise(function (resolve, reject) {
			request(node, "POST", createElementPayload, orionUrl + "/v1/updateContext").then(function (result) {
				rcValidate(200, result, reject);
				resolve();
			});
		});
	}

	function rcValidate(expected, result, reject) {
		var rc = result.contextResponses[0].statusCode.code;
		if (rc != expected) {
			reject("Return Code: " + rc + " is not " + expected)
		}
	}

	function OrionSubscribe(n) {
		RED.nodes.createNode(this, n);
		this.service = n.service;
		this.brokerConn = RED.nodes.getNode(this.service);
		this.noderedhost = n.noderedhost;
		this.userk1 = n.userk1;
		this.passk2 = n.passk2;
		this.apikey = n.apikey;
		this.basicAuth = n.basicAuth;

		var node = this;

		this.on("close", function () {
			var node = this;

			var nodeID = node.id + "";
			nodeID = nodeID.replace('.', '');

			RED.httpNode._router.stack.forEach(function (route, i, routes) {
				if (route.route && route.route.path == "/" + nodeID) {
					routes.splice(i, 1);
				}
			});

			unsubscribeFromOrion(node, subscriptionIDs[nodeID], null, n);
		});

		// validate mandatory fields
		validateInput(this, n);


		node.brokerConn.init(node, n).then(function () {
			getSubscribePayload(node, n).then(function (payload) {
				node.brokerConn.subscribe(node, n, payload);
			});
		});
	}

	//Register OrionSubscribe node
	RED.nodes.registerType("fiware orion in", OrionSubscribe, {
		credentials: {
			user: {
				type: "text"
			},
			password: {
				type: "password"
			}
		}
	});

	function listenOnUrl(url, callback) {
		var errorHandler = function (err, req, res, next) {
			res.sendStatus(500);
		};

		var next = function (req, res, next) {
			next();
		}

		// will listen on 'localhost/url' for notifications from context broker and call callback function
		RED.httpNode.post("/" + url, next, next, next, jsonParser, urlencParser, rawBodyParser, callback, errorHandler);
	}

	function getSubscribeTestPayload(node, n) {
		// prepare payload for context subscription
		// contains node uid and url besides data supplied in node fields

		var nodeID = node.id + "";
		nodeID = nodeID.replace('.', '');

		return when.promise(
			function (resolve, reject) {
				getMyUri(node).then(function (myUri) {
					util.log("myUri: " + myUri);
					resolve({
						"entities": [{
							"type": "Test",
							"isPattern": "false",
							"id": nodeID
						}],
						"attributes": "test",
						"reference": "http://" + myUri + "/" + nodeID,
						"duration": "PT30S",
						"notifyConditions": [{
							"type": "ONCHANGE",
							"condValues": ["test"]
						}],
						"throttling": "PT5S"
					});
				});
			});
	}

	function getMyUri(node) {
		return when.promise(
			function (resolve, reject) {

				// first try to get user specified uri, TODO: many input validations...
				var myUri = node.noderedhost;
				if (myUri) {
					resolve(myUri + RED.settings.httpRoot /*+ ":" + RED.settings.uiPort*/ ); //PB removed port
				} else {
					myUri = RED.settings.externalHost; //PB fix added
					if (myUri)
						resolve(myUri + RED.settings.httpRoot /*+ ":" + RED.settings.uiPort*/ ); //PB remove port
					else {
						// attempt to get from bluemix
						try {
							var app = JSON.parse(process.env.VCAP_APPLICATION);
							myUri = app['application_uris'][0];
						} catch (e) {
							util.log("Probably not running in bluemix...");
						}
					}
				}

				if (myUri) {
					resolve(myUri);
				} else {
					var net = require('net');
					var client = net.connect({
							port: 80,
							host: "google.com"
						},
						function () {
							if (!client.localAddress) {
								reject("Failed to get local address");
							} else {
								resolve(client.localAddress + ":" + RED.settings.uiPort);
							}
						}
					);
				}
			}
		);
	}

	//////Orion-request node constructor
	function Orion(n) {
		RED.nodes.createNode(this, n);

		this.on("input", function (msg) {
			this.service = n.service;
			this.brokerConn = RED.nodes.getNode(this.service);
			var node = this;

			// process input from UI and input pipe
			processInput(this, n, msg);

			// create json payload for context request
			var payload = {
				"entities": [{
					"type": n.entype,
					"isPattern": true,
					"id": n.enid
				}],
				"attributes": n.attributes
			};

			if (n.rtype && n.rvalue) {
				payload.restriction = {
					"scopes": [{
						"type": n.rtype,
						"value": n.rvalue
					}]
				};
			}

			try {
				node.brokerConn.init(node, n).then(function () {
					node.brokerConn.queryContext(node, n, payload).then(
						function (msg) {
							msg = formatOutput(node, n, JSON.parse(msg.payload));

							node.status({
								fill: "green",
								shape: "dot",
								text: "success"
							});

							/*var cred_json = {
					        	   "key1": snap_key1,
					        	   "key2": snap_key2
					           	};
								
								var topic =  JSON.stringify(cred_json);
								util.log("TOPIC" + topic);*/

							node.send({
								payload: msg,
								statusCode: 200
							});
						},
						function (reason) {
							node.status({
								fill: "red",
								shape: "ring",
								text: "Problem, check debug tab"
							});
							node.error("failed to query, reason: " + JSON.stringify(reason));
						}
					);
				});
			} catch (err) {
				node.error(err, msg);
				node.send({
					payload: err.toString(),
					statusCode: err.code
				});
			}
		});
	}

	// register node
	RED.nodes.registerType("fiware orion", Orion, {
		credentials: {
			user: {
				type: "text"
			},
			password: {
				type: "password"
			},
			token: {
				type: "text"
			}
		}
	});

	function processInput(node, n, msg) {
		n.url = n.url || msg.url;
		n.port = n.port || msg.port;
		n.enid = n.enid || msg.enid || ".*";
		n.entype = n.entype || msg.entype;
		n.limit = n.limit || msg.limit || LIMIT;
		n.userk1 = n.userk1 || msg.userk1;
		n.passk2 = n.passk2 || msg.passk2;
		n.apikey = n.apikey || msg.apikey;
		n.basicAuth = n.basicAuth || msg.basicAuth;
		n.attributes = n.attributes || msg.attributes;
		n.ispattern = n.ispattern || msg.ispattern || false;
		n.includeattr = n.includeattr || msg.includeattr;

		n.rtype = n.rtype || msg.rtype;
		n.rvalue = n.rvalue || msg.rvalue;

		if (n.rtype && !n.rvalue) {
			n.rvalue = "entity::type";
		}

		//	n.attributes = n.attributes || '.*';
		n.attributes = n.attributes || [];
		if (n.attributes.constructor !== Array) {
			n.attributes = (n.attributes || "").split(",");
			for (var i = 0; i < n.attributes.length; i++) {
				n.attributes[i] = n.attributes[i].trim();
			}
		}
	}

	// register node
	RED.nodes.registerType("orion-test", OrionTest);

	//Orion-test node constructor
	function OrionTest(n) {
		RED.nodes.createNode(this, n);

		this.on("input", function (msg) {
			this.service = n.service;
			this.brokerConn = RED.nodes.getNode(this.service);
			var node = this;

			// create json payload for context update
			var payload = generateCreateElementPayload(node, n, msg);

			try {
				node.brokerConn.init(node, n).then(function () {
					node.brokerConn.createContext(node, n, payload).then(
						function (msg) {},
						function (reason) {
							node.error("failed to create, reason: " + reason);
						}
					);
				});
			} catch (err) {
				node.error(err, msg);
				node.send({
					payload: err.toString(),
					statusCode: err.code
				});
			}
		});
	}

	function generateCreateElementPayload(node, n, msg) {
		util.log("msg: " + JSON.stringify(msg));

		var attributes = [];
		if (n.attrkey && n.attrvalue) {
			var name = n.attrkey.trim();
			var value = n.attrvalue.trim();
			attributes.push({
				name,
				value
			});
		} else {
			attributes = msg.attributes;
		}

		if (!attributes) {
			throw "Missing 'attributes' property";
		}

		util.log("attributes2: " + attributes);
		var payload = {
			"contextElements": [{
				"type": n.entype,
				"isPattern": "false",
				"id": n.enid,
				"attributes": attributes
			}],
			"updateAction": "APPEND"
		};

		return payload;
	}


	// register node
	RED.nodes.registerType("fiware-orion-out", FiwareOrionOut);

	//Orion-test node constructor
	function FiwareOrionOut(n) {
		RED.nodes.createNode(this, n);

		this.on("input", function (msg) {
			this.service = n.service;
			this.brokerConn = RED.nodes.getNode(this.service);
			var node = this;
			try {
				if (typeof msg.payload == "string") {
					msg.payload = JSON.parse(msg.payload);
				}
				if (typeof msg.payload.length == "undefined" && typeof msg.payload.name != "undefined" && typeof msg.payload.value != "undefined") {
					msg.payload = [msg.payload];
				}

				// create json payload for context update
				//var payload = generateCreateElementPayload(node, n, msg);
				var payload = {
					"contextElements": [{
						"type": n.entype,
						"isPattern": "false",
						"id": n.enid,
						"attributes": msg.payload
					}],
					"updateAction": "APPEND"
				};
				try {
					node.brokerConn.init(node, n).then(function () {
						node.brokerConn.createContext(node, n, payload).then(
							function (msg) {},
							function (reason) {
								node.error("failed to create, reason: " + reason);
							}
						);
					});
				} catch (err) {
					node.error(err, msg);
					node.send({
						payload: err.toString(),
						statusCode: err.code
					});
				}
			} catch (e) {
				node.status({
					fill: "red",
					shape: "ring",
					text: "Problem with input msg"
				});
			}
		});
	}
}