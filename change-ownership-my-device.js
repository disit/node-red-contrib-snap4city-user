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

    function ChangeOwnershipMyDevice(config) { 
			RED.nodes.createNode(this, config);
			var node = this;
			node.selectedDeviceDataId = config.selectedDeviceDataId;
			node.deviceId = config.deviceId;
			if (config.deviceId) {
				node.deviceId = config.deviceId.split("-")[1];
			}
			node.currentDeviceDataList = config.currentDeviceDataList ? JSON.parse(config.currentDeviceDataList): [];
			node.usernamedelegated = config.delegated;

			node.on('input', function (msg) {
				var s4cUtility = require("./snap4city-utility.js");
				const logger = s4cUtility.getLogger(RED, node);
				const uid = s4cUtility.retrieveAppID(RED);
				var deviceId = (msg.payload.deviceId ? msg.payload.deviceId : node.deviceId);

				if (deviceId) {
					var selectedDevice = null;
					for (var i = 0; i < node.currentDeviceDataList.length;i++){
						if (node.currentDeviceDataList[i].elementName== deviceId){
							selectedDevice = node.currentDeviceDataList[i];
						}
					}
				}

            if (selectedDevice) {
                node.s4cAuth = RED.nodes.getNode(config.authentication);
                var uri = ( (node.s4cAuth != null && node.s4cAuth.domain) ? node.s4cAuth.domain  : ( RED.settings.ownershipUrl ? RED.settings.ownershipUrl : "https://www.snap4city.org/")) + "/ownership-api/v1/register/";
                var usernamedelegated = (msg.payload.newownership ? msg.payload.newownership : node.usernamedelegated);
                var inPayload = msg.payload;
                var accessToken = "";

                accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid);

                if (accessToken != "" && typeof accessToken != "undefined") {
                    var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
                    var xmlHttp = new XMLHttpRequest();
                    xmlHttp.open("POST", encodeURI(uri + "/?sourceRequest=iotapp&accessToken=" + accessToken), true);
                    logger.info(encodeURI(uri + "/?sourceRequest=iotapp"));
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
                    xmlHttp.send(JSON.stringify({
                        "elementId": selectedDevice.elementId,
                        "elementType": "IOTID",
                        "elementName": selectedDevice.elementName,
                        "username": usernamedelegated
                    }));

                } else {
                    node.error("Open the configuration of the node and redeploy");
                }
            } else {
                node.error("Device ID not configured or sent to input or you are not the owner");
            }
        });
    }

    RED.nodes.registerType("change-ownership-my-device", ChangeOwnershipMyDevice);


    RED.httpAdmin.get('/ownershipUrl', function (req, res) {
        var ownershipUrl = (RED.settings.ownershipUrl ? RED.settings.ownershipUrl : "https://www.snap4city.org/ownership-api/");
        res.send({
            "ownershipUrl": ownershipUrl
        });
    });

    RED.httpAdmin.get('/myDeviceDataList', RED.auth.needsPermission('change-ownership-my-device.read'), function (req, res) {
        var s4cUtility = require("./snap4city-utility.js");
        var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
        var xmlHttp = new XMLHttpRequest();
        var url = (RED.settings.ownershipUrl ? RED.settings.ownershipUrl : "https://www.snap4city.org/ownership-api/");
        var accessToken = s4cUtility.retrieveAccessToken(RED, null, null, null);
        if (accessToken != "" && url != "") {
            xmlHttp.open("GET", encodeURI(url + "v1/list/?type=IOTID&onlyMine=true&accessToken=" + accessToken), true);
            xmlHttp.onload = function (e) {
                if (xmlHttp.readyState === 4) {
                    if (xmlHttp.status === 200) {
                        console.log("ResponseText: " + xmlHttp.responseText);
                        if (xmlHttp.responseText != "") {
                            try {
                                var response = "";
                            try {
                                response = JSON.parse(xmlHttp.responseText);
                            } catch (error){
                                console.log("Problem Parsing data " + xmlHttp.responseText);
                            }
                            console.log("Response: " + response);
                                res.send({
                                    "deviceDataList": response
                                });
                            } catch (e) {
                                res.status(500).send({"error": "Parsing Error of the list"});
                            }
                        } else {
                            console.log("Empty Response Text");
                            res.status(500).send({"error": "Empty Response Text"});
                        }
                    } else {
                        console.log(xmlHttp.statusText);
                        res.status(xmlHttp.status).send({"error": "The status returned from the service that provide the list"});
                    }
                } else {
                    console.log(xmlHttp.statusText)
                    res.status(500).send({"error": "Something goes wrong. XMLHttpRequest.readyState = " + xmlHttp.readyState});
                }
            };
            xmlHttp.onerror = function (e) {
                console.log(xmlHttp.statusText);
                res.status(500).send({"error": "Cannot call the url to get the list"});
            };
            xmlHttp.send(null);
        } else {
            res.status(500).send({"error": "Cannot get the accessToken"});
        }
    });
}