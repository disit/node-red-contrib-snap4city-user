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

    function ChangeVisibilityMyDevice(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.selectedDeviceDataId = config.selectedDeviceDataId;
        node.deviceId = config.deviceId;
        
        node.deviceDataList = config.deviceDataList ? JSON.parse(config.deviceDataList): [];

        node.on('input', function (msg) {
            var s4cUtility = require("./snap4city-utility.js");
            const logger = s4cUtility.getLogger(RED, node);
            const uid = s4cUtility.retrieveAppID(RED);
            var deviceId = (msg.payload.id ? msg.payload.id : node.deviceId);
			var visibility = (msg.payload.visibility ? msg.payload.visibility : config.visibility);
            if (deviceId) {
                var selectedDevice = null;
                for (var i = 0; i < node.deviceDataList.length;i++){
                    if (node.deviceDataList[i].elementName == deviceId){
                        selectedDevice = node.deviceDataList[i];
                    }
                }
            }

            if (selectedDevice) {
                node.s4cAuth = RED.nodes.getNode(config.authentication);
                var uri = s4cUtility.settingUrl(RED,node, "iotDirectoryUrl", "https://www.snap4city.org", "/iot-directory/") + "api/device.php";
                var inPayload = msg.payload;
                var accessToken = "";

                accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid);

                if (accessToken != "" && typeof accessToken != "undefined") {
                    var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
                    var xmlHttp = new XMLHttpRequest();
                    logger.info(encodeURI(uri + "?action=change_visibility&visibility="+visibility+"&id=" + selectedDevice.elementName + "&contextbroker=" + selectedDevice.elementDetails.contextbroker +"&k1=" + selectedDevice.elementDetails.k1 + "&k2=" + selectedDevice.elementDetails.k2 + "&token=" + accessToken + "&nodered=yes"));
					xmlHttp.open("POST", encodeURI(uri + "?action=change_visibility&visibility="+visibility+"&id=" + selectedDevice.elementName + "&contextbroker=" + selectedDevice.elementDetails.contextbroker +"&k1=" + selectedDevice.elementDetails.k1 + "&k2=" + selectedDevice.elementDetails.k2 + "&token=" + accessToken + "&nodered=yes"), true);
					xmlHttp.setRequestHeader("Content-Type", "application/json");
                    xmlHttp.setRequestHeader("Authorization", "Bearer " + accessToken);
                    xmlHttp.onload = function (e) {
                        if (xmlHttp.readyState === 4) {
                            if (xmlHttp.status === 200) {
                                if (xmlHttp.responseText != "") {
                                    try {
                                        msg.payload = JSON.parse(xmlHttp.responseText);
                                    }catch (e) {
                                        msg.payload = xmlHttp.responseText;
                                        logger.error("Problem Parsing data " + xmlHttp.responseText);
                                    }
                                } else {
                                    msg.payload = JSON.parse("{\"status\": \"There was some problem\"}");
                                }
                                s4cUtility.eventLog(RED, inPayload, msg, config, "Node-Red", "IOTDirectory", uri, "RX");
                                node.send(msg);
                            } else if (xmlHttp.status === 401) {
                                node.error("Unauthorized");
                                logger.error("Unauthorized, accessToken: " + accessToken);
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

                } else {
                    node.error("Open the configuration of the node and redeploy");
                }
            } else {
                node.error("Device ID not configured or sent to input");

            }
        });
    }

    RED.nodes.registerType("change-visibility-my-device", ChangeVisibilityMyDevice);
    
}