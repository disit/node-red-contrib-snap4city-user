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

			var s4cUtility = require("./snap4city-utility.js");
			const logger = s4cUtility.getLogger(RED, node);
			const uid = s4cUtility.retrieveAppID(RED);
			var accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid);

			node.status({
				fill: "blue",
				shape: "dot",
				text: "Querying data"
			});
			logger.info("queryContext, entityID: " + config.enid);
			logger.debug("queryContext, payload: " + JSON.stringify(payload));

			var orionBrokerService = RED.nodes.getNode(config.service);
			return when.promise(function (resolve, reject) {

				getContextBrokerListForRegisterActivity(node, orionBrokerService.url, orionBrokerService.port, config.enid, uid, accessToken);

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
						'Authorization': 'Bearer ' + accessToken, //by default, we insert the Snap4City SSo AccessToken, that can be overrided by the config.basicAuth
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
				
				if (config.tenant != null && config.tenant != "") {
					options.headers["Fiware-Service"]=config.tenant;
					options.headers["Fiware-ServicePath"]=config.servicepath;
				}

				var tlsNode = RED.nodes.getNode(config.tls);

				if (tlsNode != null) {
					if (tlsNode.credentials != null) {
						options.key = tlsNode.credentials.keydata;
						options.cert = tlsNode.credentials.certdata;
						options.ca = tlsNode.credentials.cadata;
						options.rejectUnauthorized = tlsNode.verifyservercert;
					}
				}

				logger.debug("queryContext options:" + JSON.stringify(options));

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
							resolve(msg);
						} else {
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

		this.updateContext = function (node, config, payload, auth) {

			var k1 = (auth && auth.k1) ? auth.k1 : ((config.userk1) ? config.userk1 : undefined);
			var k2 = (auth && auth.k2) ? auth.k2 : ((config.passk2) ? config.passk2 : undefined);
			var apikey = (auth && auth.apikey) ? auth.apikey : ((config.apikey) ? config.apikey : undefined);
			var basicAuth = (auth && auth.basicAuth) ? auth.basicAuth : ((config.basicAuth) ? config.basicAuth : undefined);

			var s4cUtility = require("./snap4city-utility.js");
			const logger = s4cUtility.getLogger(RED, node);
			const uid = s4cUtility.retrieveAppID(RED);
			var accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid);

			node.status({
				fill: "blue",
				shape: "dot",
				text: "Sending data"
			});
			logger.info("updateContext, entityID: " + payload.contextElements[0].id);
			logger.debug("updateContext, payload: " + JSON.stringify(payload));
			var orionBrokerService = RED.nodes.getNode(config.service);
			return when.promise(function (resolve, reject) {

				getContextBrokerListForRegisterActivity(node, orionBrokerService.url, orionBrokerService.port, payload.contextElements[0].id, uid, accessToken);

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
					path: prefixPath + "/v1/updateContext/?elementid=" + payload.contextElements[0].id + (k1 ? "&k1=" + k1 : "") + (k2 ? "&k2=" + k2 : ""),
					method: 'POST',
					rejectUnauthorized: false,
					headers: {
						'Authorization': 'Bearer ' + accessToken, //by default, we insert the Snap4City SSo AccessToken, that can be overrided by the config.basicAuth
						'Content-Type': 'application/json',
						'Content-Length': JSON.stringify(payload).length
					}
				};

				if (apikey) {
					options.headers.apikey = apikey;
				}

				if (basicAuth) {
					options.headers.Authorization = basicAuth;
				}
				
				if (config.tenant != null && config.tenant != "") {
					options.headers["Fiware-Service"]=config.tenant;
					options.headers["Fiware-ServicePath"]=config.servicepath;
				}

				var tlsNode = RED.nodes.getNode(config.tls);

				if (tlsNode != null) {
					if (tlsNode.credentials != null) {
						options.key = tlsNode.credentials.keydata;
						options.cert = tlsNode.credentials.certdata;
						options.ca = tlsNode.credentials.cadata;
						options.rejectUnauthorized = tlsNode.verifyservercert;
					}
				}

				logger.debug("updateContext options:" + JSON.stringify(options));

				var msg = {};

				var req = https2.request(options, function (res) {
					msg.statusCode = res.statusCode;
					msg.headers = res.headers;
					msg.payload = "";
					res.on('data', function (chunk) {
						msg.payload += chunk;
					});
					res.on('end', function () {
						if (res.statusCode === 200) {
							resolve(msg);
						} else {
							reject(msg);
						}
					});
				});

				req.on('error', function (e) {
					reject(e);
				});

				req.write(JSON.stringify(payload));
				req.end();
			});
		};

		this.subscribe = function (node, config, payload) {

			var s4cUtility = require("./snap4city-utility.js");
			const logger = s4cUtility.getLogger(RED, node);
			const uid = s4cUtility.retrieveAppID(RED);
			var accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid, false);

			node.status({
				fill: "blue",
				shape: "dot",
				text: "Subscribing"
			});
			logger.info("subscribeContext, entityID: " + config.enid);
			logger.debug("subscribeContext, payload: " + JSON.stringify(payload));
			var reference = payload.reference;
			var orionBrokerService = RED.nodes.getNode(config.service);

			getContextBrokerListForRegisterActivity(node, orionBrokerService.url, orionBrokerService.port, config.enid, uid, accessToken);

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
					'Authorization': 'Bearer ' + accessToken, //by default, we insert the Snap4City SSo AccessToken, that can be overrided by the config.basicAuth			
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

			if (config.tenant != null && config.tenant != "") {
				options.headers["Fiware-Service"]=config.tenant;
				options.headers["Fiware-ServicePath"]=config.servicepath;
			}

			var tlsNode = RED.nodes.getNode(config.tls);

			if (tlsNode != null) {
				if (tlsNode.credentials != null) {
					options.key = tlsNode.credentials.keydata;
					options.cert = tlsNode.credentials.certdata;
					options.ca = tlsNode.credentials.cadata;
					options.rejectUnauthorized = tlsNode.verifyservercert;
				}
			}

			logger.debug("subscribeContext options:" + JSON.stringify(options));

			try {
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
						logger.info("subscribeContext result:" + msg.statusCode + " " + msg.payload);

						if (res.statusCode === 200) {
							var parsedResponse = JSON.parse(msg.payload);

							if (parsedResponse.subscribeResponse != null) {
								var subscriptionID = parsedResponse.subscribeResponse.subscriptionId;
								logger.info("subs debug:"+subscriptionID);

								var nodeID = (node.id + "").replace('.', '');

								//listen subscription just if the return code is 200ok
								listenOnUrl(nodeID, function (req, res) {
									if (req.body.subscriptionId != subscriptionIDs[nodeID]) {
										logger.error("Recognized invalid subscription: " + req.body.subscriptionId + " currentId: " + subscriptionIDs[nodeID]);
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
								
								logger.info("subscribeContext elementId: " + config.enid + " nodeId: " + nodeID + " oldSubId: " + subscriptionIDs[nodeID] + " newSubId: " + subscriptionID);
								var idToUnsubscribe = subscriptionIDs[nodeID];//save previous sub for unsub
								subscriptionIDs[nodeID] = subscriptionID;//update new subs
								if (idToUnsubscribe != undefined) {//if there was a previous sub
									logger.info("unsubscription:"+idToUnsubscribe);
									setTimeout(function () {
										unsubscribeFromOrion(node, idToUnsubscribe, orionUrl, config);//unsub previous sub
									}, 2000);
								}					
							} else if (parsedResponse.result == false) {
								logger.error("subscribeContext error:" + JSON.stringify(msg));
								node.status({
									fill: "red",
									shape: "ring",
									text: getErrorMessage(msg)
								});
								node.error(msg);
							}
						} else {
							logger.error("subscribeContext error:" + JSON.stringify(msg));
							node.status({
								fill: "red",
								shape: "ring",
								text: getErrorMessage(msg)
							});
							node.error(msg);
						}
					});
				});
				req.on('error', function (err) {
					logger.error("subscribeContext error:" + err);
					node.status({
						fill: "red",
						shape: "ring",
						text: getErrorMessage(err)
					});
					node.error(err);
				});

				node.status({
					fill: "blue",
					shape: "dot",
					text: "listening on " + reference
				});

				if (payload) {
					logger.debug("subscribeContext payload:" + JSON.stringify(payload));
					req.write(JSON.stringify(payload));
				}

				req.end();

			} catch (err) {
				logger.error("subscribeContext error:" + err);
				node.status({
					fill: "red",
					shape: "ring",
					text: getErrorMessage(err)
				});
				node.error(err);
			}
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

		var s4cUtility = require("./snap4city-utility.js");
		const logger = s4cUtility.getLogger(RED, node);
		const uid = s4cUtility.retrieveAppID(RED);
		var accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid);

		logger.debug("unsubscribeFromOrion with: " + JSON.stringify(subscriptionId));

		var payload = {
			"subscriptionId": subscriptionId
		};

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
					'Authorization': 'Bearer ' + accessToken, //by default, we insert the Snap4City SSo AccessToken, that can be overrided by the config.basicAuth			
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
			
			if (config.tenant != null && config.tenant != "") {
				options.headers["Fiware-Service"]=config.tenant;
				options.headers["Fiware-ServicePath"]=config.servicepath;
			}

			var tlsNode = RED.nodes.getNode(config.tls);

			if (tlsNode != null) {
				if (tlsNode.credentials != null) {
					options.key = tlsNode.credentials.keydata;
					options.cert = tlsNode.credentials.certdata;
					options.ca = tlsNode.credentials.cadata;
					options.rejectUnauthorized = tlsNode.verifyservercert;
				}
			}

			logger.debug("unsubscribeContext options:" + JSON.stringify(options));

			var req = https2.request(options, function (res) {

				(node.ret === "bin") ? res.setEncoding('binary'): res.setEncoding('utf8');
				res.on('end', function () {
					resolve(res);
				});
			});

			req.on('error', function (err) {
				reject(err);
			});
			req.write(JSON.stringify(payload));
			req.end();
		});
	}

	// retrieve token from context broker
	function getToken(node, orionUrl, credentials) {
		var s4cUtility = require("./snap4city-utility.js");
		const logger = s4cUtility.getLogger(RED, node);
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
				logger.debug("--requesting token using payload: " + payload);
				var req = (https).request(opts, function (res) {
					(node.ret === "bin") ? res.setEncoding('binary'): res.setEncoding('utf8');

					res.on('data', function (chunk) {
						token += chunk;
					});

					res.on('end', function () {
						logger.debug("--resolved token: " + token);
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

		var contextResponses = msg.contextResponses;
		var payload = [];
		if (typeof contextResponses != "undefined") {
			contextResponses.forEach(function (entry) {
				var contextElement = entry.contextElement;
				delete contextElement.isPattern;
				if (!n.includeattr) {
					// removing attribute metadata
					contextElement.attributes.forEach(function (entry) {
						delete entry.metadatas;
					});
				}

				payload.push(contextElement);
			});
		}

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
		n.tenant = n.tenant;
		n.servicepath = n.servicepath;		
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
		var opts = urllib.parse(url);

		opts.method = method;
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

	function getContextBrokerListForRegisterActivity(node, contextBrokerUrl, contextBrokerPort, deviceName, iotappid, accessToken) {
		var s4cUtility = require("./snap4city-utility.js");
        const logger = s4cUtility.getLogger(RED, node);
		var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
		var xmlHttp = new XMLHttpRequest();
		if (typeof node.currentContextBroker != "undefined" && node.currentContextBroker.accesslink.indexOf(contextBrokerUrl) == -1) {
			delete node.contextBrokerList;
		}
		if (typeof node.contextBrokerList == "undefined") {
			var uri = (RED.settings.iotDirectoryUrl ? RED.settings.iotDirectoryUrl : "https://iotdirectory.snap4city.org/");
			if (accessToken != "" && typeof accessToken != "undefined") {
				xmlHttp.open("GET", encodeURI(uri + "/api/contextbroker.php?action=get_all_contextbroker&nodered=yes"), true);
				xmlHttp.setRequestHeader("Content-Type", "application/json");
				xmlHttp.setRequestHeader("Authorization", "Bearer " + accessToken);
				xmlHttp.onload = function (e) {
					if (xmlHttp.readyState === 4) {
						if (xmlHttp.status === 200) {
							if (xmlHttp.responseText != "") {
								try {
									node.contextBrokerList = JSON.parse(xmlHttp.responseText).data;
								} catch (e) {
									node.contextBrokerList = xmlHttp.responseText.data;
								}
								createDeviceLongIdAndRegisterActivity(node, contextBrokerUrl, contextBrokerPort, deviceName, iotappid, accessToken);
							}
						} else {
							logger.error(xmlHttp.statusText);
						}
					}
				};
				xmlHttp.onerror = function (e) {
					logger.error(xmlHttp.statusText);
				};
				xmlHttp.send(null);
			}
		} else {
			createDeviceLongIdAndRegisterActivity(node, contextBrokerUrl, contextBrokerPort, deviceName, iotappid, accessToken);
		}
	}

	function createDeviceLongIdAndRegisterActivity(node, contextBrokerUrl, contextBrokerPort, deviceName, iotappid, accessToken) {
		var s4cUtility = require("./snap4city-utility.js");
        const logger = s4cUtility.getLogger(RED, node);
		var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
		var xmlHttp = new XMLHttpRequest();
		if (typeof node.deviceLongId == "undefined" || node.deviceLongId.indexOf(deviceName) == -1) {
			if (typeof node.contextBrokerList != "undefined") {
				for (var i = 0; i < node.contextBrokerList.length; i++) {
					if (node.contextBrokerList[i].accesslink.indexOf(contextBrokerUrl) != -1 && node.contextBrokerList[i].accessport == contextBrokerPort) {
						node.deviceLongId = node.contextBrokerList[i].organization + ":" + node.contextBrokerList[i].name + ":" + deviceName;
						node.currentContextBroker = node.contextBrokerList[i];
					}
				}
			}
		}

		if (typeof node.deviceLongId != "undefined") {
			var uri = (RED.settings.myPersonalDataUrl ? RED.settings.myPersonalDataUrl : "https://www.snap4city.org/mypersonaldata/api/v1");
			if (accessToken != "" && typeof accessToken != "undefined") {
				xmlHttp.open("POST", encodeURI(uri + "/lightactivities/?elementType=IOTID&sourceRequest=iotapp&sourceId=" + iotappid + "&elementId=" + node.deviceLongId), true);
				xmlHttp.setRequestHeader("Content-Type", "application/json");
				xmlHttp.setRequestHeader("Authorization", "Bearer " + accessToken);
				xmlHttp.onload = function (e) {
					if (xmlHttp.readyState === 4) {
						if (xmlHttp.status !== 200) {
							logger.error(xmlHttp.statusText);
						}
					} else {
						logger.error(xmlHttp.statusText);
					}
				};
				xmlHttp.onerror = function (e) {
					logger.error(xmlHttp.statusText);
				};
				xmlHttp.send(null);
			}
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
                	console.log(nodeID+" result.subscriptionId: " + result.subscriptionId + "!=" + testSubscriptionID);
                	node.error("Communication with context broker failed: received wrong subId");
					unsubscribeFromOrion(node, result.subscriptionId, orionUrl).then(function(res){
						console.log("Unsubscribed invalid subscription: " + result.subscriptionId + " res: " + JSON.stringify(res));
					});
					unsubscribeFromOrion(node, testSubscriptionID, orionUrl).then(function(res){
						console.log("Unsubscribed test subscription: " + testSubscriptionID + " res: " + JSON.stringify(res));
					});
					
                	reject("Communication with context broker failed");
                }else{*/
				//console.log(nodeID + " result.subscriptionId: " + result.subscriptionId + "==" + testSubscriptionID);
				resolve();
				//}
			});

			request(node, "POST", createElementPayload, orionUrl + "/v1/updateContext").then(function (result) {

				getSubscribeTestPayload(node).then(function (subscribePayload) {
					request(node, "POST", subscribePayload, orionUrl + "/v1/subscribeContext").then(function (subscription) {

						try {
							var testSubscriptionID = subscription.subscribeResponse.subscriptionId
							//console.log(node.id + " " + nodeID + " pre test:" + testSubscriptionIDs[nodeID]);
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
		console.log("in validateOrionConnectivityOneWay with createElementPayload: " + JSON.stringify(createElementPayload));

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

	//OrionSubscribe node constructor	
	RED.nodes.registerType("fiware orion in", OrionSubscribe);

	function OrionSubscribe(n) {
		RED.nodes.createNode(this, n);
		var node = this;
		this.service = n.service;
		this.brokerConn = RED.nodes.getNode(this.service);
		this.noderedhost = n.noderedhost;
		this.userk1 = n.userk1;
		this.passk2 = n.passk2;
		this.apikey = n.apikey;
		this.basicAuth = n.basicAuth;

		this.on("close", function () {


			var nodeID = node.id + "";
			nodeID = nodeID.replace('.', '');

			RED.httpNode._router.stack.forEach(function (route, i, routes) {
				if (route.route && route.route.path == "/" + nodeID) {
					routes.splice(i, 1);
				}
			});
			//cannot invoke unsubscribe from here since the config is empty (and the contextbroker uri is unknown)
			//	unsubscribeFromOrion(node, subscriptionIDs[nodeID], null, n);
		});

		// validate mandatory fields
		validateInput(this, n);

		node.brokerConn.init(node, n).then(function () {
			getSubscribePayload(node, n).then(function (payload) {
				node.brokerConn.subscribe(node, n, payload);
			});
		});
	}

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
					logger.debug("myUri: " + myUri);
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
				var s4cUtility = require("./snap4city-utility.js");
				const logger = s4cUtility.getLogger(RED, node);
				
				// first try to get user specified uri, TODO: many input validations...
				var myUri = node.noderedhost;
				if (myUri) {
					resolve(myUri + RED.settings.httpRoot /*+ ":" + RED.settings.uiPort*/ ); //PB removed port
				} else {
					myUri = RED.settings.externalHost; //PB fix added
					if (myUri)
						//TODO check if this one is needed 
						//resolve(myUri + RED.settings.httpRoot.substring(0, RED.settings.httpRoot.lenght - 1) /*+ ":" + RED.settings.uiPort*/ ); //PB remove port
						resolve(myUri + RED.settings.httpRoot /*+ ":" + RED.settings.uiPort*/ ); //PB remove port
					else {
						// attempt to get from bluemix
						try {
							var app = JSON.parse(process.env.VCAP_APPLICATION);
							myUri = app['application_uris'][0];
						} catch (e) {
							logger.error("Probably not running in bluemix...");
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

	//OrionQuery node constructor	
	RED.nodes.registerType("fiware orion", OrionQuery);

	function OrionQuery(n) {
		RED.nodes.createNode(this, n);
		var s4cUtility = require("./snap4city-utility.js");
        const logger = s4cUtility.getLogger(RED, this);

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
							logger.debug("queryContext result:" + JSON.stringify(msg));
							msg = formatOutput(node, n, JSON.parse(msg.payload));

							node.send({
								payload: msg,
								statusCode: 200
							});

							node.status({
								fill: "green",
								shape: "dot",
								text: "success"
							});
						},
						function (reason) {
							logger.error("queryContext error:" + JSON.stringify(reason));
							node.status({
								fill: "red",
								shape: "ring",
								text: getErrorMessage(reason)
							});
							node.error("failed to query, reason: " + JSON.stringify(reason));
						}
					);
				});
			} catch (err) {
				node.error(err, msg);
				node.status({
					fill: "red",
					shape: "ring",
					text: getErrorMessage(err.code)
				});
				node.send({
					payload: err.toString(),
					statusCode: err.code
				});
			}
		});
	}

	function processInput(node, n, msg) {
		n.url = n.url || msg.url;
		n.port = n.port || msg.port;
		n.enid = n.enid || msg.enid || ".*"; //TODO don't allow .* for queryContext (but also for subscribeContext)
		n.entype = n.entype || msg.entype;
		n.limit = n.limit || msg.limit || LIMIT;
		n.userk1 = n.userk1 || msg.userk1;
		n.passk2 = n.passk2 || msg.passk2;
		n.tenant = n.tenant || msg.tenant;
		n.servicepath = n.servicepath || msg.servicepath;		
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

	//OrionUpdate node constructor	
	RED.nodes.registerType("orion-test", OrionUpdate);

	function OrionUpdate(n) {
		RED.nodes.createNode(this, n);
		var s4cUtility = require("./snap4city-utility.js");
        const logger = s4cUtility.getLogger(RED, this);

		this.on("input", function (msg) {
			this.service = n.service;
			this.brokerConn = RED.nodes.getNode(this.service);
			var node = this;

			if (typeof msg.auth == "string") {
				msg.auth = JSON.parse(msg.auth);
			}

			// create json payload for context update
			var payload = generateCreateElementPayload(node, n, msg);

			try {
				node.brokerConn.init(node, n).then(function () {
					node.brokerConn.updateContext(node, n, payload, msg.auth).then(
						function (msg) {
							logger.debug("updateContext result:" + JSON.stringify(msg));
							msg = formatOutput(node, n, JSON.parse(msg.payload));

							node.send({
								payload: msg,
								statusCode: 200
							});

							node.status({
								fill: "green",
								shape: "dot",
								text: "success"
							});
						},
						function (reason) {
							logger.error("updateContext error:" + JSON.stringify(reason));
							node.status({
								fill: "red",
								shape: "ring",
								text: getErrorMessage(reason)
							});
							node.error("failed to update, reason: " + JSON.stringify(reason));
						}
					);
				});
			} catch (err) {
				node.error(err, msg);
				node.status({
					fill: "red",
					shape: "ring",
					text: getErrorMessage(err.code)
				});
				node.send({
					payload: err.toString(),
					statusCode: getErrorMessage(err.code)
				});
			}
		});
	}

	//reason is a json
	function getErrorMessage(reason) {
		try {
			if (JSON.stringify(reason).indexOf("TIMEDOUT") != -1)
				return "problem, Timeout";
			else if (JSON.stringify(reason).indexOf("ENOTFOUND") != -1)
				return "problem, Not reachable";
			else if (JSON.stringify(reason).indexOf("ECONNREFUSED") != -1)
				return "problem, Connection refused";
			else if (JSON.stringify(reason).indexOf("SELF_SIGNED_CERT_IN_CHAIN") != -1)
				return "problem, CA certificate not valid";
			else if (JSON.stringify(reason).indexOf("is not in the cert's list") != -1)
				return "problem, Broker URL mismatch";
			else if ((JSON.stringify(reason).indexOf("certificate unknown") != -1) || (JSON.stringify(reason).indexOf("EPROTO") != -1))
				return "problem, Certificate credentials not valid";
			else if (JSON.stringify(reason).indexOf("key values mismatch") != -1)
				return "problem, Key values mismatch";
			else
				return "problem, " + JSON.parse(reason.payload).message;
		} catch (err) {
			return "unknown problem";
		}
	}

	//priority to the n.attrkey and n.value. If not found, retrieve from msg
	//in any case, use n.id and n.type
	function generateCreateElementPayload(node, n, msg) {
		var attributes = [];
		if (n.attrkey && n.attrvalue) {
			var name = n.attrkey.trim();
			var value = n.attrvalue.trim();
			attributes.push({
				name,
				value
			});
		} else if (typeof msg.attributes != "undefined") {
			attributes = msg.attributes;
		} else if (typeof msg.payload.attributes != "undefined") {
			attributes = msg.payload.attributes;
		}

		if (!attributes) {
			throw "Missing 'attributes' property";
		}

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


	//OrionOut node constructor	
	RED.nodes.registerType("fiware-orion-out", OrionOut);


	function OrionOut(n) {
		RED.nodes.createNode(this, n);
		var s4cUtility = require("./snap4city-utility.js");
        const logger = s4cUtility.getLogger(RED, this);

		this.on("input", function (msg) {
			this.service = n.service;
			this.brokerConn = RED.nodes.getNode(this.service);
			var node = this;
			try {

				if (typeof msg.auth == "string") {
					msg.auth = JSON.parse(msg.auth);
				}

				if (typeof msg.payload == "string") {
					msg.payload = JSON.parse(msg.payload);
				}

				//it converts to array a single attribute
				if (typeof msg.payload.length == "undefined" && typeof msg.payload.name != "undefined" && typeof msg.payload.value != "undefined") {
					msg.payload = [msg.payload];
				}

				// create json payload for context update
				//var payload = generateCreateElementPayload(node, n, msg);
				var payload = ""
				if (Array.isArray(msg.payload)) {
					if ((n.entype == "") || (n.enid == ""))
						throw ("entype or enid missing");
					payload = {
						"contextElements": [{
							"type": n.entype,
							"isPattern": "false",
							"id": n.enid,
							"attributes": msg.payload
						}],
						"updateAction": "APPEND"
					};
				} else {
					if (((msg.payload.type == undefined) && (n.entype == "")) ||
						((msg.payload.id == undefined) && (n.enid == "")))
						throw ("entype or enid missing");
					payload = {
						"contextElements": [{
							"type": (msg.payload.type ? msg.payload.type : n.entype),
							"isPattern": "false",
							"id": (msg.payload.id ? msg.payload.id : n.enid),
							"attributes": msg.payload.attributes
						}],
						"updateAction": "APPEND"
					};
				}
				try {
					node.brokerConn.init(node, n).then(function () {
						node.brokerConn.updateContext(node, n, payload, msg.auth).then(
							function (msg) {
								logger.info("updateContext result:" + JSON.stringify(msg));
								msg = formatOutput(node, n, JSON.parse(msg.payload));

								node.send({
									payload: msg,
									statusCode: 200
								});

								node.status({
									fill: "green",
									shape: "dot",
									text: "success"
								});
							},
							function (reason) {
								logger.error("updateContext error:" + JSON.stringify(reason));
								node.status({
									fill: "red",
									shape: "ring",
									text: getErrorMessage(reason)
								});
								node.error("failed to update, reason: " + JSON.stringify(reason));
							}
						);
					});
				} catch (err) {
					node.error(err, msg);
					node.status({
						fill: "red",
						shape: "ring",
						text: getErrorMessage(err.code)
					});
					node.send({
						payload: err.toString(),
						statusCode: getErrorMessage(err.code)
					});
				}
			} catch (e) {
				node.status({
					fill: "red",
					shape: "ring",
					text: "Problem with input msg"
				});
				node.error(e);
			}
		});
	}
}