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

    function IotDirectoryGetDevice(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.on('input', function (msg) {
            var s4cUtility = require("./snap4city-utility.js");
            const logger = s4cUtility.getLogger(RED, node);
            const uid = s4cUtility.retrieveAppID(RED);
            node.s4cAuth = RED.nodes.getNode(config.authentication);
            var uri = ( (node.s4cAuth != null && node.s4cAuth.domain) ? node.s4cAuth.domain + "/iot-directory/" : ( RED.settings.iotDirectoryUrl ? RED.settings.iotDirectoryUrl : "https://www.snap4city.org/iot-directory/" ));
			var inPayload = msg.payload;

            var deviceName = (msg.payload.devicename ? msg.payload.devicename : config.devicename);
            var cbName = (msg.payload.cbname ? msg.payload.cbname : config.cbs);
            var service = (msg.payload.service ? msg.payload.service : config.service);
            var servicePath = (msg.payload.servicepath ? msg.payload.servicepath : config.servicepath);
            var accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid);

            if (accessToken != "" && typeof accessToken != "undefined") {
                var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
                var xmlHttp = new XMLHttpRequest();
                var uri = encodeURI(uri + "/api/device.php?action=get_device_simple&nodered=yes&token=" + accessToken + "&id=" + deviceName + "&contextbroker=" + cbName + (service ? "&service=" + service : "") + (servicePath ? "&servicePath=" + servicePath : ""));
                logger.info(uri);
                xmlHttp.open("GET", uri, true);
                xmlHttp.setRequestHeader("Content-Type", "application/json");
                xmlHttp.setRequestHeader("Authorization", "Bearer " + accessToken);
                xmlHttp.onload = function (e) {
                    if (xmlHttp.readyState === 4) {
                        if (xmlHttp.status === 200) {
                            if (xmlHttp.responseText != "") {
                                try {
                                    msg.payload = JSON.parse(xmlHttp.responseText);
                                } catch (e) {
                                    logger.error("Problem Parsing data " + xmlHttp.responseText);
                                    msg.payload = xmlHttp.responseText;
                                }
                            } else {
                                msg.payload = JSON.parse("{\"status\": \"There was some problem\"}");
                                logger.error("Problem Parsing data " + xmlHttp.responseText);
                            }
                            s4cUtility.eventLog(RED, inPayload, msg, config, "Node-Red", "get-device", uri, "RX");
                            node.send(msg);
                        } else {
                            logger.error(xmlHttp.statusText);
                            node.error(xmlHttp.responseText);
                        }
                    }
                };
                xmlHttp.onerror = function (e) {
                    logger.error(xmlHttp.statusText);
                    node.error(xmlHttp.responseText);
                };
                xmlHttp.send(null);
            }
        });
    }

    RED.nodes.registerType("iotdirectory-get-device", IotDirectoryGetDevice);

    RED.httpAdmin.get('/iotDirectoryUrl', function (req, res) {
        var iotDirectoryUrl = (RED.settings.iotDirectoryUrl ? RED.settings.iotDirectoryUrl : "https://www.snap4city.org/iot-directory/");
        res.send({
            "iotDirectoryUrl": iotDirectoryUrl
        });
    });


    RED.httpAdmin.get('/myCBList', RED.auth.needsPermission('iotdirectory-get-device.read'), function (req, res) {
        var s4cUtility = require("./snap4city-utility.js");
        var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
        var xmlHttp = new XMLHttpRequest();
        var iotDirectoryUrl = (RED.settings.iotDirectoryUrl ? RED.settings.iotDirectoryUrl : "https://iotdirectory.snap4city.org/");
        var accessToken = s4cUtility.retrieveAccessToken(RED, null, null, null);

        if (accessToken != "" && iotDirectoryUrl != "") {
            console.log("scenario online " + iotDirectoryUrl + "/api/contextbroker.php?action=get_all_contextbroker_simple&nodered=yes&token=");
            xmlHttp.open("GET", encodeURI(iotDirectoryUrl + "/api/contextbroker.php?action=get_all_contextbroker_simple&nodered=yes&token=" + accessToken), true); // false for synchronous request
            xmlHttp.onload = function (e) {
                if (xmlHttp.readyState === 4) {
                    if (xmlHttp.status === 200) {
                        console.log("ResponseText: " + xmlHttp.responseText);
                        if (xmlHttp.responseText != "") {
                            try {
                                var response = "";
                                try {
                                    response = JSON.parse(xmlHttp.responseText);
                                } catch (error) {
                                    console.log("Problem Parsing data " + xmlHttp.responseText);
                                }
                                console.log("Response: " + response);
                                res.send({
                                    "cbList": response
                                });
                            } catch (e) {
                                res.send("");
                            }
                        }
                    } else {
                        console.log(xmlHttp.statusText);
                    }
                }
            };
            xmlHttp.onerror = function (e) {
                console.log(xmlHttp.statusText);
            };
            xmlHttp.send(null);
        }
    });
}