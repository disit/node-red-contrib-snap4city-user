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

    function EdgeTunnelToCloud(config) {
        var s4cUtility = require("./snap4city-utility.js");
        const logger = s4cUtility.getLogger(RED, node);
        var os = require('os');
        var fs = require('fs');
        RED.nodes.createNode(this, config);
        var node = this;
        if (!fs.existsSync('/data/refresh_token')) {
            const uid = s4cUtility.retrieveAppID(RED);
            var accessToken = "";
            accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid);
            var url = (RED.settings.ownershipUrl ? RED.settings.ownershipUrl : "https://www.snap4city.org/ownership-api/") + "/v1/register/?";
            var params = "accessToken=" + accessToken + "&wstunnel=true";
            var iplocal = null;
            var ifaces = os.networkInterfaces();
            Object.keys(ifaces).forEach(function (ifname) {
                ifaces[ifname].forEach(function (iface) {
                    if ('IPv4' !== iface.family || iface.internal !== false) {
                        // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                        return;
                    }
                    if (iface.address.indexOf("192.168") != -1) {
                        iplocal = iface.address;
                        return;
                    }
                });
            });
            var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
            var xmlHttp = new XMLHttpRequest();
            logger.info(encodeURI(url));
            xmlHttp.open("POST", encodeURI(url + params), true);
            xmlHttp.setRequestHeader("Content-Type", "application/json");
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
                            log4js = require('log4js');
                            var wstun = require('./lib/@mdslab/wstun');
                            reverse_client = new wstun.client_reverse1();
                            wstunHost = (RED.settings.wsTunnelUrl ? RED.settings.wsTunnelUrl : "wss://www.snap4city.org/wstunnel");
                            reverse_client.start(uid, wstunHost, '127.0.0.1:1880');
                        }
                    }
                }
            }
            var message = {
                elementId: uid,
                elementType: "AppID",
                elementName: new Date().toJSON().slice(0, 16),
                elementUrl: "http://" + iplocal + ":" + RED.settings.uiPort,
                elementDetails: {
                    edgegateway_type: os.platform() + "_" + os.type() + "_" + os.release()
                }
            };
            xmlHttp.send(JSON.stringify(message));
        } else {
            node.error("You cannot use this node inside the Snap4city platform but only on your own device to connect from the platform to the RED node installed in the device.");
        }

    }
    RED.nodes.registerType("edge-tunnel-to-cloud", EdgeTunnelToCloud);
}