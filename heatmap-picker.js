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

    function HeatmapPicker(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var s4cUtility = require("./snap4city-utility.js");
        const logger = s4cUtility.getLogger(RED, node);
        node.on('input', function (msg) {
            var metadataUrl = "https://heatmap.snap4city.org/heatmap-metadata.php";
            var interpolationUrl = "https://heatmap.snap4city.org/interp.php";
            var heatmapname = (msg.payload.heatmapname ? msg.payload.heatmapname : config.heatmapname);
            var datetime = (msg.payload.datetime ? msg.payload.datetime : config.datetime);
            var latitude = parseFloat(msg.payload.latitude ? msg.payload.latitude : config.latitude);
            var longitude = parseFloat(msg.payload.longitude ? msg.payload.longitude : config.longitude);
            const uid = s4cUtility.retrieveAppID(RED);
            var inPayload = msg.payload;
            var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
            var xmlHttp = new XMLHttpRequest();
            var xmlHttp2 = new XMLHttpRequest();

            logger.info(encodeURI(metadataUrl + "/?dataset=" + heatmapname + "&latitude_min=" + (latitude - 0.15) + "&latitude_max=" + (latitude + 0.15) + "&longitude_min=" + (longitude - 0.15) + "&longitude_max=" + (longitude + 0.15)));
            xmlHttp.open("GET", encodeURI(metadataUrl + "/?dataset=" + heatmapname + "&latitude_min=" + (latitude - 0.15) + "&latitude_max=" + (latitude + 0.15) + "&longitude_min=" + (longitude - 0.15) + "&longitude_max=" + (longitude + 0.15)), true); // false for synchronous request
            xmlHttp.onload = function (e) {
                if (xmlHttp.readyState === 4) {
                    if (xmlHttp.status === 200) {
                        logger.info("ResponseText: " + xmlHttp.responseText);
                        if (xmlHttp.responseText != "") {
                            try {
                                heatmapMetadata = JSON.parse(xmlHttp.responseText);
                                if (datetime) {
                                    datetime = new Date(datetime).getTime();
                                } else {
                                    datetime = new Date().getTime();
                                }
                                var minDistanceIndex = 0;
                                var currentDistance = 1000000000;
                                if (heatmapMetadata) {
                                    for (var i = 0; i < heatmapMetadata.length; i++) {
                                        if (Math.abs(new Date(heatmapMetadata[i].metadata.date).getTime() - datetime) < currentDistance) {
                                            minDistanceIndex = i;
                                            currentDistance = Math.abs(new Date(heatmapMetadata[i].metadata.date).getTime() - datetime);
                                        }
                                    }
                                }
                            } catch (e) {
                                heatmapMetadata = "";
                            }

                            if (heatmapMetadata != "") {

                                xmlHttp2.open("GET", encodeURI(interpolationUrl + "?dataset=" + heatmapMetadata[minDistanceIndex].metadata.mapName + "&latitude=" + latitude + "&longitude=" + longitude + "&date=" + heatmapMetadata[minDistanceIndex].metadata.date.replace(" ", "T") + ".000Z"), true); // false for synchronous request
                                xmlHttp2.onload = function (e) {
                                    if (xmlHttp2.readyState === 4) {
                                        if (xmlHttp2.status === 200) {
                                            try {
                                                msg.payload = JSON.parse(xmlHttp2.responseText);
                                            } catch (e) {
                                                msg.payload = JSON.parse("{\"status\": \"error\"}");;
                                            }

                                        } else {
                                            msg.payload = xmlHttp2.statusText;
                                        }
                                        node.send(msg);
                                    }
                                };
                                xmlHttp2.onerror = function (e) {
                                    console.error(xmlHttp2.statusText);
                                    node.error(xmlHttp2.responseText);
                                };
                                xmlHttp2.send(null);
                            }
                        }
                    }

                } else {
                    logger.error(xmlHttp.statusText);
                }
            }

            xmlHttp.onerror = function (e) {
                logger.error(xmlHttp.statusText);
                node.error(xmlHttp.responseText);
            };
            xmlHttp.send(null);
        });
    }
    RED.nodes.registerType("heatmap-picker", HeatmapPicker);

}