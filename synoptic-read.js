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

    function SynopticRead(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var io = require('socket.io-client');
        var s4cUtility = require("./snap4city-utility.js");
        const logger = s4cUtility.getLogger(RED, node);

        node.uid = s4cUtility.retrieveAppID(RED);
        node.s4cAuth = RED.nodes.getNode(config.authentication);
        node.socketIOUrl = (node.s4cAuth != null && node.s4cAuth.domain ? node.s4cAuth.domain : ( RED.settings.socketIOUrl ? RED.settings.socketIOUrl : "https://www.snap4city.org" ));
        node.socketIOPath = (RED.settings.socketIOPath ? RED.settings.socketIOPath : "/synoptics/socket.io");
        node.selectedSynopticId = config.selectedSynopticId;
        node.synopticId = config.synopticId;
        node.selectedSynopticVariableId = config.selectedSynopticVariableId;
        node.synopticVariableId = config.synopticVariableId;
        node.notRestart = false;
        node.socket = null;

        node.on('input', function (msg) {
            node.synopticId = (msg.payload.synopticId ? msg.payload.synopticId : node.synopticId);
            node.synopticVariableId = (msg.payload.synopticVariableId ? msg.payload.synopticVariableId : node.synopticVariableId);
            if (node.authenticated && node.displayed && typeof node.synopticId != "undefined" && node.synopticId != "") {
                node.socket.emit("read", node.synopticVariableId);
                logger.debug("Emit read with synopticId: " + node.synopticId);
            } else {
                var accessToken = "";
                accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, node.uid);
                if (accessToken != "" && accessToken != "undefined") {
                    node.socket.emit("authenticate", accessToken);
                    logger.debug("Emit authenticate with accessToken: " + accessToken);
                } else {
                    node.error("Check the authentication in the configuration tab");
                    logger.error("Problem with accessToken: " + accessToken);
                }
            }
        });


        node.socket = io(node.socketIOUrl, {
            path: node.socketIOPath
        })

        node.startTimestamp = new Date().getTime();
        node.socket.connect();
        logger.debug("Start socket connection");

        node.socket.on('authenticate', function (_data) {
            logger.debug("Receive authenticate message: " + _data);
            try {
                _data = JSON.parse(_data);
            } catch (e) {
                logger.error("Problem Parsing data " + _data);
            }

            if (typeof _data.status != "undefined") {
                if (_data.status.toLowerCase() == "ok") {
                    node.status({
                        fill: "green",
                        shape: "dot",
                        text: "Authenticated to the server!"
                    });
                    if (typeof node.synopticId != "undefined" && node.synopticId != "") {
                        node.authenticated = true;
                        node.socket.emit("display", node.synopticId);
                        logger.debug("Emit display with synopticId: " + node.synopticId);
                    } else {
                        node.error("You have to configure or input the id of the Synoptic to be read");
                        logger.error("Problem with synopticId: " + node.synopticId);
                    }
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Authentication Problem!"
                    });
                    node.authenticated = false;
                    node.error(_data.error);
                    logger.error("Error on authenticate: " + _data.error);
                }
            }
        });

        node.socket.on('display', function (_data) {
            logger.debug("Receive display message: " + _data);
            try {
                _data = JSON.parse(_data);
            } catch (e) {
                logger.error("Problem Parsing data " + _data);
            }

            if (typeof _data.status != "undefined") {
                if (_data.status.toLowerCase() == "ok") {
                    node.status({
                        fill: "green",
                        shape: "dot",
                        text: "Display Variables!"
                    });
                    if (typeof node.synopticVariableId != "undefined" && node.synopticVariableId != "") {
                        node.displayed = true;
                        node.socket.emit("read", node.synopticVariableId);
                        logger.debug("Emit display with synopticId: " + node.synopticId);
                    } else {
                        node.error("You have to configure or input the id of the Synoptic Variable to be read");
                        logger.error("Problem with synopticId: " + node.synopticId);
                    }
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Display Problem!"
                    });
                    if (_data.error == "unauthorized") {
                        node.authenticated = false;
                        logger.warn("Unauthorized to emit display message");
                    }
                    node.displayed = false;
                    var accessToken = "";
                    accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, node.uid);
                    if (accessToken != "" && accessToken != "undefined") {
                        node.socket.emit("authenticate", accessToken);
                        logger.debug("Emit authenticate with accessToken: " + accessToken);
                    } else {
                        node.error("Check the authentication in the configuration tab");
                        logger.error("Problem with accessToken: " + accessToken);
                    }
                    node.error(_data.error);
                    logger.error("Error on display: " + _data.error);
                }
            }
        });

        node.socket.on('read', function (_data) {
            logger.debug("Receive read message: " + _data);
            try {
                _data = JSON.parse(_data);
            } catch (e) {
                logger.error("Problem Parsing data " + _data);
            }

            if (typeof _data.status != "undefined") {
                if (_data.status.toLowerCase() != "error") {
                    node.status({
                        fill: "green",
                        shape: "dot",
                        text: "Read value!"
                    });
                    logger.info("Success Read Value");
                    node.send({
                        "payload": _data
                    });

                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Error, see debug tab"
                    });
                    if (_data.error == "unauthorized") {
                        node.authenticated = false;
                        logger.warn("Unauthorized to emit read message");
                    }
                    var accessToken = "";
                    accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, node.uid);
                    if (accessToken != "" && accessToken != "undefined") {
                        node.socket.emit("authenticate", accessToken);
                        logger.debug("Emit authenticate with accessToken: " + accessToken);
                    } else {
                        node.error("Check the authentication in the configuration tab");
                        logger.error("Problem with accessToken: " + accessToken);
                    }
                    node.error(_data.error);
                    logger.error("Error on read: " + _data.error);
                }
            }

        });

        node.socket.on('connect', function () {
            logger.debug("Receive connect message");
            node.status({
                fill: "green",
                shape: "dot",
                text: "Connected to the server!"
            });

        });
        node.socket.on('connect_error', (error) => {
            logger.error("Receive connect_error message: " + error);
            node.status({
                fill: "red",
                shape: "dot",
                text: "Sorry, there seems to be an issue"
            });
            node.authenticated = false;
            node.displayed = false;
        });

        node.socket.on('error', (error) => {
            logger.error("Receive error message: " + error);
            node.authenticated = false;
            node.displayed = false;
        });

        node.socket.on('reconnect_attempt', () => {
            logger.warn("Receive reconnect_attempt");
        });

        node.socket.on('disconnect', function (reason) {
            logger.error("Receive disconnect message: " + reason);
            node.status({
                fill: "red",
                shape: "dot",
                text: "Disconnetted"
            });
            node.startTimestamp = new Date().getTime();
            if (reason === 'io server disconnect') {
                // the disconnection was initiated by the server, you need to reconnect manually
                node.socket.connect();
                logger.debug("Start socket reconnection");
            }

        });

        node.on('close', function (removed, closedDoneCallback) {
            logger.debug("Close node. Removed: " + removed);
            node.notRestart = true;
            node.socket.close();
            closedDoneCallback();
        });

        node.closedDoneCallback = function () {
            logger.debug("Close callback");
        };

    }

    RED.nodes.registerType("synoptic-read", SynopticRead);

}