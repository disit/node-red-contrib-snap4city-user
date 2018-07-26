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

    function eventLog(inPayload, outPayload, config, _agent, _motivation, _ipext, _modcom) {
        var os = require('os');
        var ifaces = os.networkInterfaces();
        var uri = "http://192.168.1.43/RsyslogAPI/rsyslog.php";

        var pidlocal = RED.settings.APPID;
        var iplocal = null;
        Object.keys(ifaces).forEach(function (ifname) {
            ifaces[ifname].forEach(function (iface) {
                if ('IPv4' !== iface.family || iface.internal !== false) {
                    // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                    return;
                }
                iplocal = iface.address;
            });
        });
        iplocal = iplocal + ":" + RED.settings.uiPort;
        var timestamp = new Date().getTime();
        var modcom = _modcom;
        var ipext = _ipext;
        var payloadsize = JSON.stringify(outPayload).length / 1000;
        var agent = _agent;
        var motivation = _motivation;
        var lang = (inPayload.lang ? inPayload.lang : config.lang);
        var lat = (inPayload.lat ? inPayload.lat : config.lat);
        var lon = (inPayload.lon ? inPayload.lon : config.lon);
        var serviceuri = (inPayload.serviceuri ? inPayload.serviceuri : config.serviceuri);
        var message = (inPayload.message ? inPayload.message : config.message);
        var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
        var xmlHttp = new XMLHttpRequest();
        console.log(encodeURI(uri + "?p=log" + "&pid=" + pidlocal + "&tmstmp=" + timestamp + "&modCom=" + modcom + "&IP_local=" + iplocal + "&IP_ext=" + ipext +
            "&payloadSize=" + payloadsize + "&agent=" + agent + "&motivation=" + motivation + "&lang=" + lang + "&lat=" + (typeof lat != "undefined" ? lat : 0.0) + "&lon=" + (typeof lon != "undefined" ? lon : 0.0) + "&serviceUri=" + serviceuri + "&message=" + message));
        xmlHttp.open("GET", encodeURI(uri + "?p=log" + "&pid=" + pidlocal + "&tmstmp=" + timestamp + "&modCom=" + modcom + "&IP_local=" + iplocal + "&IP_ext=" + ipext +
            "&payloadSize=" + payloadsize + "&agent=" + agent + "&motivation=" + motivation + "&lang=" + lang + "&lat=" + (typeof lat != "undefined" ? lat : 0.0) + "&lon=" + (typeof lon != "undefined" ? lon : 0.0) + "&serviceUri=" + serviceuri + "&message=" + message), true); // false for synchronous request
        xmlHttp.send(null);
    }

    var WebSocket = require('ws');

    function BarContentNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var wsServer = RED.settings.wsServerUrl;
        node.ws = null;
        node.name = config.name;
        node.username = config.username;
        node.flowName = config.flowName;
        node.selectedDashboard = config.selectedDashboard;
        node.dashboardTitle = config.dashboardTitle;
        node.metricName = "NR_" + node.id.replace(".", "_");
        node.metricType = config.metricType;
        node.startValue = config.startValue;
        node.metricShortDesc = config.metricName;
        node.metricFullDesc = config.metricName;
        node.httpRoot = null;

        node.getNow = function () {
            var now = new Date();
            return now.getDate() + "/" + (now.getMonth() + 1) + "/" + now.getFullYear() + " " + now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds();
        };

        node.openWsConn = function () {
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

                console.log("HTTP ROOT: " + node.httpRoot);

                //Registrazione della nuova metrica presso il Dashboard Manager
                var newMetric = {
                    msgType: "AddEditMetric",
                    metricName: encodeURIComponent(node.metricName),
                    metricType: node.metricType,
                    nodeId: node.id,
                    startValue: node.startValue,
                    user: node.username,
                    metricShortDesc: node.metricShortDesc,
                    metricFullDesc: node.metricFullDesc,
                    appId: RED.settings.APPID,
                    flowId: node.z,
                    flowName: node.flowName,
                    widgetType: "widgetBarContent",
                    widgetTitle: node.name,
                    dashboardTitle: node.dashboardTitle,
                    httpRoot: node.httpRoot,
                    accessToken: retrieveAccessToken()
                };

                node.ws.send(JSON.stringify(newMetric));
            }
        };

        node.on('input', function (msg) {
            console.log(node.getNow() + " - Flow input received for gauge-chart node " + node.name + ": " + msg);


            var timeout = 0;
            if ((new Date().getTime() - node.wsStart) > parseInt(RED.settings.wsReconnectTimeout) * 1000) {
                node.ws.close();
                node.ws.removeListener('error', node.wsError);
                node.ws.removeListener('open', node.openWsConn);
                node.ws.removeListener('message', node.manageIncomingWsMsg);
                node.ws.removeListener('close', node.wsClosed);
                node.ws.close();
                node.ws = null;
                node.ws = new WebSocket(wsServer);
                node.ws.on('error', node.wsError);
                node.ws.on('open', node.openWsConn);
                node.ws.on('message', node.manageIncomingWsMsg);
                node.ws.on('close', node.wsClosed);
                console.log(node.getNow() + " - gauge-chart node " + node.name + " is reconnetting to open WebSocket");
                timeout = 1000;
            }
            node.wsStart = new Date().getTime();

            var newMetricData = {
                msgType: "AddMetricData",
                nodeId: node.id,
                metricName: encodeURIComponent(node.metricName),
                metricType: node.metricType,
                newValue: msg.payload,
                appId: RED.settings.APPID,
                user: node.username,
                flowId: node.z,
                flowName: node.flowName
            };

            setTimeout(function () {
                try {
                    node.ws.send(JSON.stringify(newMetricData));
                } catch (e) {
                    console.log(node.getNow() + " - Error sending data to WebSocket for gauge-chart node " + node.name + ": " + e);
                }
            }, timeout);

            eventLog(msg, newMetricData, config, "Node-Red", "Dashboard", wsServer, "TX");

        });



        this.manageIncomingWsMsg = function (data) {
            var response = JSON.parse(data);
            switch (response.msgType) {
                case "AddEditMetric":
                    if (response.result === "Ok") {
                        console.log(node.getNow() + " - WebSocket server correctly added/edited metric type for gauge-chart node " + node.name + ": " + response.result);
                    } else {
                        //TBD - CASI NEGATIVI DA FARE
                        console.log(node.getNow() + " - WebSocket server could not add/edit metric type for gauge-chart node " + node.name + ": " + response.result);
                    }
                    break;

                case "DelMetric":
                    if (response.result === "Ok") {
                        console.log(node.getNow() + " - WebSocket server correctly deleted metric type for gauge-chart node " + node.name + ": " + response.result);
                    } else {
                        //TBD - CASI NEGATIVI DA FARE
                        console.log(node.getNow() + " - WebSocket server could not delete metric type for gauge-chart node " + node.name + ": " + response.result);
                    }
                    console.log(node.getNow() + " - Closing webSocket server for gauge-chart node " + node.name);
                    node.ws.close();
                    break;

                default:
                    break;
            }
        };

        this.delMetric = function () {
            console.log(node.getNow() + " - Deleting metric via webSocket for gauge-chart node " + node.name);
            var newMsg = {
                msgType: "DelMetric",
                nodeId: node.id,
                metricName: encodeURIComponent(node.metricName),
                metricType: node.metricType,
                user: node.username,
                appId: RED.settings.APPID,
                flowId: node.z,
                flowName: node.flowName
            };

            try {
                node.ws.send(JSON.stringify(newMsg));
            } catch (e) {
                console.log(node.getNow() + " - Error deleting metric via webSocket for gauge-chart node " + node.name + ": " + e);
            }
        };

        this.openWs = function (e) {
            console.log(node.getNow() + " - gauge-chart node " + node.name + " is trying to open WebSocket");
            try {
                node.status({
                    fill: "yellow",
                    shape: "dot",
                    text: "connecting to " + wsServer
                });
                node.ws = new WebSocket(wsServer);
                node.ws.on('error', node.wsError);
                node.ws.on('open', node.openWsConn);
                node.ws.on('message', node.manageIncomingWsMsg);
                node.ws.on('close', node.wsClosed);
                node.wsStart = new Date().getTime();
            } catch (e) {
                console.log(node.getNow() + " - gauge-chart node " + node.name + " could not open WebSocket");
                node.status({
                    fill: "red",
                    shape: "ring",
                    text: "unable to connect to " + wsServer
                });
                node.wsClosed();
            }
        };

        this.wsClosed = function (e) {
            console.log(node.getNow() + " - gauge-chart node " + node.name + " closed WebSocket");

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

            node.ws.removeListener('error', node.wsError);
            node.ws.removeListener('open', node.openWsConn);
            node.ws.removeListener('message', node.manageIncomingWsMsg);
            node.ws.removeListener('close', node.wsClosed);
            node.ws = null;

            if (RED.settings.wsServerRetryActive === 'yes') {
                console.log(node.getNow() + " - gauge-chart node " + node.name + " will try to reconnect to WebSocket in " + parseInt(RED.settings.wsServerRetryTime) + "s");
                setTimeout(node.openWs, parseInt(RED.settings.wsServerRetryTime) * 1000);
            }
        };

        this.wsError = function (e) {
            console.log(node.getNow() + " - gauge-chart node " + node.name + " got WebSocket error: " + e);
        };

        //Inizio del "main"
        try {
            node.openWs();
        } catch (e) {
            console.log(node.getNow() + " - gauge-chart node " + node.name + " got main exception connecting to WebSocket");
        }

        //Lasciare così, sennò va in timeout!!! https://nodered.org/docs/creating-nodes/node-js#closing-the-node
        this.nodeClosingDone = function () {
            console.log(node.getNow() + " - gauge-chart node " + node.name + " has been closed");
        };

        this.on('close', function (removed, nodeClosingDone) {
            if (removed) {
                // Cancellazione nodo
                console.log(node.getNow() + " - gauge-chart node " + node.name + " is being removed from flow");
                node.delMetric();
            } else {
                // Riavvio nodo
                console.log(node.getNow() + " - gauge-chart node " + node.name + " is being rebooted");
            }
            node.ws.close();
            nodeClosingDone();

        });

    }

    function retrieveAccessToken() {
        var fs = require('fs');
        var refreshToken = fs.readFileSync('/data/refresh_token', 'utf-8');
        var url = "https://www.snap4city.org/auth/realms/master/protocol/openid-connect/token/";
        var params = "client_id=nodered&client_secret=943106ae-c62c-4961-85a2-849f6955d404&grant_type=refresh_token&scope=openid profile&refresh_token=" + refreshToken;
        var response = "";
        var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
        var xmlHttp = new XMLHttpRequest();
        console.log(encodeURI(url));
        xmlHttp.open("POST", encodeURI(url), false);
        xmlHttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xmlHttp.send(params);
        if (xmlHttp.responseText != "") {
            try {
                response = JSON.parse(xmlHttp.responseText);
            } catch (e) {}
        }
        if (response != "") {
            fs.writeFileSync('/data/refresh_token', response.refresh_token);
            return response.access_token;
        }
        return response;
    }
    RED.nodes.registerType("bar-content", BarContentNode);
};