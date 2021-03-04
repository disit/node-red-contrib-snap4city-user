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

    function GetMyDevices(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.filterName = config.filterName;

        node.on('input', function (msg) {
            var s4cUtility = require("./snap4city-utility.js");
            const logger = s4cUtility.getLogger(RED, node);
            const uid = s4cUtility.retrieveAppID(RED);
            var filterName = (msg.payload.filterName ? msg.payload.filterName : node.filterName);
            var uri = (RED.settings.ownershipUrl ? RED.settings.ownershipUrl : "https://www.snap4city.org/ownership-api/") + "v1/list/";
            var inPayload = msg.payload;
            var accessToken = "";
            accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid);
            if (accessToken != "" && typeof accessToken != "undefined") {
                var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
                var xmlHttp = new XMLHttpRequest();
                xmlHttp.open("GET", encodeURI(uri + "/?type=IOTID&accessToken=" + accessToken), true);
                logger.info(encodeURI(uri + "?type=IOTID&accessToken=" + accessToken));
                xmlHttp.setRequestHeader("Content-Type", "application/json");
                xmlHttp.onload = function (e) {
                    if (xmlHttp.readyState === 4) {
                        if (xmlHttp.status === 200) {
                            if (xmlHttp.responseText != "") {
                                try {
                                    var devicesArray = JSON.parse(xmlHttp.responseText);
                                    if (filterName == "") {
                                        msg.payload = devicesArray;
                                    } else {
                                        msg.payload = [];
                                        for (var i = 0; i < devicesArray.length; i++) {
                                            if (devicesArray[i].elementName.toLowerCase().indexOf(filterName.toLowerCase()) != -1) {
                                                msg.payload.push(devicesArray[i]);
                                            }
                                        }
                                    }
                                } catch (e) {
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

        });
    }

    RED.nodes.registerType("get-my-devices", GetMyDevices);

}