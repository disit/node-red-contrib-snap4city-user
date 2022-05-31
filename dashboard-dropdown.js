/* NODE-RED-CONTRIB-SNAP4CITY-USER
   Copyright (C) 2018 DISIT Lab http://www.disit.org - University of Florence

   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU Affero General Public License as
   published by the Free Software Foundation, either version 3 of the
   License, or (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU Affero General Public License for more details.

   You should have received a copy of the GNU Affero General Public License
   along with this program.  If not, see <http://www.gnu.org/licenses/>. */
module.exports = function (RED) {

    function DasbhoardDropdown(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var WebSocket = require('ws');
        var s4cUtility = require("./snap4city-utility.js");
        const logger = s4cUtility.getLogger(RED, node);
        const uid = s4cUtility.retrieveAppID(RED);
        node.s4cAuth = RED.nodes.getNode(config.authentication);
        var wsServer = s4cUtility.settingUrl(RED,node, "wsServerUrl", "wss://www.snap4city.org", "/wsserver", true);
        var wsServerHttpOrigin = s4cUtility.settingUrl(RED,node, "wsServerHttpOrigin", "wss://www.snap4city.org", "", true);
        node.ws = null;
        node.notRestart = false;
        //Meccanismo di passaggio dei valori tra il menu di add/edit node e il codice del nodo
        node.name = "NR_" + node.id.replace(".", "_");
        node.widgetTitle = config.name;
        node.username = config.username;
        node.flowName = config.flowName;
        node.selectedDashboardId = config.selectedDashboardId;
        node.dashboardId = config.dashboardId;
        node.valueType = config.valueType;
        node.lastValue = config.minValue;
		node.domain = config.domainType;
        node.dropdwonOrderedList = config.dropdownOrderedList;
        node.httpRoot = null;
		node.selected = null;

        node.on('input', function (msg) {
            logger.debug("Flow input received: " + JSON.stringify(msg));

            var timeout = 0;
            if ((new Date().getTime() - node.wsStart) > parseInt(RED.settings.wsReconnectTimeout ? RED.settings.wsReconnectTimeout : 1200) * 1000) {
                if (node.ws != null) {
                    node.ws.removeListener('error', node.wsErrorCallback);
                    node.ws.removeListener('open', node.wsOpenCallback);
                    node.ws.removeListener('message', node.wsMessageCallback);
                    node.ws.removeListener('close', node.wsCloseCallback);
                    node.ws.removeListener('pong', node.wsHeartbeatCallback);
                    node.notRestart = true;
                    node.ws.terminate();
                    node.ws = null;
                } else {
                    logger.debug("Why ws is null? I am in node.on('input'");
                }
                node.ws = new WebSocket(wsServer, {
                    origin: wsServerHttpOrigin
                });
                node.ws.on('error', node.wsErrorCallback);
                node.ws.on('open', node.wsOpenCallback);
                node.ws.on('message', node.wsMessageCallback);
                node.ws.on('close', node.wsCloseCallback);
                node.ws.on('pong', node.wsHeartbeatCallback);
                logger.debug("is reconnetting to open WebSocket");
                timeout = 1000;
            }

            node.wsStart = new Date().getTime();

            if (typeof node.widgetUniqueName != "undefined" && node.widgetUniqueName != "") {

                /* var currentDropdownOrderedList = [];

                if (typeof msg.payload.options != "undefined" && msg.payload.options != "") {
                    for (var i = 0; i < msg.payload.options.length; i++) {                        
						for (var j = 0; j < node.dropdwonOrderedList.length; j++) {
                            if (node.dropdwonOrderedList[j].label == msg.payload.options[i].label) {
                                node.dropdwonOrderedList[j].value = msg.payload.options[i].value;
                            }
                        }
                    }
                }

                for (var i = 0; i < node.dropdwonOrderedList.length; i++) {
                    if (node.dropdwonOrderedList[i].value != "") {
                        currentDropdownOrderedList.push([node.dropdwonOrderedList[i].label, node.dropdwonOrderedList[i].value]);
                    }
                }
				
				var objectToBeSent = {};
				if (typeof msg.payload.options != "undefined" && msg.payload.options != "") {
					objectToBeSent.options = currentDropdownOrderedList;					
				}
				if (typeof msg.payload.valueSelected != "undefined" && msg.payload.valueSelected != "") {
					objectToBeSent.valueSelected = msg.payload.valueSelected;
				}
				*/
				node.dropdownOrderedList = msg.payload.options;
				node.selected = msg.payload.selected;
                var newMetricData = {
                    msgType: "SendToEmitter",
                    widgetUniqueName: node.widgetUniqueName,
                    dashboardId: node.dashboardId,
                    value: JSON.stringify(msg.payload)
                }; 

                setTimeout(function () {
                    try {
                        logger.info("Send SendToEmitter to WebSocket: " + newMetricData.value);
                        logger.debug("Send SendToEmitter to WebSocket: " + JSON.stringify(newMetricData));
                        node.ws.send(JSON.stringify(newMetricData));
                    } catch (e) {
                        logger.error("Error sending data to WebSocket : " + e);
                    }
                }, timeout);

                s4cUtility.eventLog(RED, msg, newMetricData, config, "Node-Red", "Dashboard", wsServer, "TX");


            } else {
                node.error("Maybe the dropdown is not created on dashboard");
                logger.error("Error, the dropdown is not created on dashboard. node.widgetUniqueName: " + node.widgetUniqueName);
            }
        });

        node.on('close', function (removed, closedDoneCallback) {
            if (removed) {
                // Cancellazione nodo
                logger.debug("is being removed from flow");
                node.deleteEmitter();
            } else {
                // Riavvio nodo
                logger.debug("is being rebooted");
                node.notRestart = true;
                node.ws.terminate();
            }
            clearInterval(node.pingInterval);
            closedDoneCallback();
        });

        node.wsOpenCallback = function () {
            if (node.dashboardId != null && node.dashboardId != "") {
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: "connected to " + wsServer
                });

                if (RED.settings.hasOwnProperty('httpRoot')) {
                    if (RED.settings.httpRoot !== '/') {
                        node.httpRoot = RED.settings.httpRoot;
                    } else {
                        node.httpRoot = null;
                    }
                }

                var payload = {
                    msgType: "AddEmitter",
                    name: node.name,
                    valueType: node.valueType,
                    user: node.username,
                    startValue: JSON.stringify({"options":node.selectedDashboardId, selected:""}),
                    domainType: node.domain,
                    offValue: node.offValue,
                    onValue: node.onValue,
                    minValue: node.minValue,
                    maxValue: node.maxValue,
                    endPointPort: (RED.settings.externalPort ? RED.settings.externalPort : 1895),
                    endPointHost: (RED.settings.dashInNodeBaseUrl ? RED.settings.dashInNodeBaseUrl : "'0.0.0.0'"),
                    httpRoot: node.httpRoot,
                    appId: uid,
                    flowId: node.z,
                    flowName: node.flowName,
                    nodeId: node.id,
                    widgetType: "widgetMultiChoice",
                    widgetTitle: node.widgetTitle,
                    dashboardTitle: "",
                    dashboardId: node.dashboardId,
                    accessToken: s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid)
                };

                logger.info("AddEmitter sent to WebSocket");
                logger.debug("AddEmitter sent to WebSocket: " + JSON.stringify(payload));
                if (node.pingInterval == null) {
                    node.pingInterval = setInterval(function () {
                        logger.silly("ping");;
                        if (node.ws != null) {
                            try {
                                node.ws.ping();
                            } catch (e) {
                                logger.debug("Errore on Ping " + e);
                            }
                        }
                    }, 30000);
                }

                logger.info("is going connect to WS");
                if (payload.accessToken != "") {
                    setTimeout(function () {
                        node.ws.send(JSON.stringify(payload));
                    }, Math.random() * 2000)
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Authentication Problem"
                    });
                    logger.error("Problem with accessToken: " + payload.accessToken);
                }
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "No dashboard selected"
                });
                logger.error("No dashboard selected, dashboard Id: " + node.dashboardId);
            }
        };

        node.wsMessageCallback = function (data) {
            var response = JSON.parse(data);
            logger.debug("Message received from WebSocket: " + data);
            switch (response.msgType) {
                case "AddEmitter":
                    if (response.result === "Ok") {

                        if (response.lastValue) {
                            node.lastValue = response.lastValue;
                        }

                        logger.info("WebSocket server correctly AddEmitter type: " + response.result);
                        node.status({
                            fill: "green",
                            shape: "dot",
                            text: "Created on dashboard"
                        });
                        if (node.intervalID != null) {
                            clearInterval(node.intervalID);
                            node.intervalID = null;
                        }
                        if (typeof node.widgetUniqueName == "undefined") {
                            if (node.ws != null) {
                                node.ws.removeListener('error', node.wsErrorCallback);
                                node.ws.removeListener('open', node.wsOpenCallback);
                                node.ws.removeListener('message', node.wsMessageCallback);
                                node.ws.removeListener('close', node.wsCloseCallback);
                                node.ws.removeListener('pong', node.wsHeartbeatCallback);
                                node.ws = null;
                            } else {
                                logger.debug("Why ws is null? I am in node.wsMessageCallback");
                            }
                            node.wsInit();
                        }
                        node.widgetUniqueName = response.widgetUniqueName;
						node.deliverInitialConfig();
                    } else {
                        logger.error("WebSocket server could not AddEmitter type: " + response.error);
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: response.error
                        });
                        node.error(response.error);
                    }
                    break;

                case "DelEmitter":
                    if (response.result === "Ok") {
                        logger.info("WebSocket server correctly DelEmitter type: " + response.result);
                    } else {
                        logger.error("WebSocket server could not DelEmitter type: " + response.error);
                    }
                    logger.info("Closing webSocket server after DelMetric message");
                    node.notRestart = true;
                    node.ws.terminate();
                    break;
                case "DataToEmitter":
                    logger.info("WebSocket server correctly DataToEmitter type: " + response.newValue);
                    if (response.newValue != "dashboardDeleted") {
                        node.status({
                            fill: "green",
                            shape: "dot",
                            text: "connected to " + wsServer
                        });
                        if (response.newValue) {
                            try {
                                node.dropdwonOrderedList = response.newValue.options;
								node.selected = response.newValue.selected;
								node.lastValue = response.newValue;
                                var msg = {
                                    payload: node.lastValue
                                };
                                node.send(msg);
                            } catch (e) {
                                logger.error("Problem Parsing data " + response.newValue);
                            }
                        }
                        var ackMessage = JSON.stringify({
                            msgType: "DataToEmitterAck",
                            widgetUniqueName: node.widgetUniqueName,
                            result: "Ok",
                            msgId: response.msgId,
                            accessToken: s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid)
                        })

                        node.ws.send(ackMessage);

                        logger.debug("DataToEmitterAck sent to WebSocket: " + ackMessage);
                    } else {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "Dashboard deleted"
                        });
                    }
                    s4cUtility.eventLog(RED, msg, msg, config, "Node-Red", "Dashboard", RED.settings.httpRoot + node.name, "RX");
                    break;
                default:
                    logger.debug(response.msgType);
                    break;
            }
        };

        node.wsCloseCallback = function (e) {
            logger.warn("Closed WebSocket. Reason: " + e);
            if (!(node.dashboardId != null && node.dashboardId != "")) {
                /*node.status({
                    fill: "red",
                    shape: "dot",
                    text: "No Dashboard Selected"
                });*/
                logger.error("No dashboard selected, dashboard Id: " + node.dashboardId);
            } else {
                node.status({
                    fill: "red",
                    shape: "ring",
                    text: "lost connection from " + wsServer
                });
                logger.warn("Lost connection from " + wsServer);
            }

            if (node.ws != null) {
                node.ws.removeListener('error', node.wsErrorCallback);
                node.ws.removeListener('open', node.wsOpenCallback);
                node.ws.removeListener('message', node.wsMessageCallback);
                node.ws.removeListener('close', node.wsCloseCallback);
                node.ws.removeListener('pong', node.wsHeartbeatCallback);
                node.ws = null;
            } else {
                logger.debug("Why ws is null? I am in node.wsCloseCallback");
            }

            var wsServerRetryActive = (RED.settings.wsServerRetryActive ? RED.settings.wsServerRetryActive : "yes");
            var wsServerRetryTime = (RED.settings.wsServerRetryTime ? RED.settings.wsServerRetryTime : 30);
            logger.debug("wsServerRetryActive: " + wsServerRetryActive + " node.notRestart: " + node.notRestart);
            if (wsServerRetryActive === 'yes' && !node.notRestart) {
                logger.info("will try to reconnect to WebSocket in " + parseInt(wsServerRetryTime) + "s");
                if (!node.intervalID) {
                    node.intervalID = setInterval(node.wsInit, parseInt(wsServerRetryTime) * 1000);
                }
            }
            node.notRestart = false;
        };

        node.wsErrorCallback = function (e) {
            logger.error("got WebSocket error: " + e);
        };

        node.deleteEmitter = function () {
            var newMsg = {
                msgType: "DelEmitter",
                nodeId: node.id,
                user: node.username,
                appId: uid,
                flowId: node.z,
                flowName: node.flowName,
                accessToken: s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid)
            };

            try {
                node.ws.send(newMsg);
                logger.info("DelEmitter via webSocket");
                logger.debug("DelEmitter via webSocket: " + newMsg);
            } catch (e) {
                logger.error("Error DelEmitter via webSocket: " + e);
            }
        };

        node.wsHeartbeatCallback = function () {
            logger.silly("heartbeat callback");
        };

        //Lasciarlo, altrimenti va in timeout!!! https://nodered.org/docs/creating-nodes/node-js#closing-the-node
        node.closedDoneCallback = function () {
            logger.info("has been closed");
        };

        node.wsInit = function (e) {
            logger.info("is trying to open WebSocket");
            try {
                node.status({
                    fill: "yellow",
                    shape: "dot",
                    text: "connecting to " + wsServer
                });
                if (node.ws == null) {
                    node.ws = new WebSocket(wsServer, {
                        origin: wsServerHttpOrigin
                    });
                    node.ws.on('error', node.wsErrorCallback);
                    node.ws.on('open', node.wsOpenCallback);
                    node.ws.on('message', node.wsMessageCallback);
                    node.ws.on('close', node.wsCloseCallback);
                    node.ws.on('pong', node.wsHeartbeatCallback);
                    node.wsStart = new Date().getTime();
                } else {
                    logger.error("already open WebSocket");
                }
            } catch (e) {
                logger.error("could not open WebSocket");
                node.status({
                    fill: "red",
                    shape: "ring",
                    text: "unable to connect to " + wsServer
                });
                node.wsCloseCallback();
            }
        };
		
		node.deliverInitialConfig = function() {
			
			logger.debug("Delivering initial configuration");

            var timeout = 0;
            if ((new Date().getTime() - node.wsStart) > parseInt(RED.settings.wsReconnectTimeout ? RED.settings.wsReconnectTimeout : 1200) * 1000) {
                if (node.ws != null) {
                    node.ws.removeListener('error', node.wsErrorCallback);
                    node.ws.removeListener('open', node.wsOpenCallback);
                    node.ws.removeListener('message', node.wsMessageCallback);
                    node.ws.removeListener('close', node.wsCloseCallback);
                    node.ws.removeListener('pong', node.wsHeartbeatCallback);
                    node.notRestart = true;
                    node.ws.terminate();
                    node.ws = null;
                } else {
                    logger.debug("Why ws is null? I am in node.on('input'");
                }
                node.ws = new WebSocket(wsServer, {
                    origin: wsServerHttpOrigin
                });
                node.ws.on('error', node.wsErrorCallback);
                node.ws.on('open', node.wsOpenCallback);
                node.ws.on('message', node.wsMessageCallback);
                node.ws.on('close', node.wsCloseCallback);
                node.ws.on('pong', node.wsHeartbeatCallback);
                logger.debug("is reconnetting to open WebSocket");
                timeout = 1000;
            }

            node.wsStart = new Date().getTime();

            if (typeof node.widgetUniqueName != "undefined" && node.widgetUniqueName != "") {

                /*var currentDropdownOrderedList = [];

                for (var i = 0; i < node.dropdwonOrderedList.length; i++) {
                    if (node.dropdwonOrderedList[i].value != "") {
                        currentDropdownOrderedList.push([node.dropdwonOrderedList[i].label, node.dropdwonOrderedList[i].value]);
                    }
                }
				
				if(currentDropdownOrderedList.length > 0) {*/

					var newMetricData = {
						msgType: "SendToEmitter",
						widgetUniqueName: node.widgetUniqueName,
						dashboardId: node.dashboardId,
						value: JSON.stringify({ "options": node.dropdwonOrderedList, "selected": "" })
					};

					setTimeout(function () {
						try {
							logger.info("Send SendToEmitter to WebSocket: " + newMetricData.value);
							logger.debug("Send SendToEmitter to WebSocket: " + JSON.stringify(newMetricData));
							node.ws.send(JSON.stringify(newMetricData));
						} catch (e) {
							logger.error("Error sending data to WebSocket : " + e);
						}
					}, timeout);

					s4cUtility.eventLog(RED, node.dropdwonOrderedList, newMetricData, config, "Node-Red", "Dashboard", wsServer, "TX");
				// }

			} else {
				node.error("Maybe the dropdown is not created on dashboard");
				logger.error("Error, the dropdown is not created on dashboard. node.widgetUniqueName: " + node.widgetUniqueName);
			}
						
		};

        //Inizio del "main"
        try {
            node.wsInit();
        } catch (e) {
            logger.error("got main exception connecting to WebSocket");
        }

    }

    RED.nodes.registerType("dropdown", DasbhoardDropdown);

};