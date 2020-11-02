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

    function EventDrivenMyKPI(config) {
        var io = require('socket.io-client');
        RED.nodes.createNode(this, config);
        var node = this;
        var s4cUtility = require("./snap4city-utility.js");
        const logger = s4cUtility.getLogger(RED, node);
        node.uid = s4cUtility.retrieveAppID(RED);
        node.socketIOUrl = (RED.settings.socketIOUrl ? RED.settings.socketIOUrl : "https://www.snap4city.org");
        node.selectedKPIDataId = config.selectedKPIDataId;
        node.kpiId = config.kpiId.split("-")[0];
        node.whenValueChange = config.whenValueChange;
        node.notRestart = false;
        node.socket = null;

        node.socket = io(node.socketIOUrl, {
            path: "/synoptic/socket.io",
            query: {
                "accessToken": s4cUtility.retrieveAccessToken(RED, node, config.authentication, node.uid),
                "lazyMode": 1,
                "sourceRequest": "iotapp",
                "sourceId": node.uid
            }
        })

        if (!node.whenValueChange) {
            node.socket.io.opts.query.nosyMode = 1;
        }
        node.startTimestamp = new Date().getTime();
        node.socket.connect();

        node.socket.on('connect', function () {
            logger.debug("Receive connect message");
            node.status({
                fill: "green",
                shape: "dot",
                text: "Connected to the server!"
            });

            node.socket.emit("i_need_these", node.kpiId);
            logger.debug("Emit i_need_these message: " + node.kpiId);

            if (node.intervalID != null) {
                clearInterval(node.intervalID);
                node.intervalID = null;
            }
        });
        node.socket.on('connect_error', (error) => {
            logger.error("Receive connect_error message: " + error);
            node.status({
                fill: "orange",
                shape: "dot",
                text: "error to the server!" + error
            });
        });

        node.socket.on('error', (error) => {
            logger.debug("Receive error message: " + error);
        });

        node.socket.on('reconnect_attempt', () => {
            logger.warn("Receive reconnect_attempt");
        });

        node.socket.on(node.kpiId, function (data) {
            logger.warn("Receive node.kpiId");
            var dataParsed = JSON.parse(data);
            if (dataParsed.lastDate > node.startTimestamp) {
                node.send({
                    payload: dataParsed
                });
            }
        });

        node.socket.on('disconnect', function (reason) {
            logger.error("Receive disconnect message: " + reason);
            node.status({
                fill: "red",
                shape: "dot",
                text: "Disconnetted"
            });
            node.startTimestamp = new Date().getTime();
            var wsServerRetryActive = (RED.settings.wsServerRetryActive ? RED.settings.wsServerRetryActive : "yes");
            var wsServerRetryTime = (RED.settings.wsServerRetryTime ? RED.settings.wsServerRetryTime : 30);
            logger.debug("wsServerRetryActive: " + wsServerRetryActive + " node.notRestart: " + node.notRestart + " reason: " + reason);
            if (reason === 'io server disconnect') {
                // the disconnection was initiated by the server, you need to reconnect manually
                logger.info("will try to make a new connection to WebSocket in " + parseInt(wsServerRetryTime) + "s");
                node.socket.io.opts.query.accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, node.uid);
                node.socket.connect();
            } else if (wsServerRetryActive === 'yes' && !node.notRestart) {
                logger.info("will try to reconnect to WebSocket in " + parseInt(wsServerRetryTime) + "s");
                if (!node.intervalID) {
                    node.intervalID = setInterval(node.socket.connect, parseInt(wsServerRetryTime) * 1000);
                }
            }
        });

        node.on('close', function (removed, closedDoneCallback) {

            if (removed) {
                // Cancellazione nodo
                logger.debug("is being removed from flow");
            } else {
                // Riavvio nodo
                logger.debug("is being rebooted");
            }
            node.notRestart = true;
            node.socket.close();
            closedDoneCallback();
        });

        node.closedDoneCallback = function () {
            logger.info("has been closed");
        };

    }

    RED.nodes.registerType("event-driven-my-kpi", EventDrivenMyKPI);

}