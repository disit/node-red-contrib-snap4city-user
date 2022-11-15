var fs = require('fs')
var path = require('path')
var os = require('os')

class SubscriptionStore {
    constructor(RED, jsonFilePath = 'subscriptions.json') {
        this.subscriptionJson={};
		var correctPath =  os.homedir() + "/.snap4cityConfig/";//consider edge scenario
        if (RED.settings.APPID != null) {//check edge scenario or cloud scenario
            correctPath = "/data/.snap4cityConfig/";//consider cloud scenario
		}
		this.jsonFilePath=correctPath+jsonFilePath;
		if (!fs.existsSync(correctPath)) { 
			fs.mkdirSync(correctPath);//not exist folder, create folder + empty file
			fs.writeFileSync(this.jsonFilePath, JSON.stringify(this.subscriptionJson));
		} else if (!fs.existsSync(this.jsonFilePath)){
			fs.writeFileSync(this.jsonFilePath, JSON.stringify(this.subscriptionJson));//not exist file, create empy file
		} else //folder and file exist, read from it
			this.subscriptionJson = JSON.parse(fs.readFileSync(this.jsonFilePath));
    }
    getSubscriptionOfNode(nodeId) {
        return this.subscriptionJson[nodeId]
    }
    setSubscriptionOnNode(subscriptionId, nodeId) {
        this.subscriptionJson[nodeId] = subscriptionId;	
        fs.writeFileSync(this.jsonFilePath, JSON.stringify(this.subscriptionJson));
    }
}

class NodeStatus {
    initializing(node) {
        node.status({
            fill: "blue",
            shape: "dot",
            text: "Initializing ..."
        });
    }
    querying(node) {
        node.status({
            fill: "blue",
            shape: "dot",
            text: "... Querying ..."
        });
    }
    sending(node) {
        node.status({
            fill: "blue",
            shape: "dot",
            text: "... Sending ..."
        });
    }
    subscribing(node) {
        node.status({
            fill: "blue",
            shape: "dot",
            text: "... Subscribing ..."
        });
    }
    success(node) {
        node.status({
            fill: "green",
            shape: "dot",
            text: "Success"
        });
    }
    listening(node, url) {
        node.status({
            fill: "blue",
            shape: "dot",
            text: "Listening on: " + url
        });
    }
    send(node, payload, statusCode) {
        node.send({
            payload: payload,
            statusCode: statusCode
        });
    }
    getError(node, err, msgLoggedOnDebug = null) {
        node.status({
            fill: "red",
            shape: "ring",
            text: this.getErrorMessage(err)
        });
        node.error(msgLoggedOnDebug ? msgLoggedOnDebug : err);
    }
    //reason is a json
    getErrorMessage(reason) {
        try {
            if (JSON.stringify(reason).indexOf("TIMEDOUT") != -1)
                return "Problem, Timeout";
            else if (JSON.stringify(reason).indexOf("ENOTFOUND") != -1)
                return "Problem, Not reachable";
            else if (JSON.stringify(reason).indexOf("ECONNREFUSED") != -1)
                return "Problem, Connection refused";
            else if (JSON.stringify(reason).indexOf("SELF_SIGNED_CERT_IN_CHAIN") != -1)
                return "Problem, CA certificate not valid";
            else if (JSON.stringify(reason).indexOf("is not in the cert's list") != -1)
                return "Problem, Broker URL mismatch";
            else if ((JSON.stringify(reason).indexOf("certificate unknown") != -1) || (JSON.stringify(reason).indexOf("EPROTO") != -1))
                return "Problem, Certificate credentials not valid";
            else if (JSON.stringify(reason).indexOf("key values mismatch") != -1)
                return "Problem, Key values mismatch";
            else if (JSON.parse(reason.payload).message)
                return "Problem: " + JSON.parse(reason.payload).message
            else if (JSON.parse(reason.payload).description)
                return "Problem: " + JSON.parse(reason.payload).description
        } catch (err) {
            return "Problem: " + reason.payload;
        }
    }
}

