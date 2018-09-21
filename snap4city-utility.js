module.exports = {
    eventLog: function (RED, inPayload, outPayload, config, _agent, _motivation, _ipext, _modcom) {
        var os = require('os');
        var ifaces = os.networkInterfaces();
        var uri = (RED.settings.eventLogUri ? RED.settings.eventLogUri : null);
        if (uri != null) {
            var pidlocal = RED.settings.APPID;
            var iplocal = null;
            Object.keys(ifaces).forEach(function (ifname) {
                ifaces[ifname].forEach(function (iface) {
                    if ('IPv4' !== iface.family || iface.internal !== false) {
                        // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                        return;
                    }
                    iplocal = iface.address;
                });
            });
            iplocal = iplocal + ":" + RED.settings.uiPort;
            var timestamp = new Date().getTime();
            var modcom = _modcom;
            var ipext = _ipext;
            var payloadsize = JSON.stringify(outPayload).length / 1000;
            var agent = _agent;
            var motivation = _motivation;
            var lang = (inPayload.lang ? inPayload.lang : config.lang);
            var lat = (inPayload.lat ? inPayload.lat : config.lat);
            var lon = (inPayload.lon ? inPayload.lon : config.lon);
            var serviceuri = (inPayload.serviceuri ? inPayload.serviceuri : config.serviceuri);
            var message = (inPayload.message ? inPayload.message : config.message);
            var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
            var xmlHttp = new XMLHttpRequest();
            console.log(encodeURI(uri + "?p=log" + "&pid=" + pidlocal + "&tmstmp=" + timestamp + "&modCom=" + modcom + "&IP_local=" + iplocal + "&IP_ext=" + ipext +
                "&payloadSize=" + payloadsize + "&agent=" + agent + "&motivation=" + motivation + "&lang=" + lang + "&lat=" + (typeof lat != "undefined" ? lat : 0.0) + "&lon=" + (typeof lon != "undefined" ? lon : 0.0) + "&serviceUri=" + serviceuri + "&message=" + message));
            xmlHttp.open("GET", encodeURI(uri + "?p=log" + "&pid=" + pidlocal + "&tmstmp=" + timestamp + "&modCom=" + modcom + "&IP_local=" + iplocal + "&IP_ext=" + ipext +
                "&payloadSize=" + payloadsize + "&agent=" + agent + "&motivation=" + motivation + "&lang=" + lang + "&lat=" + (typeof lat != "undefined" ? lat : 0.0) + "&lon=" + (typeof lon != "undefined" ? lon : 0.0) + "&serviceUri=" + serviceuri + "&message=" + message), true); // false for synchronous request
            xmlHttp.send(null);
        }
    },

    retrieveCurrentUser: function (RED, node, authentication) {
        if (node != null && authentication != null) {
            node.s4cAuth = RED.nodes.getNode(authentication);
            if (node.s4cAuth != null) {
                return node.s4cAuth.retrieveCurrentUser();
            }
        } else {
            return "";
        }
    },

    retrieveAccessToken: function (RED, node, authentication, uid) {
        var fs = require('fs');
        var refreshToken = "";
        var response = "";
        if (fs.existsSync('/data/refresh_token')) {
            refreshToken = fs.readFileSync('/data/refresh_token', 'utf-8');
            var url = (RED.settings.keycloakBaseUri ? RED.settings.keycloakBaseUri : "https://www.snap4city.org/auth/realms/master/") + "/protocol/openid-connect/token/";
            var params = "client_id=" + (RED.settings.keycloakClientid ? RED.settings.keycloakClientid : "nodered") + "&client_secret=" + (RED.settings.keycloakClientsecret ? RED.settings.keycloakClientsecret : "943106ae-c62c-4961-85a2-849f6955d404") + "&grant_type=refresh_token&scope=openid profile&refresh_token=" + refreshToken;
            var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
            var xmlHttp = new XMLHttpRequest();
            console.log(encodeURI(url));
            xmlHttp.open("POST", encodeURI(url), false);
            xmlHttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
            xmlHttp.send(params);
            if (xmlHttp.responseText != "") {
                try {
                    response = JSON.parse(xmlHttp.responseText);
                } catch (e) {}
            }
            if (response != "") {
                fs.writeFileSync('/data/refresh_token', response.refresh_token);
                return response.access_token;
            }
        } else {
            if (node != null && authentication != null) {
                node.s4cAuth = RED.nodes.getNode(authentication);
                if (node.s4cAuth != null) {
                    accessToken = node.s4cAuth.refreshTokenGetAccessToken(uid);
                    if (accessToken != "") {
                        node.status({
                            fill: "green",
                            shape: "dot",
                            text: "Authenticaton Ok"
                        });
                        return accessToken;
                    } else {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "Authenticaton Problem"
                        });
                    }
                }
            }
        }
        return response;
    },

    retrieveAppID: function (RED) {
        var fs = require('fs');
        if (RED.settings.APPID != null) {
            return RED.settings.APPID;
        } else if (fs.existsSync(__dirname + "/../node-red-contrib-snap4city-user/config/appid")) {
            if (fs.existsSync(__dirname + "/../node-red-contrib-snap4city-developer")) {
                if (!fs.existsSync(__dirname + "/../node-red-contrib-snap4city-developer/config")) {
                    fs.mkdirSync(__dirname + "/../node-red-contrib-snap4city-developer/config");
                }
                fs.writeFileSync(__dirname + "/../node-red-contrib-snap4city-developer/config/appid", fs.readFileSync(__dirname + "/../node-red-contrib-snap4city-user/config/appid", 'utf-8'));
            }
            return fs.readFileSync(__dirname + "/../node-red-contrib-snap4city-user/config/appid", 'utf-8')
        } else if (fs.existsSync(__dirname + "/../node-red-contrib-snap4city-developer/config/appid")) {
            if (fs.existsSync(__dirname + "/../node-red-contrib-snap4city-user")) {
                if (!fs.existsSync(__dirname + "/../node-red-contrib-snap4city-user/config")) {
                    fs.mkdirSync(__dirname + "/../node-red-contrib-snap4city-user/config");
                }
                fs.writeFileSync(__dirname + "/../node-red-contrib-snap4city-user/config/appid", fs.readFileSync(__dirname + "/../node-red-contrib-snap4city-developer/config/appid", 'utf-8'));
            }
            return fs.readFileSync(__dirname + "/../node-red-contrib-snap4city-developer/config/appid", 'utf-8')
        } else {
            var crypto = require('crypto');
            var appid = "edge" + crypto.randomBytes(30).toString('hex');
            if (fs.existsSync(__dirname + "/../node-red-contrib-snap4city-user")) {
                if (!fs.existsSync(__dirname + "/../node-red-contrib-snap4city-user/config")) {
                    fs.mkdirSync(__dirname + "/../node-red-contrib-snap4city-user/config");
                }
                fs.writeFileSync(__dirname + "/../node-red-contrib-snap4city-user/config/appid", appid);
            }
            if (fs.existsSync(__dirname + "/../node-red-contrib-snap4city-developer")) {
                if (!fs.existsSync(__dirname + "/../node-red-contrib-snap4city-developer/config")) {
                    fs.mkdirSync(__dirname + "/../node-red-contrib-snap4city-developer/config");
                }
                fs.writeFileSync(__dirname + "/../node-red-contrib-snap4city-developer/config/appid", appid);
            }
            return appid;
        }
    }


}