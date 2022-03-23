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

    function DashboardCalendarNode(config) {
        var WebSocket = require('ws');
        var util = require('util');
        var s4cUtility = require("./snap4city-utility.js");
        var uid = s4cUtility.retrieveAppID(RED);
        RED.nodes.createNode(this, config);
        var node = this;
        node.s4cAuth = RED.nodes.getNode(config.authentication);
        var wsServer = ( (node.s4cAuth != null && node.s4cAuth.domain) ? node.s4cAuth.domain.replace("https", "wss").replace("http", "ws") : ( RED.settings.wsServerUrl ? RED.settings.wsServerUrl : "https://www.snap4city.org" )) + "/wsserver";
        var wsServerHttpOrigin = ( (node.s4cAuth != null && node.s4cAuth.domain) ? node.s4cAuth.domain : ( RED.settings.wsServerHttpOrigin ? RED.settings.wsServerHttpOrigin : "https://www.snap4city.org" ));
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
        node.widgetUniqueName = null;

        node.on('input', function (msg) {
            util.log("Flow input received for dashboard-calendar node " + node.name + ": " + JSON.stringify(msg));

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
                    util.log("Why ws is null? I am in node.on('input'")
                }
                node.ws = new WebSocket(wsServer, {
                    origin: wsServerHttpOrigin
                });
                node.ws.on('error', node.wsErrorCallback);
                node.ws.on('open', node.wsOpenCallback);
                node.ws.on('message', node.wsMessageCallback);
                node.ws.on('close', node.wsCloseCallback);
                node.ws.on('pong', node.wsHeartbeatCallback);
                util.log("dashboard-calendar node " + node.name + " is reconnetting to open WebSocket");
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

            setTimeout(function () {
                try {
                    node.ws.send(JSON.stringify(newMetricData));
                } catch (e) {
                    util.log("Error sending data to WebSocket for dashboard-calendar node " + node.name + ": " + e);
                }
            }, timeout);

            s4cUtility.eventLog(RED, msg, newMetricData, config, "Node-Red", "Dashboard", wsServer, "TX");

        });

        node.on('close', function (removed, closedDoneCallback) {
            if (removed) {
                // Cancellazione nodo
                util.log("dashboard-calendar node " + node.name + " is being removed from flow");

                node.deleteMetric();
            } else {
                // Riavvio nodo
                util.log("dashboard-calendar node " + node.name + " is being rebooted");
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
                    widgetType: "widgetCalendar",
                    widgetTitle: node.name,
                    dashboardTitle: "",
                    dashboardId: node.dashboardId,
                    httpRoot: node.httpRoot,
                    accessToken: s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid),
                    widgetUniqueName: node.widgetUniqueName
                };

                //util.log(payload);
                if (node.pingInterval == null) {
                    node.pingInterval = setInterval(function () {
                        //util.log(node.name + "ping");
                        if (node.ws != null) {
                            try {
                                node.ws.ping();
                            } catch (e) {
                                util.log("Errore on Ping " + e);
                            }
                        }
                    }, 30000);
                }

                util.log("dashboard-calendar node " + node.name + " IS GOING TO CONNECT WS");
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
                }
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "No dashboard selected"
                });
            }
        };

        node.wsMessageCallback = function (data) {
            var response = JSON.parse(data);
            util.log(response);
            switch (response.msgType) {
                case "AddEditMetric":
                    if (response.result === "Ok") {
                        node.widgetUniqueName = response.widgetUniqueName;

                        util.log("WebSocket server correctly added/edited metric type for dashboard-calendar node " + node.name + ": " + response.result);
                        if (node.intervalID != null) {
                            clearInterval(node.intervalID);
                            node.intervalID = null;
                        }
                    } else {
                        //TBD - CASI NEGATIVI DA FARE
                        util.log("WebSocket server could not add/edit metric type for dashboard-calendar node " + node.name + ": " + response.result);
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
                        util.log("WebSocket server correctly deleted metric type for dashboard-calendar node " + node.name + ": " + response.result);
                    } else {
                        //TBD - CASI NEGATIVI DA FARE
                        util.log("WebSocket server could not delete metric type for dashboard-calendar node " + node.name + ": " + response.result);
                    }
                    util.log("Closing webSocket server for dashboard-calendar node " + node.name);
                    node.notRestart = true;
                    node.ws.terminate();
                    break;

                default:
                    util.log(response.msgType);
                    break;
            }
        };

        node.wsCloseCallback = function (e) {
            util.log("dashboard-calendar node " + node.name + " closed WebSocket");
            util.log("dashboard-calendar closed reason " + e);
            if (!(node.dashboardId != null && node.dashboardId != "")) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "No dashboard selected"
                });
            } else {
                node.status({
                    fill: "red",
                    shape: "ring",
                    text: "lost connection from " + wsServer
                });
            }

            if (node.ws != null) {
                node.ws.removeListener('error', node.wsErrorCallback);
                node.ws.removeListener('open', node.wsOpenCallback);
                node.ws.removeListener('message', node.wsMessageCallback);
                node.ws.removeListener('close', node.wsCloseCallback);
                node.ws.removeListener('pong', node.wsHeartbeatCallback);
                node.ws = null;
            } else {
                util.log("Why ws is null? I am in node.wsCloseCallback")
            }

            var wsServerRetryActive = (RED.settings.wsServerRetryActive ? RED.settings.wsServerRetryActive : "yes");
            var wsServerRetryTime = (RED.settings.wsServerRetryTime ? RED.settings.wsServerRetryTime : 30);
            //util.log("dashboard-calendar wsServerRetryActive: " + wsServerRetryActive);
            //util.log("dashboard-calendar node.notRestart: " + node.notRestart);
            if (wsServerRetryActive === 'yes' && !node.notRestart) {
                util.log("dashboard-calendar node " + node.name + " will try to reconnect to WebSocket in " + parseInt(wsServerRetryTime) + "s");
                if (!node.intervalID) {
                    node.intervalID = setInterval(node.wsInit, parseInt(wsServerRetryTime) * 1000);
                }
            }
            node.notRestart = false;
        };

        node.wsErrorCallback = function (e) {
            util.log("dashboard-calendar node " + node.name + " got WebSocket error: " + e);
        };

        node.deleteMetric = function () {
            util.log("Deleting metric via webSocket for dashboard-calendar node " + node.name);
            var newMsg = {
                msgType: "DelMetric",
                nodeId: node.id,
                metricName: encodeURIComponent(node.metricName),
                metricType: node.metricType,
                user: node.username,
                appId: uid,
                flowId: node.z,
                flowName: node.flowName,
                accessToken: s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid)
            };

            try {
                node.ws.send(JSON.stringify(newMsg));
            } catch (e) {
                util.log("Error deleting metric via webSocket for dashboard-calendar node " + node.name + ": " + e);
            }
        };

        node.wsHeartbeatCallback = function () {

        };



        //Lasciare così, sennò va in timeout!!! https://nodered.org/docs/creating-nodes/node-js#closing-the-node
        node.closedDoneCallback = function () {
            util.log("dashboard-calendar node " + node.name + " has been closed");
        };

        node.wsInit = function (e) {
            util.log("dashboard-calendar node " + node.name + " is trying to open WebSocket");
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
                    util.log("dashboard-calendar node " + node.name + " already open WebSocket");
                }
            } catch (e) {
                util.log("dashboard-calendar node " + node.name + " could not open WebSocket");
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
            util.log("dashboard-calendar node " + node.name + " got main exception connecting to WebSocket");
        }

    }

    RED.nodes.registerType("dashboard-calendar", DashboardCalendarNode);

};