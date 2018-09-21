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

    function SwitchButton(config) {
        var WebSocket = require('ws');
        var util = require('util');
        var s4cUtility = require("./snap4city-utility.js");
        var uid = s4cUtility.retrieveAppID(RED);
        RED.nodes.createNode(this, config);
        var node = this;
        var wsServer = (RED.settings.wsServerUrl ? RED.settings.wsServerUrl : "wss://dashboard.km4city.org:443/server");
        node.ws = null;

        //Meccanismo di passaggio dei valori tra il menu di add/edit node e il codice del nodo
        node.name = "NR_" + node.id.replace(".", "_");
        node.widgetTitle = config.name,
            node.username = config.username;
        node.flowName = config.flowName;
        node.selectedDashboard = config.selectedDashboard;
        node.dashboardTitle = config.dashboardTitle;
        node.dashboardId = "";
        try {
            var dashboardTitleJson = JSON.parse(node.dashboardTitle);
            node.dashboardTitle = dashboardTitleJson.title;
            node.dashboardId = dashboardTitleJson.id
        } catch (e) {
            //NOTHING TO DO         
        }
        node.valueType = config.valueType;
        node.startValue = "Off";
        node.minValue = null;
        node.maxValue = null;
        node.offValue = config.offValue;
        node.onValue = config.onValue;
        node.domain = "onOff";
        //node.httpServer = null;
        node.httpRoot = null;

        node.on('close', function (removed, closedDoneCallback) {
            if (removed) {
                // Cancellazione nodo
                util.log("single-content node " + node.name + " is being removed from flow");
                node.deleteEmitter();
            } else {
                // Riavvio nodo
                util.log("single-content node " + node.name + " is being rebooted");
            }
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

                var payload = {
                    msgType: "AddEmitter",
                    name: node.name,
                    valueType: node.valueType,
                    user: node.username,
                    startValue: node.startValue,
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
                    widgetType: "widgetOnOffButton",
                    widgetTitle: node.widgetTitle,
                    dashboardTitle: node.dashboardTitle,
                    dashboardId: node.dashboardId,
                    accessToken: s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid)
                };

                util.log(payload);

                util.log("switch-button node " + node.name + " IS GOING TO CONNECT WS");
                if (payload.accessToken != "") {
                    node.ws.send(JSON.stringify(payload));
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
                    text: "No dashboard title inserted or selected"
                });
            }
        };

        node.wsMessageCallback = function (data) {
            var response = JSON.parse(data);
            console.log(response);
            switch (response.msgType) {
                case "AddEmitter":
                    if (response.result === "Ok") {
                        node.widgetUniqueName = response.widgetUniqueName;
                        util.log("WebSocket server correctly added/edited emitter type for switch-button node " + node.name + ": " + response.result);
                        node.status({
                            fill: "green",
                            shape: "dot",
                            text: "Created on dashboard"
                        });
                    } else {
                        //TBD - CASI NEGATIVI DA FARE
                        util.log("WebSocket server could not add/edit emitter type for switch-button node " + node.name + ": " + response.result);
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "Not created on dashboard"
                        });
                    }
                    break;

                case "DelEmitter":
                    if (response.result === "Ok") {
                        util.log("WebSocket server correctly deleted emitter type for switch-button node " + node.name + ": " + response.result);
                    } else {
                        //TBD - CASI NEGATIVI DA FARE
                        util.log("WebSocket server could not delete emitter type for switch-button node " + node.name + ": " + response.result);
                    }
                    util.log("Closing webSocket server for switch-button node " + node.name);
                    node.ws.close();
                    break;
                case "DataToEmitter":
                    if (response.newValue != "dashboardDeleted") {
                        if (node.valueType === 'Float') {
                            msg = {
                                payload: parseFloat(response.newValue)
                            };
                        } else if (node.valueType === 'Integer') {
                            msg = {
                                payload: parseInt(response.newValue)
                            };
                        } else {
                            msg = {
                                payload: response.newValue
                            };
                        }
                       
                        node.send(msg);
                        
                        node.ws.send(JSON.stringify({
                            msgType: "DataToEmitterAck",
                            widgetUniqueName: node.widgetUniqueName,
                            result: "Ok",
                            msgId: response.msgId
                        }));
                    } else {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "Dashboard deleted"
                        });
                        node.selectedDashboard = "";
                    }
                    s4cUtility.eventLog(RED, msg, msg, config, "Node-Red", "Dashboard", RED.settings.httpRoot + node.name, "RX");
                    break;
                default:
                    break;
            }
        };

        node.wsCloseCallback = function (e) {
            util.log("switch-button node " + node.name + " closed WebSocket");

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
            if (wsServerRetryActive === 'yes') {
                util.log("switch-button node " + node.name + " will try to reconnect to WebSocket in " + parseInt(wsServerRetryTime) + "s");
                setTimeout(node.wsInit, parseInt(wsServerRetryTime) * 1000);
            }
        };

        node.wsErrorCallback = function (e) {
            util.log("switch-button node " + node.name + " got WebSocket error: " + e);
        };

        node.deleteEmitter = function () {
            util.log("Deleting emitter via webSocket for switch-button node " + node.name);
            var newMsg = {
                msgType: "DelEmitter",
                nodeId: node.id,
                user: node.username,
                appId: uid,
                flowId: node.z,
                flowName: node.flowName
            };

            try {
                node.ws.send(JSON.stringify(newMsg));
            } catch (e) {
                util.log("Error deleting emitter via webSocket for switch-button node " + node.name + ": " + e);
            }
        };

        //Lasciarlo, altrimenti va in timeout!!! https://nodered.org/docs/creating-nodes/node-js#closing-the-node
        node.closedDoneCallback = function () {
            util.log("switch-button node " + node.name + " has been closed");
        };

        node.wsInit = function (e) {
            util.log("switch-button node " + node.name + " is trying to open WebSocket");
            try {
                node.status({
                    fill: "yellow",
                    shape: "dot",
                    text: "connecting to " + wsServer
                });
                node.ws = new WebSocket(wsServer);
                node.ws.on('error', node.wsErrorCallback);
                node.ws.on('open', node.wsOpenCallback);
                node.ws.on('message', node.wsMessageCallback);
                node.ws.on('close', node.wsCloseCallback);
                node.wsStart = new Date().getTime();
            } catch (e) {
                util.log("switch-button node " + node.name + " could not open WebSocket");
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
            util.log("switch-button node " + node.name + " got main exception connecting to WebSocket");
        }

    }

    RED.nodes.registerType("switch-button", SwitchButton);

    RED.httpAdmin.get('/dashboardManagerBaseUrl', function (req, res) {
        var dashboardManagerBaseUrl = (RED.settings.dashboardManagerBaseUrl ? RED.settings.dashboardManagerBaseUrl : "https://main.snap4city.org");
        var dashboardSecret = (RED.settings.dashboardSecret ? RED.settings.dashboardSecret : "45awwprty_zzq34");
        res.send({
            "dashboardManagerBaseUrl": dashboardManagerBaseUrl,
            "dashboardSecret": dashboardSecret
        });
    });

    RED.httpAdmin.get("/retrieveAccessTokenLocal/", RED.auth.needsPermission('switch-button.read'), function (req, res) {
        var s4cUtility = require("./snap4city-utility.js");
        res.json({
            "accessToken": s4cUtility.retrieveAccessToken(RED, null, null, null)
        });
    });
};