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
        node.kpiId = config.kpiId.split("-")[0];
        node.kpiValueName = config.kpiId.split("-")[1];
        node.kpiDataType = config.kpiId.split("-")[2];
        

        node.on('input', function (msg) {
            var s4cUtility = require("./snap4city-utility.js");
            var uid = s4cUtility.retrieveAppID(RED);
            if (checkValue(msg.payload.value, node.kpiDataType)) {
                var value = msg.payload.value;
                var latitude = msg.payload.latitude;
                var longitude = msg.payload.longitude;
                var dataTime = (msg.payload.datatime ? new Date(msg.payload.datatime).getTime() : new Date().getTime());
                var uri = (RED.settings.myPersonalDataUrl ? RED.settings.myPersonalDataUrl : "https://www.snap4city.org/mypersonaldata/") + "/api/v1/kpidata/" + node.kpiId + "/values/";
                var inPayload = msg.payload;
                var accessToken = "";
                accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid);
                if (accessToken != "" && typeof accessToken != "undefined") {
                    var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
                    var xmlHttp = new XMLHttpRequest();
                    console.log(encodeURI(uri + "?sourceRequest=iotapp"));
                    xmlHttp.open("POST", encodeURI(uri + "?sourceRequest=iotapp&accessToken=" + accessToken), true);
                    xmlHttp.setRequestHeader("Content-Type", "application/json");
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
                            } else {
                                console.error(xmlHttp.statusText);
                                node.error(xmlHttp.responseText);
                            }
                        }
                    };
                    xmlHttp.onerror = function (e) {
                        console.error(xmlHttp.statusText);
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
                        console.log(e);
                    }
                }
            } else {
                node.error("Format error, the value must be a " + node.kpiDataType);
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


    RED.httpAdmin.get('/myPersonalDataUrl', function (req, res) {
        var myPersonalDataUrl = (RED.settings.myPersonalDataUrl ? RED.settings.myPersonalDataUrl : "https://www.snap4city.org/mypersonaldata/");
        res.send({
            "myPersonalDataUrl": myPersonalDataUrl
        });
    });
}