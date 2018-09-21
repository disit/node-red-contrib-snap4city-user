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

    function Snap4cityAuthentication(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.name = config.name;
        var fs = require('fs');

        this.setNewOwnership = function (accessToken, uid) {
            var os = require('os');
            var fs = require('fs');
            if (!fs.existsSync(__dirname + "/../node-red-contrib-snap4city-user/config/ownership") && !fs.existsSync(__dirname + "/../node-red-contrib-snap4city-developer/config/ownership")) {
                var ifaces = os.networkInterfaces();
                var url = (RED.settings.ownershipUrl ? RED.settings.ownershipUrl :"https://www.snap4city.org/ownership-api/") + "/v1/register/?";
                var params = "accessToken=" + accessToken;
                var iplocal = null;
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
                console.log(encodeURI(url));
                xmlHttp.open("POST", encodeURI(url + params), false);
                xmlHttp.setRequestHeader("Content-Type", "application/json");
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
                if (xmlHttp.responseText != "") {
                    try {
                        response = JSON.parse(xmlHttp.responseText)
                        if (typeof response.error == "undefined") {
                            if (fs.existsSync(__dirname + "/../node-red-contrib-snap4city-user")) {
                                if (!fs.existsSync(__dirname + "/../node-red-contrib-snap4city-user/config")) {
                                    fs.mkdirSync(__dirname + "/../node-red-contrib-snap4city-user/config");
                                }
                                fs.writeFileSync(__dirname + "/../node-red-contrib-snap4city-user/config/ownership", "");
                            }
                            if (fs.existsSync(__dirname + "/../node-red-contrib-snap4city-developer")) {
                                if (!fs.existsSync(__dirname + "/../node-red-contrib-snap4city-developer/config")) {
                                    fs.mkdirSync(__dirname + "/../node-red-contrib-snap4city-developer/config");
                                }
                                fs.writeFileSync(__dirname + "/../node-red-contrib-snap4city-developer/config/ownership", "");
                            }
                        }
                    } catch (e) {}
                }
            } else {
                if (fs.existsSync(__dirname + "/../node-red-contrib-snap4city-user/config/ownership")) {
                    if (fs.existsSync(__dirname + "/../node-red-contrib-snap4city-developer")) {
                        if (!fs.existsSync(__dirname + "/../node-red-contrib-snap4city-developer/config")) {
                            fs.mkdirSync(__dirname + "/../node-red-contrib-snap4city-developer/config");
                        }
                        fs.writeFileSync(__dirname + "/../node-red-contrib-snap4city-developer/config/ownership", "");
                    }
                } else if (fs.existsSync(__dirname + "/../node-red-contrib-snap4city-developer/config/ownership")) {
                    if (fs.existsSync(__dirname + "/../node-red-contrib-snap4city-user")) {
                        if (!fs.existsSync(__dirname + "/../node-red-contrib-snap4city-user/config")) {
                            fs.mkdirSync(__dirname + "/../node-red-contrib-snap4city-user/config");
                        }
                        fs.writeFileSync(__dirname + "/../node-red-contrib-snap4city-user/config/ownership", "");
                    }
                }
            }
        }

        this.retrieveCurrentUser = function () {
            return node.credentials.user;
        }

        this.refreshTokenGetAccessToken = function (uid) {
            var url = (RED.settings.keycloakBaseUri ? RED.settings.keycloakBaseUri : "https://www.snap4city.org/auth/realms/master/") + "/protocol/openid-connect/token/";
            var params = "";
            var expiresTimestamp = node.credentials.expiresTimestamp;
            var refreshToken = node.credentials.refreshToken;
            if (typeof refreshToken == "undefined" || typeof expiresTimestamp == "undefined" || new Date().getTime() > expiresTimestamp) {
                params = "client_id=" + (RED.settings.keycloakClientid ? RED.settings.keycloakClientid : "nodered-iotedge") + "&grant_type=password&username=" + node.credentials.user + "&password=" + node.credentials.password;
            } else {
                params = "client_id=" + (RED.settings.keycloakClientid ? RED.settings.keycloakClientid : "nodered-iotedge") + "&grant_type=refresh_token&scope=openid profile&refresh_token=" + refreshToken;
            }
            var response = "";
            var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
            var xmlHttp = new XMLHttpRequest();
            console.log(encodeURI(url));
            xmlHttp.open("POST", encodeURI(url), false);
            xmlHttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
            xmlHttp.send(params);
            if (xmlHttp.responseText != "") {
                try {
                    response = JSON.parse(xmlHttp.responseText);
                    if (response.access_token != null && uid != null) {
                        if (typeof expiresTimestamp == "undefined") {
                            this.setNewOwnership(response.access_token, uid);
                        }
                        node.credentials.accessToken = response.access_token;
                    }
                    if (response.refresh_token != null) {
                        node.credentials.refreshToken = response.refresh_token;
                    }
                    if (response.refresh_expires_in != null) {
                        node.credentials.expiresTimestamp = (new Date().getTime()) + response.refresh_expires_in * 1000;
                    }
                } catch (e) {}

                if (response != "") {
                    if (response.access_token != null) {
                        return response.access_token;
                    } else {
                        return "";
                    }
                }
            }
            return response;
        }

        RED.httpAdmin.get("/retrieveAccessTokenAuthentication/",RED.auth.needsPermission('snap4city-authentication.read'), function (req, res) {
            var s4cUtility = require("./snap4city-utility.js");
            res.json({
                "accessToken": s4cUtility.retrieveAccessToken(RED, node, node.id, null),
                "username": s4cUtility.retrieveCurrentUser(RED, node, node.id)
            });
        });

        RED.httpAdmin.get('/getChangedUser/', function (req, res) {
            var fs = require('fs');
            try {
                res.send({
                    "changedUser": fs.readFileSync(__dirname + "/config/changedUser", 'utf-8')
                });
            } catch (e) {
                res.send({
                    "changedUser": ""
                });
            }
        })
    }

    RED.httpAdmin.get("/isThereLocalRefreshToken/", function (req, res) {
        var fs = require('fs');
        res.json({
            "result": fs.existsSync('/data/refresh_token')
        });
    });

    RED.httpAdmin.post('/setChangedUser/', function (req, res) {
        var fs = require('fs');
        if (fs.existsSync(__dirname + "/../node-red-contrib-snap4city-developer")) {
            if (!fs.existsSync(__dirname + "/../node-red-contrib-snap4city-developer/config")) {
                fs.mkdirSync(__dirname + "/../node-red-contrib-snap4city-developer/config");
            }
            fs.writeFileSync(__dirname + "/../node-red-contrib-snap4city-developer/config/changedUser", req.body.changedUser);
        }
        if (fs.existsSync(__dirname + "/../node-red-contrib-snap4city-user")) {
            if (!fs.existsSync(__dirname + "/../node-red-contrib-snap4city-user/config")) {
                fs.mkdirSync(__dirname + "/../node-red-contrib-snap4city-user/config");
            }
            fs.writeFileSync(__dirname + "/../node-red-contrib-snap4city-user/config/changedUser", req.body.changedUser);
        }
        res.sendStatus(200);
    });

    RED.nodes.registerType("snap4city-authentication", Snap4cityAuthentication, {
        credentials: {
            user: {
                type: "text"
            },
            password: {
                type: "password"
            }
        }
    });
}