class OrionHttpRequestOptions {
    setHeaderAuthTenantAndTls(options, config, RED, auth = null) {
        var tlsNode = RED.nodes.getNode(config.tls);
        var apikey = (auth && auth.apikey) ? auth.apikey : ((config.apikey && config.apikey != "") ? config.apikey : undefined);
        var basicAuth = (auth && auth.basicAuth) ? auth.basicAuth : ((config.basicAuth && config.basicAuth != "") ? config.basicAuth : undefined);
        if (apikey)
            options.headers.apikey = config.apikey;
        if (basicAuth)
            options.headers.Authorization = config.basicAuth;
		if (config.tenant != null && config.tenant != "") 
			options.headers["Fiware-Service"]=config.tenant;
		if (config.servicepath != null && config.servicepath != "") {
			if (!config.servicepath.startsWith("/"))
				config.servicepath="/"+config.servicepath;
			options.headers["Fiware-ServicePath"]=config.servicepath;
		}
        if (tlsNode != null)
            if (tlsNode.credentials != null) {
                options.key = tlsNode.credentials.keydata;
                options.cert = tlsNode.credentials.certdata;
                options.ca = tlsNode.credentials.cadata;
                options.rejectUnauthorized = tlsNode.verifyservercert;
            }
        return options
    }
    generateForOrionAPIV2Update(hostname, port, prefixPath, config, auth, payloadLength, accessToken) {
        var k1 = (auth && auth.k1) ? auth.k1 : ((config.userk1) ? config.userk1 : undefined);
        var k2 = (auth && auth.k2) ? auth.k2 : ((config.passk2) ? config.passk2 : undefined);
        var options = {
            hostname: hostname,
            port: port,
            path: prefixPath + "/v2/entities/" + config.enid + "/attrs?type=" + config.entype + "&elementid=" + config.enid + (k1 ? "&k1=" + k1 : "") + (k2 ? "&k2=" + k2 : ""),
            method: 'PATCH',
            rejectUnauthorized: false,
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json',
                'Content-Length': payloadLength
            }
        };
        return options
    }
    generateForOrionAPIV2Query(hostname, port, prefixPath, config, queryParams, accessToken) {
        var query = `${queryParams.entities[0].id}/?type=${queryParams.entities[0].type}`;
        query += queryParams.attributes != "" ? `&attrs=${queryParams.attributes}` : '';
        var options = {
            hostname: hostname,
            port: port,
            path: prefixPath + "/v2/entities/" + query + "&limit=" + config.limit + "&elementid=" + config.enid + (config.userk1 ? "&k1=" + config.userk1 : "") + (config.passk2 ? "&k2=" + config.passk2 : ""),
            method: 'GET',
            rejectUnauthorized: false,
            headers: {
                'Authorization': 'Bearer ' + accessToken,
            }
        };
        return options
    }
    generateForOrionAPIV2Subscribe(hostname, port, prefixPath, config, payloadLength, accessToken) {
        var options = {
            hostname: hostname,
            port: port,
            path: prefixPath + "/v2/subscriptions/?elementid=" + config.enid + (config.userk1 ? "&k1=" + config.userk1 : "") + (config.passk2 ? "&k2=" + config.passk2 : ""),
            method: 'POST',
            rejectUnauthorized: false,
            headers: {
                'Authorization': 'Bearer ' + accessToken, 
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Content-Length': payloadLength
            }
        };
        return options
    }
    generateForOrionAPIV2Unsubscribe(hostname, port, prefixPath, config, subscriptionId, accessToken) {
        var options = {
            hostname: hostname,
            port: port,
            path: prefixPath + "/v2/subscriptions/" + subscriptionId + "/?elementid=" + config.enid + (config.userk1 ? "&k1=" + config.userk1 : "") + (config.passk2 ? "&k2=" + config.passk2 : ""),
            method: 'DELETE',
            rejectUnauthorized: false,
            headers: {
                'Authorization': 'Bearer ' + accessToken,
            }
        };
        return options
    }
}

