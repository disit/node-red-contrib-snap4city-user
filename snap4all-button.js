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
	var util = require('util');
	var when = require('when');
	var bodyParser = require("body-parser");
	var jsonParser = bodyParser.json();
	var urlencParser = bodyParser.urlencoded({
		extended: true
	});
	var https2 = require('https');
	var subscriptionIDs = {};

	function validateInput(node, n) {
		var err = null;
		n.url = n.url;
		n.port = n.port;
		n.enid = n.enid;
		n.entype = n.entype;
		n.userk1 = n.userk1;
		n.passk2 = n.passk2;
		n.attributes = n.attributes;
		n.includeattr = n.includeattr;
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
							"type": "ONCHANGE"
						}],
						"throttling": n.throttle
					});
				})
			}
		);
	}

	function Snap4allButton(n) {

		RED.nodes.createNode(this, n);
		this.service = n.service;
		this.brokerConn = RED.nodes.getNode(this.service);
		this.noderedhost = n.noderedhost;
		this.userk1 = n.userk1;
		this.passk2 = n.passk2;

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
				node.status({
					fill: "blue",
					shape: "dot",
					text: "subscribing"
				});
				util.log("subscribeContext with node id: " + node.id);
				var reference = payload.reference;


				//util.log(RED.nodes.getNode(n.tls));
				var orionBrokerService = RED.nodes.getNode(n.service);
				var options = {
					hostname: orionBrokerService.url,
					port: orionBrokerService.port,
					path: "/v1/subscribeContext/?elementid=" + n.enid + (n.userk1 ? "&k1=" + n.userk1 : "") + (n.passk2 ? "&k2=" + n.passk2 : ""),
					method: 'POST',
					rejectUnauthorized: false,
					headers: {
						'Content-Type': 'application/json',
						'Accept': 'application/json',
						'Content-Length': Buffer.byteLength(JSON.stringify(payload))
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
						util.log("subscribeContext RESULT: " + res.statusMessage);
						var parsedResponse = JSON.parse(msg.payload);

						if (JSON.parse(msg.payload).subscribeResponse != null) {
							var subscriptionID = JSON.parse(msg.payload).subscribeResponse.subscriptionId;

							var nodeID = (node.id + "").replace('.', '');
							util.log("elementId: " + n.enid + " nodeId: " + nodeID + " oldSubId: " + subscriptionIDs[nodeID] + " newSubId: " + subscriptionID);
							subscriptionIDs[nodeID] = subscriptionID;
						} else if (parsedResponse.result == false) {
							node.status({
								fill: "red",
								shape: "ring",
								text: parsedResponse.message
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

				node.status({
					fill: "blue",
					shape: "dot",
					text: "listening on " + reference
				});

				if (payload) {
					req.write(JSON.stringify(payload));
				}

				req.end();

				var nodeID = (node.id + "").replace('.', '');
				listenOnUrl(nodeID, function (req, res) {
					if (req.body.subscriptionId != subscriptionIDs[nodeID]) {
						util.log("Recognized invalid subscription in response body: " + req.body.subscriptionId);
						unsubscribeFromOrion(node, req.body.subscriptionId, n.brokerIP, n).then(function (res) {});
					} else {
						res.sendStatus(200);
						var attributes = req.body.contextResponses[0].contextElement.attributes;
						//util.log(JSON.stringify(req.body));
						for (var i = 0; i < attributes.length; i++) {
							if (attributes[i].name == "roundbutton" && attributes[i].value != "0") {
								if (attributes[i].value == "1") {
									node.send([{
										payload: "on"
									}, , , , , , ]);
								} else if (attributes[i].value == "2") {
									node.send([, {
										payload: "on"
									}, , , , , ]);
								} else if (attributes[i].value == "3") {
									node.send([, , {
										payload: "on"
									}, , , , ]);
								}
								return;
							}
							if (attributes[i].name == "squarebutton" && attributes[i].value != "0") {
								if (attributes[i].value == "1") {
									node.send([, , , {
										payload: "on"
									}, , , ]);
								} else if (attributes[i].value == "2") {
									node.send([, , , , {
										payload: "on"
									}, , ]);
								} else if (attributes[i].value == "3") {
									node.send([, , , , , {
										payload: "on"
									}, ]);
								}
								return;
							}
						}
						node.send([, , , , , , {
							payload: "reset"
						}]);
					}

					util.log("Send Status 200");
				});

			});
		});
	}

	//Register OrionSubscribe node
	RED.nodes.registerType("snap4all-button", Snap4allButton, {
		credentials: {
			user: {
				type: "text"
			},
			password: {
				type: "password"
			}
		}
	});

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

	RED.httpAdmin.get('/snap4allButtonList', RED.auth.needsPermission('snap4all-button.read'), function (req, res) {
		var s4cUtility = require("./snap4city-utility.js");
		var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
		var xmlHttp = new XMLHttpRequest();
		var accessToken = s4cUtility.retrieveAccessToken(RED, null, null, null);
		var url = RED.settings.iotdirectoryUri ? RED.settings.iotdirectoryUri : "https://iotdirectory.snap4city.org/api/";

		//console.log("---------->URL "+url);
		if (accessToken != "" && url != "") {
			xmlHttp.open("GET", encodeURI(url + "device.php?action=get_config_data&nodered=yes&token=" + accessToken), true); // false for synchronous request
			xmlHttp.onload = function (e) {
				if (xmlHttp.readyState === 4) {
					if (xmlHttp.status === 200) {
						if (xmlHttp.responseText != "") {
							try {
								res.send(JSON.parse(xmlHttp.responseText).content);
							} catch (e) {
								res.status(500).send({
									"error": "Parsing Error of the list"
								});
							}
						} else {
							console.log("Empty Response Text");
							res.status(500).send({
								"error": "Empty Response Text"
							});
						}
					} else {
						console.log(xmlHttp.statusText);
						res.status(xmlHttp.status).send({
							"error": "The status returned from the service that provide the list"
						});
					}
				} else {
					console.log(xmlHttp.statusText);
					res.status(500).send({
						"error": "Something goes wrong. XMLHttpRequest.readyState = " + xmlHttp.readyState
					});
				}
			};
			xmlHttp.onerror = function (e) {
				console.log(xmlHttp.statusText);
				res.status(500).send({
					"error": "Cannot call the url to get the list"
				});
			};
			xmlHttp.send(null);
		} else {
			res.status(500).send({
				"error": "Cannot get the accessToken"
			});
		}
	});

}