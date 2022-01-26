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

    function GetOtherData(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.on('input', function (msg) {
            var s4cUtility = require("./snap4city-utility.js");
            const logger = s4cUtility.getLogger(RED, node);
            const uid = s4cUtility.retrieveAppID(RED);
            node.s4cAuth = RED.nodes.getNode(config.authentication);
            var uri = s4cUtility.settingUrl(RED,node, "myPersonalDataUrl", "https://www.snap4city.org", "/datamanager/api/v1/") + "apps/" + uid + "/data";
            var inPayload = msg.payload;
            var variableName = (msg.payload.variablename ? msg.payload.variablename : config.variablename);
            var motivation = (msg.payload.name ? msg.payload.name : config.name);
            var startdate = (msg.payload.startdate ? msg.payload.startdate : config.startdate);
            var enddate = (msg.payload.enddate ? msg.payload.enddate : config.enddate);
            var last = (msg.payload.last ? msg.payload.last : config.last);
            var accessToken = "";
            accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid);
            if (accessToken != "" && typeof accessToken != "undefined") {
                var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
                var xmlHttp = new XMLHttpRequest();

                logger.info(encodeURI(uri + "/?sourceRequest=iotapp&delegated=true" + (typeof variableName != "undefined" && variableName != "" ? "&variableName=" + variableName : "") + (typeof motivation != "undefined" && motivation != "" ? "&motivation=" + motivation : "") + (typeof startdate != "undefined" && startdate != "" ? "&from=" + startdate : "") + (typeof enddate != "undefined" && enddate != "" ? "&to=" + enddate : "") + (typeof last != "undefined" && last != "" ? "&last=" + last : "")));
                xmlHttp.open("GET", encodeURI(uri + "/?sourceRequest=iotapp&delegated=true" + (typeof variableName != "undefined" && variableName != "" ? "&variableName=" + variableName : "") + (typeof motivation != "undefined" && motivation != "" ? "&motivation=" + motivation : "") + (typeof startdate != "undefined" && startdate != "" ? "&from=" + startdate : "") + (typeof enddate != "undefined" && enddate != "" ? "&to=" + enddate : "") + (typeof last != "undefined" && last != "" ? "&last=" + last : "")), true);
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
                            s4cUtility.eventLog(RED, inPayload, msg, config, "Node-Red", "MyData", uri, "RX");
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

    RED.nodes.registerType("get-other-data", GetOtherData);
}