module.exports = {   
    getContextBrokerListForRegisterActivity: function (RED, node, contextBrokerUrl, contextBrokerPort, deviceName, iotappid, accessToken) {	
        if (typeof node.currentContextBroker != "undefined" && node.currentContextBroker.accesslink.indexOf(contextBrokerUrl) == -1) {
            delete node.contextBrokerList;
        }
        if (typeof node.contextBrokerList == "undefined") {
			var lista = module.exports.getContextBrokerList(RED, accessToken, node);
			if (lista != null) {
				node.contextBrokerList = lista;
                module.exports.createDeviceLongIdAndRegisterActivity(RED, node, contextBrokerUrl, contextBrokerPort, deviceName, iotappid, accessToken);
			}
        } else {
            module.exports.createDeviceLongIdAndRegisterActivity(RED, node, contextBrokerUrl, contextBrokerPort, deviceName, iotappid, accessToken);
        }
    },
	getContextBrokerList: function (RED, accessToken, node){	
        var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
        var xmlHttp = new XMLHttpRequest();	
        var s4cUtility = require("./snap4city-utility.js");
        node.s4cAuth = RED.nodes.getNode(node.service.authentication);

		var uri = s4cUtility.settingUrl(RED,node, "iotDirectoryUrl", "https://www.snap4city.org", "/iot-directory/") + "api/";
        if (accessToken != "" && typeof accessToken != "undefined") {
			xmlHttp.open("GET", encodeURI(uri + "contextbroker.php?action=get_all_contextbroker&nodered=yes"), false);
			xmlHttp.setRequestHeader("Content-Type", "application/json");
			xmlHttp.setRequestHeader("Authorization", "Bearer " + accessToken);
			xmlHttp.send(null);
				if (xmlHttp.readyState === 4) {
					if (xmlHttp.status === 200) {
						if (xmlHttp.responseText != "") {
							try {
								return JSON.parse(xmlHttp.responseText).data;
							} catch (err) {
								return  xmlHttp.responseText.data;
							}
						} else {
							console.log("Error returned in getContextBrokerList (Empty response)");
							return null;
						}
					} else {
						console.log("Error returned in getContextBrokerList (1):" + xmlHttp.statusText);
						return null;
					}
				} else {
					console.log("Error returned in getContextBrokerList (2):" + xmlHttp.readyState);
					return null;
				}
		} else {
			console.log("Error returned in getContextBrokerList (Empty accessToken)");
			return null;
		}
	},
    createDeviceLongIdAndRegisterActivity: function (RED, node, contextBrokerUrl, contextBrokerPort, deviceName, iotappid, accessToken) {
        var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
        var xmlHttp = new XMLHttpRequest();
        var s4cUtility = require("./snap4city-utility.js");
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
            node.s4cAuth = RED.nodes.getNode(node.service.authentication);
            var uri = s4cUtility.settingUrl(RED,node, "myPersonalDataUrl", "https://www.snap4city.org", "/datamanager/api/v1/");
            if (accessToken != "" && typeof accessToken != "undefined") {
                xmlHttp.open("POST", encodeURI(uri + "lightactivities/?elementType=IOTID&sourceRequest=iotapp&sourceId=" + iotappid + "&elementId=" + node.deviceLongId), true);
                xmlHttp.setRequestHeader("Content-Type", "application/json");
                xmlHttp.setRequestHeader("Authorization", "Bearer " + accessToken);
                xmlHttp.onload = function (e) {
                    if (xmlHttp.readyState === 4) {
                        if (xmlHttp.status !== 200) {
                            console.log("Error returned in createDeviceLongIdAndRegisterActivity (1):"+xmlHttp.status);
                        }
                    } else {
                        console.log("Error returned in createDeviceLongIdAndRegisterActivity (2):"+xmlHttp.readyState);
                    }
                };
                xmlHttp.onerror = function (e) {
                    console.log("Error returned in createDeviceLongIdAndRegisterActivity (3):"+e);
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
        var urlWithoutHttp = url;			
		if (urlWithoutHttp.indexOf("http") != -1)
			urlWithoutHttp = urlWithoutHttp.replace("https://", "").replace("http://", "");
		var prefixPath = "";
		var hostname = urlWithoutHttp;	
		var indexSlash = urlWithoutHttp.indexOf("/");
		var indexDot = urlWithoutHttp.indexOf(":");			
		if (indexSlash!=-1 || indexDot!=-1){
			if (indexDot!=-1)
				//here the port information is ignored (use orionBrokerService.port instead)
				hostname = urlWithoutHttp.substring(0, indexDot);
			else
				hostname = urlWithoutHttp.substring(0, indexSlash);
			if (indexSlash!=-1)
				prefixPath = urlWithoutHttp.substring(indexSlash);
		}
        return [hostname, prefixPath];
    },	
	SubscriptionStore: SubscriptionStore,	
	NodeStatus: NodeStatus,	
	OrionHttpRequestOptions: OrionHttpRequestOptions
}