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
	var fs = require('fs');
	var https2 = require('https');

	var testSubscriptionIDs = {}; //PB fix
	var subscriptionIDs = {}; //PB fix

	var when = require('when');
	var token = "";
	var INCLUDEATTR = false;

	var LIMIT = 30;
	var TIMEOUT = 30000; //30 seconds?		
	//var snap_key1= "";
	//var snap_key2= "";
	var elementID = "";


	function OrionService(n) {
		RED.nodes.createNode(this, n);
		var serviceNode = this;

		this.url = n.url;
		this.port = n.port;
		var orionUrl = getOrionUrl(n);
		var credentials = this.credentials;
		//snap_key1= credentials.user;
		//snap_key2=credentials.password;


		credentials.user = "";
		credentials.password = "";


		if (/\/$/.test(this.url)) {
			this.url = this.url.substring(this.url.length - 1);
		}

		var err = "";
		if (((!!credentials.password) != (!!credentials.user))) {
			err = "Missing orion credentials";
		}

		if (!this.port) {
			err = "Missing port";
		}

		if (err) {
			throw err;
		}


		this.init = function (node, n) {
			node.status({
				fill: "blue",
				shape: "dot",
				text: "Initializing"
			});

			return when.promise(function (resolve, reject) {
				// get token from context broker
				getToken(node, serviceNode.url, credentials).then(function () {
					/*util.log("validating broker connectivity");
					validateOrionConnectivity(node, orionUrl).then(function(){
						util.log("cleaning up");
						cleanupTestEnv(node, orionUrl).then(function(){
							util.log("initialization finished");
							resolve();
						});
					});*/
					resolve();
				});
			});
		};

		this.queryContext = function (node, n, payload) {
			node.status({
				fill: "blue",
				shape: "dot",
				text: "Querying data"
			});
			util.log("----------queryContext");
			elementID = payload.entities[0].id;
			var orionBrokerService = RED.nodes.getNode(n.service);
			return when.promise(function (resolve, reject) {

				var options = {
					hostname: orionBrokerService.url,
					port: orionBrokerService.port,
					path: "/v1/queryContext/?limit=" + n.limit + "&elementid=" + elementID + (n.userk1 ? "&k1=" + n.userk1 : "") + (n.passk2 ? "&k2=" + n.passk2 : ""),
					method: 'POST',
					rejectUnauthorized: false,
					headers: {
						'Content-Type': 'application/json',
						'Content-Length': JSON.stringify(payload).length
					}
				};

				var tlsNode = RED.nodes.getNode(n.tls);

				if (tlsNode != null) {
					if (tlsNode.credentials != null) {
						options.key = tlsNode.credentials.keydata;
						options.cert = tlsNode.credentials.certdata;
						options.ca = tlsNode.credentials.cadata;
					}
				}

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

		this.createContext = function (node, n, payload) {
			node.status({
				fill: "blue",
				shape: "dot",
				text: "sending request"
			});
			util.log("----------createContext payload: " + JSON.stringify(payload));
			elementID = payload.contextElements[0].id;

			var orionBrokerService = RED.nodes.getNode(n.service);
			return when.promise(function (resolve, reject) {

				var options = {
					hostname: orionBrokerService.url,
					port: orionBrokerService.port,
					path: "/v1/updateContext/?elementid=" + elementID + (n.userk1 ? "&k1=" + n.userk1 : "") + (n.passk2 ? "&k2=" + n.passk2 : ""),
					method: 'POST',
					rejectUnauthorized: false,
					headers: {
						'Content-Type': 'application/json',
						'Content-Length': JSON.stringify(payload).length
					}
				};

				var tlsNode = RED.nodes.getNode(n.tls);

				if (tlsNode != null) {
					if (tlsNode.credentials != null) {
						options.key = tlsNode.credentials.keydata;
						options.cert = tlsNode.credentials.certdata;
						options.ca = tlsNode.credentials.cadata;
					}
				}

				util.log(options);


				var req = https2.request(options, function (res) {
					util.log('statusCode:', res.statusCode);
					util.log('headers:', res.headers);
					//util.log(res);
					var client = res.client;
					util.log("----------updateContext RESULT: " + res.statusMessage + " " + client.authorizationError);
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

		this.subscribe = function (node, n, payload) {
			node.status({
				fill: "blue",
				shape: "dot",
				text: "subscribing"
			});
			util.log("subscribe in with: " + orionUrl + " with node id: " + node.id);
			var reference = payload.reference;
			elementID = payload.entities[0].id;


			//util.log(RED.nodes.getNode(n.tls));
			var orionBrokerService = RED.nodes.getNode(n.service);
			var options = {
				hostname: orionBrokerService.url,
				port: orionBrokerService.port,
				path: "/v1/subscribeContext/?elementid=" + elementID + (n.userk1 ? "&k1=" + n.userk1 : "") + (n.passk2 ? "&k2=" + n.passk2 : ""),
				method: 'POST',
				rejectUnauthorized: false,
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
					'Content-Length': JSON.stringify(payload).length
				}
			};

			var tlsNode = RED.nodes.getNode(n.tls);

			if (tlsNode != null) {
				if (tlsNode.credentials != null) {
					options.key = tlsNode.credentials.keydata;
					options.cert = tlsNode.credentials.certdata;
					options.ca = tlsNode.credentials.cadata;
				}
			}


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
					util.log("STOP " + msg.payload);
					var parsed = JSON.parse(msg.payload);

					if (JSON.parse(msg.payload).subscribeResponse != null) {
						var subscriptionID = JSON.parse(msg.payload).subscribeResponse.subscriptionId;

						var nodeID = (node.id + "").replace('.', '');
						util.log("---- " + nodeID + " pre subID:" + subscriptionIDs[nodeID]);
						subscriptionIDs[nodeID] = subscriptionID;

						if (subscriptionID) {
							var data = {
								"_id": node.id,
								"subscriptionId": subscriptionID,
								"brokerUrl": orionUrl
							}
						}
					} else if (parsed.result == false) {
						node.status({
							fill: "red",
							shape: "ring",
							text: parsed.message
						});
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

			var errorHandler = function (err, req, res, next) {
				res.sendStatus(500);
			};

			var nodeID = (node.id + "").replace('.', '');
			listenOnUrl(nodeID, function (req, res) {
				util.log("----------------------");
				util.log("+++++++++++++++++++Received response with SUBID: " + req.body.subscriptionId);

				if (req.body.subscriptionId != subscriptionIDs[nodeID]) {
					util.log("Recognized invalid subscription in response body: " + req.body.subscriptionId);
					unsubscribeFromOrion(node, req.body.subscriptionId, orionUrl, n, elementID).then(function (res) {
						//util.log("Unsubscribed invalid subscription: " + req.body.subscriptionId);
						//util.log("Unsubscribed: " + req.body.subscriptionId);
					});
				} else {
					var payload = formatOutput(node, n, req.body);
					util.log("formatted payload: " + payload);
					util.log("node id: " + node.id);
					node.send({
						payload: payload,
						statusCode: 200
					});
				}
				res.sendStatus(200);
				util.log("Send Status 200");
			});

			node.status({
				fill: "blue",
				shape: "dot",
				text: "listening on " + reference
			});

			if (payload) {
				req.write(JSON.stringify(payload));
			}

			req.end();
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

	function unsubscribeFromOrion(node, subscriptionId, url, n, elementID) {
		node.log("in unsubscribeFromOrion with: " + JSON.stringify(subscriptionId));

		var payload = JSON.stringify({
			"subscriptionId": subscriptionId
		});

		//util.log(RED.nodes.getNode(n.tls));
		var orionBrokerService = RED.nodes.getNode(n.service);
		var options = {
			hostname: orionBrokerService.url,
			port: orionBrokerService.port,
			path: "/v1/unsubscribeContext/?elementid=" + elementID + (n.userk1 ? "&k1=" + n.userk1 : "") + (n.passk2 ? "&k2=" + n.passk2 : ""),
			method: 'POST',
			rejectUnauthorized: false,
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
				'Content-Length': JSON.stringify(payload).length
			}
		};

		var tlsNode = RED.nodes.getNode(n.tls);

		if (tlsNode != null) {
			if (tlsNode.credentials != null) {
				options.key = tlsNode.credentials.keydata;
				options.cert = tlsNode.credentials.certdata;
				options.ca = tlsNode.credentials.cadata;
			}
		}

		return when.promise(function (resolve, reject) {


			var req = https2.request(options, function (res) {
				(node.ret === "bin") ? res.setEncoding('binary'): res.setEncoding('utf8');
				var payload = "";
				res.on('data', function (chunk) {
					payload += chunk;
				});
				res.on('end', function () {
					node.status({});
					util.log("Unsubscribed: " + subscriptionId);
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

			req.write(payload);
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

		util.log("MSG: " + JSON.stringify(msg));
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

		n.port = n.port * 1;

		if (!n.enid || !n.entype) {
			err = "Missing subscription parameters";
		}

		if (err) {
			throw err;
		}

		//		n.attributes = n.attributes || '.*';
		n.attributes = n.attributes || [];
		n.condvals = n.condvalues || '.*';

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
			orionUrl = "http://" + orionUrl + ":" + n.port;
		}

		return orionUrl;
	}

	function getCreateTestElementPayload(node) {
		var nodeID = node.id + "";
		nodeID = nodeID.replace('.', '');

		var myval = Math.floor((Math.random() * 100) + 1);

		var payload = {
			"contextElements": [{
				"type": "Test",
				"isPattern": "false",
				"id": nodeID,
				"attributes": [{
					"name": "test",
					"type": "float",
					"value": myval
				}]
			}],
			"updateAction": "APPEND"
		};

		return payload;
	}

	function getDeleteElementPayload(node) {
		var nodeID = node.id + "";
		nodeID = nodeID.replace('.', '');

		var myval = Math.floor((Math.random() * 100) + 1);

		var payload = {
			"contextElements": [{
				"type": "Test",
				"isPattern": "false",
				"id": nodeID
			}],
			"updateAction": "DELETE"
		};

		return payload;
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

	function validateOrionConnectivity(node, orionUrl) {
		var createElementPayload = getCreateTestElementPayload(node);

		if (node.type == "fiware orion in") {
			util.log("doing two way broker connectivity validation");
			return validateOrionConnectivityTwoWays(node, orionUrl, createElementPayload);
		} else {
			util.log("doing one way broker connectivity validation");
			return validateOrionConnectivityOneWay(node, orionUrl, createElementPayload);
		}
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

	function cleanupTestEnv(node, orionUrl) {
		util.log("deleting listener path");
		return when.promise(function (resolve, reject) {

			//delete test context entity, common for both nodes 
			request(node, "POST", getDeleteElementPayload(node), orionUrl + "/v1/updateContext").then(function (res) {});

			if (node.type != "fiware orion in") {
				resolve();
			} else {
				var nodeID = node.id + "";
				nodeID = nodeID.replace('.', '');
				RED.httpNode._router.stack.forEach(function (route, i, routes) {
					if (route.route && route.route.path) {
						routes.splice(i, 1);
					}
				});


				// unsubscribe exisiting subscription from context broker
				unsubscribeFromOrion(node, testSubscriptionIDs[nodeID], orionUrl).then(function (res) {
					resolve({});
				});
			}
		});
	}

	function OrionSubscribe(n) {
		RED.nodes.createNode(this, n);
		this.service = n.service;
		this.brokerConn = RED.nodes.getNode(this.service);
		this.noderedhost = n.noderedhost;

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
								text: "Authentication Problem"
							});
							node.error("failed to query, reason: " + reason);
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