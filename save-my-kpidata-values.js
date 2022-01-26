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

    function SaveMyKPIDataValues(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.selectedKPIDataId = config.selectedKPIDataId;
        if (config.kpiId) {
            node.kpiId = config.kpiId.split("-")[0];
            node.kpiValueName = config.kpiId.split("-")[1];
            node.kpiDataType = config.kpiId.split("-")[2];
        }

        node.on('input', function (msg) {
            var s4cUtility = require("./snap4city-utility.js");
            const logger = s4cUtility.getLogger(RED, node);
            const uid = s4cUtility.retrieveAppID(RED);
            if (checkValue(msg.payload.value, node.kpiDataType)) {
                var value = msg.payload.value;
                var latitude = msg.payload.latitude;
                var longitude = msg.payload.longitude;
                var dataTime = (msg.payload.datatime ? new Date(msg.payload.datatime).getTime() : new Date().getTime());
                var kpiId = (msg.payload.id ? msg.payload.id : node.kpiId);
                if (kpiId) {
                    node.s4cAuth = RED.nodes.getNode(config.authentication);
                    var uri = s4cUtility.settingUrl(RED,node, "myPersonalDataUrl", "https://www.snap4city.org", "/datamanager/api/v1/") + "kpidata/" + kpiId + "/values/";
                    var inPayload = msg.payload;
                    var accessToken = "";
                    accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid);
                    if (accessToken != "" && typeof accessToken != "undefined") {
                        var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
                        var xmlHttp = new XMLHttpRequest();
                        logger.info(encodeURI(uri + "/?sourceRequest=iotapp"));
                        xmlHttp.open("POST", encodeURI(uri + "/?sourceRequest=iotapp" + (typeof uid != "undefined" && uid != "" ? "&sourceId=" + uid : "")), true);
                        xmlHttp.setRequestHeader("Content-Type", "application/json");
                        xmlHttp.setRequestHeader("Authorization", "Bearer " + accessToken);
                        xmlHttp.onload = function (e) {
                            if (xmlHttp.readyState === 4) {
                                if (xmlHttp.status === 200) {
                                    if (xmlHttp.responseText != "") {
                                        try {
                                            msg.payload = JSON.parse(xmlHttp.responseText);
                                        } catch (e) {
                                            msg.payload = xmlHttp.responseText;
                                        }
                                    } else {
                                        msg.payload = JSON.parse("{\"status\": \"There was some problem\"}");
                                    }
                                    s4cUtility.eventLog(RED, inPayload, msg, config, "Node-Red", "MyData", uri, "RX");
                                    node.send(msg);
                                } else if (xmlHttp.status === 401) {
                                    logger.error("Unauthorized: " + xmlHttp.status);
                                    node.error("Unauthorized");
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
                        try {
                            xmlHttp.send(JSON.stringify({
                                "kpiId": node.kpiId,
                                "value": value,
                                "latitude": latitude,
                                "longitude": longitude,
                                "dataTime": dataTime
                            }));
                        } catch (e) {
                            logger.error(e);
                        }
                    } else {
                        node.error("Open the configuration of the node and redeploy");
                    }
                } else {
                    node.error("KPI ID not configured or sent to input");
                }
            } else {
                node.error("Format error, the value must be a " + node.kpiDataType + " and send as value field of the payload");
            }
        });
    }

    function checkValue(value, dataType) {
        if (dataType == "integer") {
            return !isNaN(parseInt(value));
        } else if (dataType == "float") {
            return !isNaN(parseFloat(value));
        } else if (dataType == "percentage") {
            if (!isNaN(parseFloat(value))) {
                if (parseFloat(value) > 0 && parseFloat(value) < 100) {
                    return true;
                }
            }
            return false;
        }
        return true;
    }

    RED.nodes.registerType("save-my-kpidata-values", SaveMyKPIDataValues);

}