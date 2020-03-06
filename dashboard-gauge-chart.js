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

    function GaugeChartNode(config) {
        var WebSocket = require('ws');
        var util = require('util');
        var s4cUtility = require("./snap4city-utility.js");
        var uid = s4cUtility.retrieveAppID(RED);
        RED.nodes.createNode(this, config);
        var node = this;
        var wsServer = (RED.settings.wsServerUrl ? RED.settings.wsServerUrl : "wss://dashboard.km4city.org:443/server");
        node.ws = null;
        node.notRestart = false;
        node.name = config.name;
        node.username = config.username;
        node.flowName = config.flowName;
        node.selectedDashboard = config.selectedDashboard;
        node.dashboardTitle = config.dashboardTitle;
        node.dashboardId = "";
        try {
            var dashboardTitleJson = JSON.parse(node.dashboardTitle);
            node.dashboardTitle =  decodeURI(dashboardTitleJson.title.replace(/\+/g, " "));
            node.dashboardId = dashboardTitleJson.id
        } catch (e) {
            //NOTHING TO DO         
        }
        node.metricName = "NR_" + node.id.replace(".", "_");
        node.metricType = config.metricType;
        node.startValue = config.startValue;
        node.metricShortDesc = config.metricName;
        node.metricFullDesc = config.metricName;
        node.httpRoot = null;

        node.on('input', function (msg) {
            util.log("Flow input received for gauge-chart node " + node.name + ": " + JSON.stringify(msg));

            var timeout = 0;
            if ((new Date().getTime() - node.wsStart) > parseInt(RED.settings.wsReconnectTimeout ? RED.settings.wsReconnectTimeout : 1200) * 1000) {
                node.ws.removeListener('error', node.wsErrorCallback);
                node.ws.removeListener('open', node.wsOpenCallback);
                node.ws.removeListener('message', node.wsMessageCallback);
                node.ws.removeListener('close', node.wsCloseCallback);
                node.notRestart = true;
                node.ws.close();
                node.ws = null;
                node.ws = new WebSocket(wsServer);
                node.ws.on('error', node.wsErrorCallback);
                node.ws.on('open', node.wsOpenCallback);
                node.ws.on('message', node.wsMessageCallback);
                node.ws.on('close', node.wsCloseCallback);
                util.log("gauge-chart node " + node.name + " is reconnetting to open WebSocket");
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
                    util.log("Error sending data to WebSocket for gauge-chart node " + node.name + ": " + e);
                }
            }, timeout);

            s4cUtility.eventLog(RED, msg, newMetricData, config, "Node-Red", "Dashboard", wsServer, "TX");

        });

        node.on('close', function (removed, closedDoneCallback) {
            if (removed) {
                // Cancellazione nodo
                util.log("gauge-chart node " + node.name + " is being removed from flow");
                node.deleteMetric();
            } else {
                // Riavvio nodo
                util.log("gauge-chart node " + node.name + " is being rebooted");
            }
            node.notRestart = true;
            node.ws.close();
            closedDoneCallback();
        });

        node.wsOpenCallback = function () {
            if (node.dashboardTitle != null && node.dashboardTitle != "") {
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
                    widgetType: "widgetGaugeChart",
                    widgetTitle: node.name,
                    dashboardTitle: node.dashboardTitle,
                    dashboardId: node.dashboardId,
                    httpRoot: node.httpRoot,
                    accessToken: s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid)
                };

                util.log("Gauge-chart node " + node.name + " IS GOING TO CONNECT WS");
                if (payload.accessToken != "") {
                    node.ws.send(JSON.stringify(payload));
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Authentication Problem"
                    });
                }
            }
        };

        node.wsMessageCallback = function (data) {
            var response = JSON.parse(data);
            util.log(response);
            switch (response.msgType) {
                case "AddEditMetric":
                    if (response.result === "Ok") {
                        node.widgetUniqueName = response.widgetUniqueName;
                        util.log("WebSocket server correctly added/edited metric type for gauge-chart node " + node.name + ": " + response.result);
                        if (node.intervalID != null){
                            clearInterval(node.intervalID);
                            node.intervalID = null;
                        }
                    } else {
                        //TBD - CASI NEGATIVI DA FARE
                        util.log("WebSocket server could not add/edit metric type for gauge-chart node " + node.name + ": " + JSON.stringify(response));
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "Not created on dashboard"
                        });
                    }
                    break;

                case "DelMetric":
                    if (response.result === "Ok") {
                        util.log("WebSocket server correctly deleted metric type for gauge-chart node " + node.name + ": " + response.result);
                    } else {
                        //TBD - CASI NEGATIVI DA FARE
                        util.log("WebSocket server could not delete metric type for gauge-chart node " + node.name + ": " + response.result);
                    }
                    util.log("Closing webSocket server for gauge-chart node " + node.name);
                    node.notRestart = true;
                    node.ws.close();
                    break;

                default:
                    break;
            }
        };

        node.wsCloseCallback = function (e) {
            util.log("gauge-chart node " + node.name + " closed WebSocket");

            if (node.dashboardTitle == null || node.dashboardTitle == "") {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "No dashboard title inserted or selected"
                });
            } else {
                node.status({
                    fill: "red",
                    shape: "ring",
                    text: "lost connection from " + wsServer
                });
            }

            node.ws.removeListener('error', node.wsErrorCallback);
            node.ws.removeListener('open', node.wsOpenCallback);
            node.ws.removeListener('message', node.wsMessageCallback);
            node.ws.removeListener('close', node.wsCloseCallback);
            node.ws = null;

            var wsServerRetryActive = (RED.settings.wsServerRetryActive ? RED.settings.wsServerRetryActive : "yes");
            var wsServerRetryTime = (RED.settings.wsServerRetryTime ? RED.settings.wsServerRetryTime : 30);
            if (wsServerRetryActive === 'yes' && !node.notRestart) {
                util.log("gauge-chart node " + node.name + " will try to reconnect to WebSocket in " + parseInt(wsServerRetryTime) + "s");
                if (!node.intervalID){
                    node.intervalID = setInterval(node.wsInit, parseInt(wsServerRetryTime) * 1000);
                }
            }
            node.notRestart = false;
        };

        node.wsErrorCallback = function (e) {
            util.log("gauge-chart node " + node.name + " got WebSocket error: " + e);
        };

        node.deleteMetric = function () {
            util.log("Deleting metric via webSocket for gauge-chart node " + node.name);
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
                util.log("Error deleting metric via webSocket for gauge-chart node " + node.name + ": " + e);
            }
        };

        //Lasciare così, sennò va in timeout!!! https://nodered.org/docs/creating-nodes/node-js#closing-the-node
        node.closedDoneCallback = function () {
            util.log("gauge-chart node " + node.name + " has been closed");
        };

        node.wsInit = function (e) {
            util.log("gauge-chart node " + node.name + " is trying to open WebSocket");
            try {
                node.status({
                    fill: "yellow",
                    shape: "dot",
                    text: "connecting to " + wsServer
                });
                if (node.ws == null){
                    node.ws = new WebSocket(wsServer);
                    node.ws.on('error', node.wsErrorCallback);
                    node.ws.on('open', node.wsOpenCallback);
                    node.ws.on('message', node.wsMessageCallback);
                    node.ws.on('close', node.wsCloseCallback);
                    node.wsStart = new Date().getTime();
                } else {
                    util.log("gauge-chart node " + node.name + " already open WebSocket");
                }
            } catch (e) {
                util.log("gauge-chart node " + node.name + " could not open WebSocket");
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
            util.log("gauge-chart node " + node.name + " got main exception connecting to WebSocket");
        }

    }

    RED.nodes.registerType("gauge-chart", GaugeChartNode);

    RED.httpAdmin.get('/dashboardManagerBaseUrl', function (req, res) {
        var dashboardManagerBaseUrl = (RED.settings.dashboardManagerBaseUrl ? RED.settings.dashboardManagerBaseUrl : "https://main.snap4city.org");
        var dashboardSecret = (RED.settings.dashboardSecret ? RED.settings.dashboardSecret : "45awwprty_zzq34");
        res.send({
            "dashboardManagerBaseUrl": dashboardManagerBaseUrl,
            "dashboardSecret": dashboardSecret
        });
    });


};