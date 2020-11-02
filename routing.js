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

    function Routing(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var s4cUtility = require("./snap4city-utility.js");
        const logger = s4cUtility.getLogger(RED, node);
        node.on('input', function (msg) {
            var uri = (RED.settings.ascapiUrl ? RED.settings.ascapiUrl : "https://www.disit.org/superservicemap/api/v1");
            var startLatitude = (msg.payload.startlatitude ? msg.payload.startlatitude : config.startlatitude);
            var startLongitude = (msg.payload.startlongitude ? msg.payload.startlongitude : config.startlongitude);
            var endLatitude = (msg.payload.endlatitude ? msg.payload.endlatitude : config.endlatitude);
            var endLongitude = (msg.payload.endlongitude ? msg.payload.endlongitude : config.endlongitude);
            var routeType = (msg.payload.routetype ? msg.payload.routetype : config.routetype);
            var tmpDate = (msg.payload.startdatetime ? msg.payload.startdatetime : config.startdatetime);
            var startDatetime = "";
            const uid = s4cUtility.retrieveAppID(RED);
            if (tmpDate) {
                startDatetime = new Date(tmpDate).toISOString();
            } else {
                startDatetime = new Date().toISOString();
            }
            var inPayload = msg.payload;
            var accessToken = "";
            accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid);
            var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
            var xmlHttp = new XMLHttpRequest();
            logger.info(encodeURI(uri + "/shortestpath/?source=" + startLatitude + ";" + startLongitude + "&destination=" + endLatitude + ";" + endLongitude + "&routeType=" + routeType + "&startDatetime=" + startDatetime + "&format=json"));
            xmlHttp.open("GET", encodeURI(uri + "/shortestpath/?source=" + startLatitude + ";" + startLongitude + "&destination=" + endLatitude + ";" + endLongitude + "&routeType=" + routeType + "&startDatetime=" + startDatetime + "&format=json"), true); // false for synchronous request
            xmlHttp.onload = function (e) {
                if (xmlHttp.readyState === 4) {
                    if (xmlHttp.status === 200) {
                        logger.info("ResponseText: " + xmlHttp.responseText);
                        if (xmlHttp.responseText != "") {
                            var response = "";
                            try {
                                response = JSON.parse(xmlHttp.responseText);
                            } catch (error){
                                logger.error("Problem Parsing data " + xmlHttp.responseText);
                            }
                            logger.info("Response: " + response);
                            msg.payload = response;
                        } else {
                            msg.payload = JSON.parse("{\"status\": \"error\"}");
                        }
                        s4cUtility.eventLog(RED, inPayload, msg, config, "Node-Red", "ASCAPI", uri, "RX");
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
        });
    }
    RED.nodes.registerType("routing", Routing);

    RED.httpAdmin.get('/s4c/js/*', function (req, res) {
        var options = {
            root: __dirname + '/lib/js/',
            dotfiles: 'deny'
        };

        res.sendFile(req.params[0], options);
    });

    RED.httpAdmin.get('/s4c/css/*', function (req, res) {
        var options = {
            root: __dirname + '/lib/css/',
            dotfiles: 'deny'
        };

        res.sendFile(req.params[0], options);
    });
}