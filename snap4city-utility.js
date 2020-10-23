const http = require("http");
const { v4: uuidv4 } = require('uuid')
module.exports = {

    getLogger: function (RED, node) {
        const {
            createLogger,
            format,
            transports
        } = require('winston');
        return createLogger({
            level: (RED.settings.s4cLogLevel ? RED.settings.s4cLogLevel : "info"),
            format: format.combine(
                format.label({
                    label: node.type + ":" + node.id
                }),
                format.timestamp(),
                format.printf(({
                    level,
                    message,
                    label,
                    timestamp
                }) => {
                    return `${timestamp} [${level}][${label}] : ${message}`;
                })
            ),
            transports: [
                new transports.Console()
            ],
        });
    },

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
            var payloadsize = 0;
            try {
                payloadsize = JSON.stringify(outPayload).length / 1000;
            } catch (err) {
                try {
                    payloadsize = JSON.stringify(outPayload.payload).length / 1000;
                } catch (error) {
                    //Catched
                }
            }
            var agent = _agent;
            var motivation = _motivation;
            var lang = (inPayload.lang ? inPayload.lang : (config ? config.lang : ""));
            var lat = (inPayload.lat ? inPayload.lat : (config ? config.lat : ""));
            var lon = (inPayload.lon ? inPayload.lon : (config ? config.lon : ""));
            var serviceuri = (inPayload.serviceuri ? inPayload.serviceuri : (config ? config.serviceuri : ""));
            var message = (inPayload.message ? inPayload.message : (config ? config.message : ""));
            var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
            var xmlHttp = new XMLHttpRequest();
            console.log(encodeURI(uri + "/?p=log" + "&pid=" + pidlocal + "&tmstmp=" + timestamp + "&modCom=" + modcom + "&IP_local=" + iplocal + "&IP_ext=" + ipext +
                "&payloadSize=" + payloadsize + "&agent=" + agent + "&motivation=" + motivation + "&lang=" + lang + "&lat=" + (typeof lat != "undefined" ? lat : 0.0) + "&lon=" + (typeof lon != "undefined" ? lon : 0.0) + "&serviceUri=" + serviceuri + "&message=" + message));
            xmlHttp.open("GET", encodeURI(uri + "/?p=log" + "&pid=" + pidlocal + "&tmstmp=" + timestamp + "&modCom=" + modcom + "&IP_local=" + iplocal + "&IP_ext=" + ipext +
                "&payloadSize=" + payloadsize + "&agent=" + agent + "&motivation=" + motivation + "&lang=" + lang + "&lat=" + (typeof lat != "undefined" ? lat : 0.0) + "&lon=" + (typeof lon != "undefined" ? lon : 0.0) + "&serviceUri=" + serviceuri + "&message=" + message), true); // false for synchronous request
            xmlHttp.send(null);
        }
    },

    retrieveCurrentUser: function (RED, node, authentication) {
        var fs = require('fs');
        var refreshToken = "";
        var response = "";
        if (fs.existsSync('/data/refresh_token')) {
            refreshToken = fs.readFileSync('/data/refresh_token', 'utf-8');
            var url = (RED.settings.keycloakBaseUri ? RED.settings.keycloakBaseUri : "https://www.snap4city.org/auth/realms/master/") + "/protocol/openid-connect/token/";
            var params = "client_id=" + (RED.settings.keycloakClientid ? RED.settings.keycloakClientid : "nodered") + "&client_secret=" + (RED.settings.keycloakClientsecret ? RED.settings.keycloakClientsecret : "943106ae-c62c-4961-85a2-849f6955d404") + "&grant_type=refresh_token&scope=openid profile&refresh_token=" + refreshToken;
            var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
            var xmlHttp = new XMLHttpRequest();
            console.log("Retrieve user from:" + encodeURI(url));
            xmlHttp.open("POST", encodeURI(url), false);
            xmlHttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
            xmlHttp.send(params);
            if (xmlHttp.responseText != "") {
                try {
                    response = JSON.parse(xmlHttp.responseText);
                } catch (e) { }
            }
            if (response != "") {
                fs.writeFileSync('/data/refresh_token', response.refresh_token);
                if (response.preferred_username != "" && response.preferred_username != undefined && response.preferred_username != "undefined") {
                    return response.preferred_username;
                } else {
                    return response.username;
                }
            }
        } else {
            if (node != null && authentication != null) {
                node.s4cAuth = RED.nodes.getNode(authentication);
                if (node.s4cAuth != null) {
                    return node.s4cAuth.retrieveCurrentUser();
                }
            } else {
                return "";
            }
        }
    },

    retrieveAccessToken: function (RED, node, authentication, uid) {
        return retrieveAccessToken(RED, node, authentication, uid, true);
    },

    retrieveAccessToken: function (RED, node, authentication, uid, fillStatus) {
        var fs = require('fs');
        var refreshToken = "";
        var response = "";
        if (fs.existsSync('/data/refresh_token')) {
            refreshToken = fs.readFileSync('/data/refresh_token', 'utf-8');
            var url = (RED.settings.keycloakBaseUri ? RED.settings.keycloakBaseUri : "https://www.snap4city.org/auth/realms/master/") + "/protocol/openid-connect/token/";
            var params = "client_id=" + (RED.settings.keycloakClientid ? RED.settings.keycloakClientid : "nodered") + "&client_secret=" + (RED.settings.keycloakClientsecret ? RED.settings.keycloakClientsecret : "943106ae-c62c-4961-85a2-849f6955d404") + "&grant_type=refresh_token&scope=openid profile&refresh_token=" + refreshToken;
            var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
            var xmlHttp = new XMLHttpRequest();
            //console.log("Retrieve token from:" + encodeURI(url));
            xmlHttp.open("POST", encodeURI(url), false);
            xmlHttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
            xmlHttp.send(params);
            if (xmlHttp.responseText != "") {
                try {
                    response = JSON.parse(xmlHttp.responseText);
                } catch (e) { }
            }
            if (response != "") {
                fs.writeFileSync('/data/refresh_token', response.refresh_token);
                return response.access_token;
            }
        } else {
            if (node != null && authentication != null) {
                node.s4cAuth = RED.nodes.getNode(authentication);
                if (node.s4cAuth != null) {
                    var accessToken = node.s4cAuth.refreshTokenGetAccessToken(uid);
                    if (accessToken != "") {
                        if (fillStatus) node.status({
                            fill: "green",
                            shape: "dot",
                            text: "Authenticaton Ok"
                        });
                        return accessToken;
                    } else {
                        if (fillStatus) node.status({
                            fill: "red",
                            shape: "dot",
                            text: "Authentication Problem"
                        });
                    }
                }
            }
        }
        return response;
    },

    retrieveAppID: function (RED) {
        var fs = require('fs');
        var correctPath = __dirname + "/../../../";
        if (fs.existsSync('/data/refresh_token')) {
            correctPath = "/data/";
        }
        if (RED.settings.APPID != null) {
            return RED.settings.APPID;
        } else if (fs.existsSync(correctPath + ".snap4cityConfig/appid")) {
            return fs.readFileSync(correctPath + ".snap4cityConfig/appid", 'utf-8')
        } else if (fs.existsSync(correctPath + "node-red-contrib-snap4city-user/config/appid")) {
            if (!fs.existsSync(correctPath + ".snap4cityConfig")) {
                fs.mkdirSync(correctPath + ".snap4cityConfig");
            }
            fs.writeFileSync(correctPath + ".snap4cityConfig/appid", fs.readFileSync(correctPath + "node-red-contrib-snap4city-user/config/appid", 'utf-8'));
            return fs.readFileSync(correctPath + ".snap4cityConfig/appid", 'utf-8')
        } else if (fs.existsSync(correctPath + "node-red-contrib-snap4city-developer/config/appid")) {

            if (!fs.existsSync(correctPath + ".snap4cityConfig")) {
                fs.mkdirSync(correctPath + ".snap4cityConfig");
            }
            fs.writeFileSync(correctPath + ".snap4cityConfig/appid", fs.readFileSync(correctPath + "node-red-contrib-snap4city-developer/config/appid", 'utf-8'));

            return fs.readFileSync(correctPath + ".snap4cityConfig/appid", 'utf-8')
        } else {
            var crypto = require('crypto');
            var appid = "edge" + crypto.randomBytes(30).toString('hex');

            if (!fs.existsSync(correctPath + ".snap4cityConfig")) {
                fs.mkdirSync(correctPath + ".snap4cityConfig");
            }
        }
        fs.writeFileSync(correctPath + ".snap4cityConfig/appid", appid);

        return appid;
    },

    saveNodeContext: function (RED, node, context) {
        var fs = require('fs');
        var correctPath = __dirname + "/../../../";
        if (fs.existsSync('/data/refresh_token')) {
            correctPath = "/data/";
        }
        if (!fs.existsSync(correctPath + ".snap4cityConfig")) {
            fs.mkdirSync(correctPath + ".snap4cityConfig");
        }
        if (!fs.existsSync(correctPath + ".snap4cityConfig/context")) {
            fs.mkdirSync(correctPath + ".snap4cityConfig/context");
        }
        fs.writeFileSync(correctPath + ".snap4cityConfig/context/" + node.id, JSON.stringify(context));
    },

    retrieveNodeContext: function (RED, node) {
        var fs = require('fs');
        var correctPath = __dirname + "/../../../";
        if (fs.existsSync('/data/refresh_token')) {
            correctPath = "/data/";
        }
        if (!fs.existsSync(correctPath + ".snap4cityConfig")) {
            fs.mkdirSync(correctPath + ".snap4cityConfig");
        }
        if (!fs.existsSync(correctPath + ".snap4cityConfig/context")) {
            fs.mkdirSync(correctPath + ".snap4cityConfig/context");
        }
        if (fs.existsSync(correctPath + ".snap4cityConfig/context/" + node.id)) {
            var response = "";
            try {
                response = JSON.parse(fs.readFileSync(correctPath + ".snap4cityConfig/context/" + node.id, 'utf-8'));
            } catch (e) {
                response = fs.readFileSync(correctPath + ".snap4cityConfig/context/" + node.id, 'utf-8');
            }
            return response;
        }
        return JSON.parse("{}");
    },

    deleteNodeContext: function (RED, node) {
        var fs = require('fs');
        var correctPath = __dirname + "/../../../";
        if (fs.existsSync('/data/refresh_token')) {
            correctPath = "/data/";
        }
        if (fs.existsSync(correctPath + ".snap4cityConfig") && fs.existsSync(correctPath + ".snap4cityConfig/context") && fs.existsSync(correctPath + ".snap4cityConfig/context/" + node.id)) {
            fs.unlinkSync(correctPath + ".snap4cityConfig/context/" + node.id);
        }
    },

    getContextBrokerListForRegisterActivity: function (RED, node, contextBrokerUrl, contextBrokerPort, deviceName, iotappid, accessToken) {

        const logger = this.getLogger(RED, node);
        var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
        var xmlHttp = new XMLHttpRequest();
        if (typeof node.currentContextBroker != "undefined" && node.currentContextBroker.accesslink.indexOf(contextBrokerUrl) == -1) {
            delete node.contextBrokerList;
        }
        if (typeof node.contextBrokerList == "undefined") {
            var uri = (RED.settings.iotDirectoryUrl ? RED.settings.iotDirectoryUrl : "https://iotdirectory.snap4city.org/");
            if (accessToken != "" && typeof accessToken != "undefined") {
                xmlHttp.open("GET", encodeURI(uri + "/api/contextbroker.php?action=get_all_contextbroker&nodered=yes"), true);
                xmlHttp.setRequestHeader("Content-Type", "application/json");
                xmlHttp.setRequestHeader("Authorization", "Bearer " + accessToken);
                xmlHttp.onload = function (e) {
                    if (xmlHttp.readyState === 4) {
                        if (xmlHttp.status === 200) {
                            if (xmlHttp.responseText != "") {
                                try {
                                    node.contextBrokerList = JSON.parse(xmlHttp.responseText).data;
                                } catch (err) {
                                    node.contextBrokerList = xmlHttp.responseText.data;
                                }
                                this.createDeviceLongIdAndRegisterActivity(RED, node, contextBrokerUrl, contextBrokerPort, deviceName, iotappid, accessToken);
                            }
                        } else {
                            logger.error(xmlHttp.statusText);
                        }
                    }
                };
                xmlHttp.onerror = function (e) {
                    logger.error(xmlHttp.statusText);
                };
                xmlHttp.send(null);
            }
        } else {
            this.createDeviceLongIdAndRegisterActivity(RED, node, contextBrokerUrl, contextBrokerPort, deviceName, iotappid, accessToken);
        }
    },

    createDeviceLongIdAndRegisterActivity: function (RED, node, contextBrokerUrl, contextBrokerPort, deviceName, iotappid, accessToken) {

        const logger = this.getLogger(RED, node);
        var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
        var xmlHttp = new XMLHttpRequest();
        if (typeof node.deviceLongId == "undefined" || node.deviceLongId.indexOf(deviceName) == -1) {
            if (typeof node.contextBrokerList != "undefined") {
                for (var i = 0; i < node.contextBrokerList.length; i++) {
                    if (node.contextBrokerList[i].accesslink.indexOf(contextBrokerUrl) != -1 && node.contextBrokerList[i].accessport == contextBrokerPort) {
                        node.deviceLongId = node.contextBrokerList[i].organization + ":" + node.contextBrokerList[i].name + ":" + deviceName;
                        node.currentContextBroker = node.contextBrokerList[i];
                    }
                }
            }
        }

        if (typeof node.deviceLongId != "undefined") {
            var uri = (RED.settings.myPersonalDataUrl ? RED.settings.myPersonalDataUrl : "https://www.snap4city.org/mypersonaldata/api/v1");
            if (accessToken != "" && typeof accessToken != "undefined") {
                xmlHttp.open("POST", encodeURI(uri + "/lightactivities/?elementType=IOTID&sourceRequest=iotapp&sourceId=" + iotappid + "&elementId=" + node.deviceLongId), true);
                xmlHttp.setRequestHeader("Content-Type", "application/json");
                xmlHttp.setRequestHeader("Authorization", "Bearer " + accessToken);
                xmlHttp.onload = function (e) {
                    if (xmlHttp.readyState === 4) {
                        if (xmlHttp.status !== 200) {
                            logger.error(xmlHttp.statusText);
                        }
                    } else {
                        logger.error(xmlHttp.statusText);
                    }
                };
                xmlHttp.onerror = function (e) {
                    logger.error(xmlHttp.statusText);
                };
                xmlHttp.send(null);
            }
        }
    },

    processInput: function (n, msg) {
        n.url = n.url || msg.url;
        n.port = n.port || msg.port;
        n.enid = n.enid || msg.enid || ".*"; //TODO don't allow .* for queryContext (but also for subscribeContext)
        n.entype = n.entype || msg.entype;
        n.limit = n.limit || msg.limit || LIMIT;
        n.userk1 = n.userk1 || msg.userk1;
        n.passk2 = n.passk2 || msg.passk2;
        n.tenant = n.tenant || msg.tenant;
        n.servicepath = n.servicepath || msg.servicepath;
        n.apikey = n.apikey || msg.apikey;
        n.basicAuth = n.basicAuth || msg.basicAuth;
        n.attributes = n.attributes || msg.attributes;
        n.ispattern = n.ispattern || msg.ispattern || false;
        n.includeattr = n.includeattr || msg.includeattr;

        n.rtype = n.rtype || msg.rtype;
        n.rvalue = n.rvalue || msg.rvalue;

        if (n.rtype && !n.rvalue) {
            n.rvalue = "entity::type";
        }

        //	n.attributes = n.attributes || '.*';
        n.attributes = n.attributes || [];
        if (n.attributes.constructor !== Array) {
            n.attributes = (n.attributes || "").split(",");
            for (var i = 0; i < n.attributes.length; i++) {
                n.attributes[i] = n.attributes[i].trim();
            }
        }
    },

    splitUrlInHostnameAndPrefixPath: function (url) {
        var hostname = url;
        var prefixPath = "";
        var urlWithoutHttp = url.replace("https://", "").replace("http://", "");
        if (urlWithoutHttp.indexOf("/") >= 0) {
            hostname = urlWithoutHttp.substring(0, urlWithoutHttp.indexOf("/"));
            prefixPath = urlWithoutHttp.substring(urlWithoutHttp.indexOf("/"));
        }
        return [hostname, prefixPath];
    },

    updateServiceNodeListForAPIv2() {
        const app = this
        setTimeout(() => {
            app.getFlows().then(flows => {
                app.getContextBrokerList().then(contextBrokerList => {
                    contextBrokerList.forEach(contextBroker => {
                        var index = flows.findIndex(node => node.url === contextBroker.uri)
                        if (index === -1)
                            flows.push(
                                {
                                    id: app.generateNodeId(),
                                    type: "Fiware-Orion API v2: Service",
                                    z: "",
                                    name: contextBroker.uri,
                                    url: contextBroker.uri,
                                    port: contextBroker.port
                                },
                            )
                    }
                    )
                    this.updateContextBlokerList(flows).then(a => console.log("DONE"))
                })
            })
        }, 5000)
    },

    getFlows() {
        return new Promise((resolve, reject) => {
            const req = http.get("http://localhost:1880/flows", res => {
                res.setEncoding("utf8");
                let body = "";
                res.on("data", data => {
                    body += data;
                });
                res.on("end", () => {
                    body = JSON.parse(body);
                    resolve(body)
                });
            });
            req.on('error', function (err) {
                reject(err);
            });
        });
    },

    getContextBrokerList() {
        return new Promise((resolve, reject) => {
            resolve(
                [
                    {
                        uri: 'iotobsf',
                        port: '1026'
                    },
                    {
                        uri: 'iotobsf2',
                        port: '2222'
                    },
                    {
                        uri: 'iotobsf3',
                        port: '3333'
                    },
                ]
            )
        });
    },

    updateContextBlokerList(flows) {
        const data = JSON.stringify(flows)
        const options = {
            hostname: "localhost",
            port: "1880",
            path: "/flows",
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        }

        return new Promise((resolve, reject) => {
            const req = http.request(options, res => {
                console.log(`statusCode: ${res.statusCode}`)
                res.on('end', function () {
                    resolve(res);
                });
            });

            req.on('error', function (err) {
                console.log(err)

                reject(err);
            });
            req.write(data)
            req.end()
        });
    },

    generateNodeId() {
        const uuid = uuidv4()
        return `${uuid.substring(0, 8)}.${uuid.substring(30, 36)}`
    }
}