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

    function SingleContentNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var WebSocket = require('ws');
        var s4cUtility = require("./snap4city-utility.js");
        const logger = s4cUtility.getLogger(RED, node);
        const uid = s4cUtility.retrieveAppID(RED);
        node.s4cAuth = RED.nodes.getNode(config.authentication);
        var wsServer = ( node.s4cAuth != null && node.s4cAuth.domain ? node.s4cAuth.domain.replace("https", "wss").replace("http", "ws") : ( RED.settings.wsServerUrl ? RED.settings.wsServerUrl : "https://www.snap4city.org" )) + "/wsserver";
        var wsServerHttpOrigin = ( node.s4cAuth != null && node.s4cAuth.domain ? node.s4cAuth.domain : ( RED.settings.wsServerHttpOrigin ? RED.settings.wsServerHttpOrigin : "https://www.snap4city.org" ));
        node.ws = null;
        node.notRestart = false;
        node.name = config.name;
        node.username = config.username;
        node.flowName = config.flowName;
        node.selectedDashboardId = config.selectedDashboardId;
        node.dashboardId = config.dashboardId;
        node.metricName = "NR_" + node.id.replace(".", "_");
        node.metricType = config.metricType;
        node.startValue = config.startValue;
        node.metricShortDesc = config.metricName;
        node.metricFullDesc = config.metricName;
        node.httpRoot = null;

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

            var newMetricData = {
                msgType: "AddMetricData",
                nodeId: node.id,
                metricName: encodeURIComponent(node.metricName),
                metricType: node.metricType,
                newValue: msg.payload,
                appId: uid,
                user: node.username,
                flowId: node.z,
                flowName: node.flowName,
                accessToken: s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid)
            };

            if (typeof newMetricData.newValue === 'object') {
                if (newMetricData.newValue.metricHighLevelType === "Dynamic") {
                    newMetricData.newValue = newMetricData.newValue.value;
                } else {
                    newMetricData.metricType = "Series";
                }
            }

            setTimeout(function () {
                try {
                    node.ws.send(JSON.stringify(newMetricData));
                    logger.info("Send AddMetricData to WebSocket: " + newMetricData.newValue);
                    logger.debug("Send AddMetricData to WebSocket: " + JSON.stringify(newMetricData));
                } catch (e) {
                    logger.error("Error sending data to WebSocket : " + e);
                }
            }, timeout);

            s4cUtility.eventLog(RED, msg, newMetricData, config, "Node-Red", "Dashboard", wsServer, "TX");

        });

        node.on('close', function (removed, closedDoneCallback) {
            if (removed) {
                // Cancellazione nodo
                logger.debug("is being removed from flow");
                node.deleteMetric();
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

                //Registrazione della nuova metrica presso il Dashboard Manager
                var payload = {
                    msgType: "AddEditMetric",
                    metricName: encodeURIComponent(node.metricName),
                    metricType: node.metricType,
                    nodeId: node.id,
                    startValue: node.startValue,
                    user: node.username,
                    metricShortDesc: node.metricShortDesc,
                    metricFullDesc: node.metricFullDesc,
                    appId: uid,
                    flowId: node.z,
                    flowName: node.flowName,
                    widgetType: "widgetSingleContent",
                    widgetTitle: node.name,
                    dashboardTitle: "",
                    dashboardId: node.dashboardId,
                    httpRoot: node.httpRoot,
                    accessToken: s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid)
                };

                logger.info("AddEditMetric sent to WebSocket");
                logger.debug("AddEditMetric sent to WebSocket: " + JSON.stringify(payload));
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
                case "AddEditMetric":
                    if (response.result === "Ok") {
                        node.widgetUniqueName = response.widgetUniqueName;
                        logger.info("WebSocket server correctly AddEditMetric type: " + response.result);
                        if (node.intervalID != null) {
                            clearInterval(node.intervalID);
                            node.intervalID = null;
                        }
                    } else {
                        logger.error("WebSocket server could not AddEditMetric type: " + response.error);
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: response.error
                        });
                        node.error(response.error);
                    }
                    break;

                case "DelMetric":
                    if (response.result === "Ok") {
                        logger.info("WebSocket server correctly DelMetric type: " + response.result);
                    } else {
                        logger.info("WebSocket server could not DelMetric type: " + response.result);
                    }
                    logger.info("Closing webSocket server after DelMetric message");
                    node.notRestart = true;
                    node.ws.terminate();
                    break;

                default:
                    logger.debug(response.msgType);
                    break;
            }
        };

node.wsCloseCallback = function (e) {
            logger.warn("Closed WebSocket. Reason: " + e);
            if (!(node.dashboardId != null && node.dashboardId != "")) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "No dashboard selected"
                });
                logger.error("No dashboard selected, dashboard Id: " + node.dashboardId);
            } else {
                node.status({
                    fill: "red",
                    shape: "ring",
                    text: "lost connection from " + wsServer
                });
                logger.warn ("Lost connection from "  + wsServer);
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

        node.deleteMetric = function () {
            var newMsg = JSON.stringify({
                msgType: "DelMetric",
                nodeId: node.id,
                metricName: encodeURIComponent(node.metricName),
                metricType: node.metricType,
                user: node.username,
                appId: uid,
                flowId: node.z,
                flowName: node.flowName,
                accessToken: s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid)
            });

            try {
                node.ws.send(newMsg);
                logger.info("Deleting metric via webSocket");
                logger.debug("Deleting metric via webSocket: " + newMsg);
            } catch (e) {
                logger.error("Error deleting metric via webSocket: " + e);
            } 
        };

        node.wsHeartbeatCallback = function () {
            logger.silly("heartbeat callback");
        };

        //Lasciare così, sennò va in timeout!!! https://nodered.org/docs/creating-nodes/node-js#closing-the-node
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

        //Inizio del "main"
        try {
            node.wsInit();
        } catch (e) {
            logger.error("got main exception connecting to WebSocket");
        }

    }

    RED.nodes.registerType("single-content", SingleContentNode);

};