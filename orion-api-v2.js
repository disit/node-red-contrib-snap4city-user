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
   
var s4cUtility = require("./snap4city-utility.js");
var s4cOrionUtility = require("./snap4city-orion-utility.js");
var bodyParser = require("body-parser");
var getBody = require('raw-body');
var typer = require('media-typer');
var isUtf8 = require('is-utf8');
var http = require("follow-redirects").http;
var https = require("follow-redirects").https;
var urllib = require("url");
var https2 = require('https');
var when = require('when');
var fs = require('fs');
var path = require('path')
var os = require('os')

module.exports = function (RED) {
    "use strict";

	var subscriptionIDs = new s4cOrionUtility.SubscriptionStore(RED);
	var nodeStatus = new s4cOrionUtility.NodeStatus();
	var orionHttpRequestOptions = new s4cOrionUtility.OrionHttpRequestOptions();

    var jsonParser = bodyParser.json();
    var urlencParser = bodyParser.urlencoded({ extended: true });
    var token = "";
    var LIMIT = 30;
    /*
     *This node is not shown by NodeRed but is used by any other node
     *to make the various http requests (query, subscribe, etc.).
     *Configuration nodes doc: https://nodered.org/docs/creating-nodes/config-nodes
     */
    RED.nodes.registerType("orion-service-api-v2", OrionServiceV2, {
        credentials: {
            user: { type: "text" },
            password: { type: "password" }
        }
    });

    function OrionServiceV2(config) {
        RED.nodes.createNode(this, config);
        var serviceNode = this;

        this.authentication = config.authentication;
        this.url = config.url;
        this.port = config.port;
        var orionUrl = getOrionUrl(config);
        var credentials = { user: '', password: '' };

        if (/\/$/.test(this.url)) {
            this.url = this.url.substring(0, this.url.length - 1);
        }

        if (!this.port) {
            throw "Missing port";
        }

        this.init = function (node) {
            nodeStatus.initializing(node);

			node.selectedContextbroker = config.selectedContextbroker;

            return when.promise(function (resolve) {
                // get token from context broker
                getToken(node, serviceNode.url, credentials).then(function () {
                    resolve();
                });
            });
        };

        this.queryContext = function (node, config, queryParams) {
            const logger = s4cUtility.getLogger(RED, node);
            const uid = s4cUtility.retrieveAppID(RED);
            var orionBrokerService = RED.nodes.getNode(config.service);
            var accessToken = s4cUtility.retrieveAccessToken(RED, node, orionBrokerService.authentication, uid);

            nodeStatus.querying(node)

            logger.debug(`Querying entity: ${config.enid}`);

            return when.promise(function (resolve, reject) {
                s4cOrionUtility.getContextBrokerListForRegisterActivity(RED, node, orionBrokerService.url, orionBrokerService.port, retrieveDeviceName(node, config.enid, config.tenant, config.servicepath), uid, accessToken);
				
                var [hostname, prefixPath] = s4cOrionUtility.splitUrlInHostnameAndPrefixPath(orionBrokerService.url);
				
                var options = orionHttpRequestOptions.generateForOrionAPIV2Query(hostname, orionBrokerService.port, prefixPath, config, queryParams, accessToken)
                options = orionHttpRequestOptions.setHeaderAuthTenantAndTls(options, config, RED)
                
                var msg = {};
                var req = https2.request(options, function (res) {
                    (node.ret === "bin") ? res.setEncoding('binary') : res.setEncoding('utf8');
                    msg.statusCode = res.statusCode;
                    msg.headers = res.headers;
                    msg.payload = "";

                    res.on('data', function (chunk) {
                        msg.payload += chunk;
                    });

                    res.on('end', function () {
                        if (res.statusCode === 200) {
                            resolve(msg);
                        } else {
                            reject(msg);
                        }
                    });
                });

                req.on('error', function (err) {
                    reject(err);
                });

                req.write(JSON.stringify(queryParams));
                req.end();
            });
        };

        this.updateContext = function (node, config, payload, auth) {
            const logger = s4cUtility.getLogger(RED, node);
            const uid = s4cUtility.retrieveAppID(RED);
            var orionBrokerService = RED.nodes.getNode(config.service);
            var accessToken = s4cUtility.retrieveAccessToken(RED, node, orionBrokerService.authentication, uid);

            nodeStatus.sending(node)

            logger.debug(`Updating entity: ${config.enid} with payload: ${JSON.stringify(payload)}`);
            return when.promise(function (resolve, reject) {
                s4cOrionUtility.getContextBrokerListForRegisterActivity(RED, node, orionBrokerService.url, orionBrokerService.port, retrieveDeviceName(node, config.enid, config.tenant, config.servicepath), uid, accessToken);
                var [hostname, prefixPath] = s4cOrionUtility.splitUrlInHostnameAndPrefixPath(orionBrokerService.url);
                var options = orionHttpRequestOptions.generateForOrionAPIV2Update(hostname, orionBrokerService.port, prefixPath, config, auth, Buffer.byteLength(JSON.stringify(payload)), accessToken)
                options = orionHttpRequestOptions.setHeaderAuthTenantAndTls(options, config, RED, auth)

                var msg = {};
                var req = https2.request(options, function (res) {
                    msg.statusCode = res.statusCode;
                    msg.headers = res.headers;
                    msg.payload = "";
                    res.on('data', function (chunk) {
                        msg.payload += chunk;
                    });
                    res.on('end', function () {
                        if (res.statusCode === 204) {
                            resolve(msg);
                        } else {
                            reject(msg);
                        }
                    });
                });

                req.on('error', function (e) {
                    reject(e);
                });

                req.write(JSON.stringify(payload));
                req.end();
            });
        };

        this.subscribe = function (node, config, payload) {
            const logger = s4cUtility.getLogger(RED, node);
            const uid = s4cUtility.retrieveAppID(RED);
            var orionBrokerService = RED.nodes.getNode(config.service);
            var accessToken = s4cUtility.retrieveAccessToken(RED, node, orionBrokerService.authentication, uid, false);

            var reference = payload.notification.http.url;

            nodeStatus.subscribing(node)

            logger.debug(`Subscribing entity: ${config.enid} with payload: ${JSON.stringify(payload)}`);
			var correctPath =os.homedir() + "/.snap4cityConfig/";//consider edge scenario
			if (RED.settings.APPID != null) {//check edge scenario or cloud scenario
				correctPath = "/data/.snap4cityConfig/";//consider cloud scenario
			}
			var jsonFilePath=correctPath+node.id+".json";
			if(!node.enid&&fs.existsSync(jsonFilePath)){
			//if(!node.enid){	
				var subscriptionJson = JSON.parse(fs.readFileSync(jsonFilePath));
				config.enid=subscriptionJson[subscriptionJson.length-1]['id'];
				}
			
            s4cOrionUtility.getContextBrokerListForRegisterActivity(RED, node, orionBrokerService.url, orionBrokerService.port, retrieveDeviceName(node, config.enid, config.tenant, config.servicepath), uid, accessToken);
            var [hostname, prefixPath] = s4cOrionUtility.splitUrlInHostnameAndPrefixPath(orionBrokerService.url);
            var options = orionHttpRequestOptions.generateForOrionAPIV2Subscribe(hostname, orionBrokerService.port, prefixPath, config, JSON.stringify(payload).length, accessToken)
            options = orionHttpRequestOptions.setHeaderAuthTenantAndTls(options, config, RED)

            logger.debug("subscribeContext options:" + JSON.stringify(options));

            try {
                var msg = {};

                var req = https2.request(options, function (res) {
                    if (node.ret === "bin") res.setEncoding('binary');
                    else res.setEncoding('utf8');
                    msg.statusCode = res.statusCode;
                    msg.headers = res.headers;
                    msg.payload = "";
                    res.on('data', function (chunk) {
                        msg.payload += chunk;
                    });
                    res.on('end', function () {
                        logger.info("subscribeContext result:" + msg.statusCode + " " + msg.payload);
                        if (res.statusCode === 201) {
                            if (msg.headers.location != null) {//TODO verify this
                                var subscriptionID = msg.headers.location.replace('/v2/subscriptions/', '');
								
                                var nodeID = (node.id + "").replace('.', '');
                                //listen subscription just if the return code is 200ok
                                listenOnUrl(nodeID, function (req, res) {
                                    if (req.body.subscriptionId != subscriptionIDs.getSubscriptionOfNode(nodeID)) {
                                        logger.error("Recognized invalid subscription: " + req.body.subscriptionId + " currentId: " + subscriptionIDs.getSubscriptionOfNode(nodeID));
                                        unsubscribeFromOrion(node, req.body.subscriptionId, orionUrl, config);
                                    } else {
                                        //var payload = formatOutput(node, config, req.body.data);//TODO *1 verify formatOutput
                                        node.send({
                                            payload: req.body.data,//TODO *1
                                            statusCode: 201
                                        });
                                    }
                                    res.sendStatus(200);
                                });
                                logger.info("subscribeContext elementId: " + config.enid + " nodeId: " + nodeID + " oldSubId: " + subscriptionIDs.getSubscriptionOfNode(nodeID) + " newSubId: " + subscriptionID);
                                var idToUnsubscribe = subscriptionIDs.getSubscriptionOfNode(nodeID);//save previous sub for unsub
                                subscriptionIDs.setSubscriptionOnNode(subscriptionID, nodeID);//update new subs
                                if (idToUnsubscribe != undefined) {//if there was a previous sub
                                    logger.info("unsubscription:" + idToUnsubscribe);
                                    setTimeout(function () {
                                        unsubscribeFromOrion(node, idToUnsubscribe, orionUrl, config);//unsub previous sub
                                    }, 2000);
                                }
                            } else if (parsedResponse.result == false) {
								logger.error("subscribeContext error:" + JSON.stringify(msg));
                                nodeStatus.getError(node, msg)
                            }
                        } else {
                            logger.error("subscribeContext error:" + JSON.stringify(msg));
							var deviceType = (msg.payload.deviceType ? msg.payload.deviceType : config.entype);
							var deviceId = (msg.payload.deviceId ? msg.payload.deviceId : config.enid);
							var correctPath =os.homedir() + "/.snap4cityConfig/";//consider edge scenario
							if (RED.settings.APPID != null) {//check edge scenario or cloud scenario
								correctPath = "/data/.snap4cityConfig/";//consider cloud scenario
								}
							var nodeID = (node.id + "").replace('.', '');
							var jsonFilePath=correctPath+nodeID+".json";	
							if(fs.existsSync(jsonFilePath)){
								var subscriptionJson = JSON.parse(fs.readFileSync(jsonFilePath));
								var ind=-1
								for(var i = 0; i < subscriptionJson.length; i++){
									if(subscriptionJson[i].id === deviceId && subscriptionJson[i].type === deviceType){
										ind=i;
										break;
									}
								}
								if(ind!=-1){
									subscriptionJson.splice(ind, 1);
								}
								fs.writeFileSync(jsonFilePath, JSON.stringify(subscriptionJson))
							}
							
                            nodeStatus.getError(node, msg)
                        }
                    });
                });
				
				
				
                req.on('error', function (err) {
                    logger.error("subscribeContext error:" + err);
					nodeStatus.getError(node, err)
                });

                nodeStatus.listening(node, reference)

                if (payload) {
                    logger.debug("subscribeContext payload:" + JSON.stringify(payload));
                    req.write(JSON.stringify(payload));
                }
				req.end();

            } catch (err) {
				
                logger.error("subscribeContext error:" + err);
                nodeStatus.getError(node, err)
				
            }
		};
    }

    function unsubscribeFromOrion(node, subscriptionId, url, config) {
        const logger = s4cUtility.getLogger(RED, node);
        const uid = s4cUtility.retrieveAppID(RED);
        var orionBrokerService = RED.nodes.getNode(config.service);
        var accessToken = s4cUtility.retrieveAccessToken(RED, node, orionBrokerService.authentication, uid);

        logger.debug("Unsubscring ID: " + JSON.stringify(subscriptionId));

        return when.promise(function (resolve, reject) {

            var [hostname, prefixPath] = s4cOrionUtility.splitUrlInHostnameAndPrefixPath(orionBrokerService.url);
            var options = orionHttpRequestOptions.generateForOrionAPIV2Unsubscribe(hostname, orionBrokerService.port, prefixPath, config, subscriptionId, accessToken)
            options = orionHttpRequestOptions.setHeaderAuthTenantAndTls(options, config, RED)

            var req = https2.request(options, function (res) {

                (node.ret === "bin") ? res.setEncoding('binary') : res.setEncoding('utf8');
                res.on('end', function () {
                    resolve(res);
                });
            });
            req.on('error', function (err) {
                logger.error("Error in unsubscribe: "+err);
                reject(err);
            });
            req.write(JSON.stringify(
                {
                    "statusCode": {
                        "code": "200",
                        "reasonPhrase": "OK"
                    },
                    "subscriptionId": subscriptionId
                }
            ));
            req.end();
        });
    }

    // retrieve token from context broker
    function getToken(node, orionUrl, credentials) {

        const logger = s4cUtility.getLogger(RED, node);
        var tokenUrl = orionUrl + "/token";
        if (tokenUrl.indexOf("http://") >= 0) {
            tokenUrl = "https://" + tokenUrl.substring(7);
        } else if (orionUrl.indexOf("https://") < 0) {
            tokenUrl = "https://" + tokenUrl;
        }

        var opts = urllib.parse(tokenUrl);

        opts.method = "POST";
        opts.headers = {};
        opts.headers['content-type'] = "application/json";
        opts.headers["Accept"] = "application/json";
        var payload = {
            "username": credentials.user,
            "password": credentials.password
        };

        payload = JSON.stringify(payload);

        opts.headers['content-length'] = Buffer.byteLength(payload);
        token = "";

        return when.promise(function (resolve, reject) {
            if (!credentials.user) {
                resolve();
            } else {
                logger.debug("--requesting token using payload: " + payload);
                var req = (https).request(opts, function (res) {
                    (node.ret === "bin") ? res.setEncoding('binary') : res.setEncoding('utf8');

                    res.on('data', function (chunk) {
                        token += chunk;
                    });

                    res.on('end', function () {
                        logger.debug("--resolved token: " + token);
                        resolve(token);
                    });
                });

                req.on('error', function (err) {
                    reject(err);
                    node.status({
                        fill: "red",
                        shape: "ring",
                        text: err.code
                    });
                    node.send({
                        payload: err.toString() + " : " + tokenUrl,
                        statusCode: err.code
                    });
                });

                req.write(payload);
                req.end();
            }
        });
    }

    function formatOutput(node, n, msg) {

        var contextResponses = msg.contextResponses;
        var payload = [];
        if (typeof contextResponses != "undefined") {
            contextResponses.forEach(function (entry) {
                var contextElement = entry.contextElement;
                delete contextElement.isPattern;
                if (!n.includeattr) {
                    // removing attribute metadata
                    contextElement.attributes.forEach(function (entry) {
                        delete entry.metadatas;
                    });
                }

                payload.push(contextElement);
            });
        }

        return payload;
    }

    function rawBodyParser(req, res, next) {
        if (req._body) {
            return next();
        }
        req.body = "";
        req._body = true;

        var isText = true;
        var checkUTF = false;

        if (req.headers['content-type']) {
            var parsedType = typer.parse(req.headers['content-type'])
            if (parsedType.type === "text") {
                isText = true;
            } else if (parsedType.subtype === "xml" || parsedType.suffix === "xml") {
                isText = true;
            } else if (parsedType.type !== "application") {
                isText = false;
            } else if (parsedType.subtype !== "octet-stream") {
                checkUTF = true;
            }
        }

        getBody(req, {
            length: req.headers['content-length'],
            encoding: isText ? "utf8" : null
        }, function (err, buf) {
            if (err) {
                return next(err);
            }
            if (!isText && checkUTF && isUtf8(buf)) {
                buf = buf.toString()
            }

            req.body = buf;
            next();
        });
    }

    function validateInput(node, n) {
        var err = null;
        n.url = n.url;
        n.port = n.port;
        n.enid = n.enid;
        n.entype = n.entype;
        n.ispattern = n.ispattern;
        n.userk1 = n.userk1;
        n.passk2 = n.passk2;
        n.tenant = n.tenant;
        n.servicepath = n.servicepath;
        n.apikey = n.apikey;
        n.basicAuth = n.basicAuth;
        n.attributes = n.attributes;
        n.condvalues = n.condvalues;
        n.includeattr = n.includeattr;
        n.port = n.port * 1;



        /*if (!n.enid || !n.entype) {
            err = "Missing subscription parameters";
        }*/

        if (err) {
            throw err;
        }

        n.attributes = n.attributes || [];
        if (n.attributes.constructor !== Array) {
            n.attributes = (n.attributes || "").split(",");
            for (var i = 0; i < n.attributes.length; i++) {
                n.attributes[i] = n.attributes[i].trim();
            }
        }

        n.condvalues = n.condvalues || [];
        if (n.condvalues.constructor !== Array) {
            n.condvalues = (n.condvalues || "").split(",");
            for (var i = 0; i < n.condvalues.length; i++) {
                n.condvalues[i] = n.condvalues[i].trim();
            }
        }

    }

    function generateSubscribePayload(node, n) {
        // prepare payload for context subscription
        // contains node uid and url besides data supplied in node fields
		
        var nodeID = node.id + "";
        nodeID = nodeID.replace('.', '');
		
        return when.promise(
            function (resolve, reject) {
                getMyUri(n).then(function (myUri) {
					var correctPath =os.homedir() + "/.snap4cityConfig/";//consider edge scenario
					if (RED.settings.APPID != null) {//check edge scenario or cloud scenario
						correctPath = "/data/.snap4cityConfig/";//consider cloud scenario
					}
					var jsonFilePath=correctPath+n.id+".json";
					if (fs.existsSync(jsonFilePath)) {
						var subscriptionJson = JSON.parse(fs.readFileSync(jsonFilePath));
						var entities=[]	
						for (var i = 0; i < subscriptionJson.length; i++) {
							entities.push({"id": subscriptionJson[i]['id'],"isPattern": n.ispattern,"type": subscriptionJson[i]['type']})	
						}
						if(!n.enid){
							var devid=subscriptionJson[subscriptionJson.length-1]['id'];
						}else{
							var devid=n.enid;
						}
					}else{
						var entities=[]
						entities.push({"id": n.enid,"isPattern": n.ispattern,"type": n.entype})
						fs.writeFileSync(jsonFilePath, JSON.stringify(entities));						
					}
					
					
					var subject= {"condition": {
                                    "attrs": n.condvals ? [n.condvals] : []
                                }
                            };
							
					///////////////////
					///////////////////
					///////////////////
					var orionUrl = node.brokerConn.url;
					var prot='http';
					if (orionUrl.indexOf("https://") >= 0) {
						prot='https';
					}
					///////////////////
					///////////////////
					//////////////////
					subject["entities"]=entities;
					var sub={
                            "description": `A subscription to get info about ${devid}`,
                            
                            "notification": {
                                "http": {
                                    "url": `${prot}://${myUri}/${nodeID}`
                                },
                                "attrs": n.attributes
                            }
					};
					sub["subject"]=subject;

					var expires = new Date();
					expires.setDate(expires.getDate()+Number(n.duration));
					sub["expires"]= expires.toISOString();
					if (n.throttle!=0)
						sub["throttling"]=Number(n.throttle);
                    resolve(sub);
                });
            }
        );
    }

    function getOrionUrl(n) {
        var orionUrl = n.url;

        if (!/^((http|https):\/\/)/.test(orionUrl)) {
            orionUrl = "https://" + orionUrl + ":" + n.port;
        }

        return orionUrl;
    }

    //OrionSubscribeV2 node constructor	
    RED.nodes.registerType("orion-subscribe-api-v2", OrionSubscribeV2);

    function OrionSubscribeV2(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        this.service = n.service;
        this.brokerConn = RED.nodes.getNode(this.service);
        this.noderedhost = n.noderedhost;
        this.userk1 = n.userk1;
        this.passk2 = n.passk2;
        this.apikey = n.apikey;
        this.basicAuth = n.basicAuth;

        this.on("close", function () {
            var nodeID = node.id + "";
            nodeID = nodeID.replace('.', '');

            RED.httpNode._router.stack.forEach(function (route, i, routes) {
                if (route.route && route.route.path == "/" + nodeID) {
                    routes.splice(i, 1);
                }
            });
            //cannot invoke unsubscribe from here since the config is empty (and the contextbroker uri is unknown)
            //	unsubscribeFromOrion(node, subscriptionIDs[nodeID], null, n);
        });

        // validate mandatory fields
        validateInput(this, n);
		this.on('input', function (msg) {
			var action = msg.payload.action;
			var deviceType = (msg.payload.deviceType ? msg.payload.deviceType : config.entype);
			var deviceId = (msg.payload.deviceId ? msg.payload.deviceId : config.enid);
			var isPattern = (!(typeof msg.payload.isPattern === "undefined") ? msg.payload.isPattern :n.ispattern);
			n.entype=deviceType;
			n.enid=deviceId;
			n.ispattern=isPattern;
			var correctPath =os.homedir() + "/.snap4cityConfig/";//consider edge scenario
			
			if (RED.settings.APPID != null) {//check edge scenario or cloud scenario
				correctPath = "/data/.snap4cityConfig/";//consider cloud scenario
			}
			var jsonFilePath=correctPath+n.id+".json";
			if (!fs.existsSync(correctPath)) { 
				fs.mkdirSync(correctPath);//not exist folder, create folder + empty file
				fs.writeFileSync(jsonFilePath, JSON.stringify(msg.payload));
			} else if (!fs.existsSync(jsonFilePath)){
				//this.subscriptionJson = JSON.parse(fs.readFileSync(jsonFilePath));
				fs.writeFileSync(jsonFilePath, '[]',{ flag: 'w' });//not exist file, create empy file
			} else //folder and file exist, read from it
				this.subscriptionJson = JSON.parse(fs.readFileSync(jsonFilePath));
	
			var subscriptionJson = JSON.parse(fs.readFileSync(jsonFilePath));

			if(action==="add"){
				var ind=true;
				for(var i = 0; i < subscriptionJson.length; i++){
					if(subscriptionJson[i].id === deviceId && subscriptionJson[i].type === deviceType){
						ind=false;
						break;
						}
					}
				if(ind){
					subscriptionJson.push({"id": deviceId,"isPattern": n.ispattern,"type": deviceType});
					fs.writeFileSync(jsonFilePath, JSON.stringify(subscriptionJson));
				}
				
				}else if(action==="remove"){
					var ind=-1
					for(var i = 0; i < subscriptionJson.length; i++){
						if(subscriptionJson[i].id === deviceId && subscriptionJson[i].type === deviceType){
							ind=i;
							break;
						}
					}
					if(ind!=-1){
						subscriptionJson.splice(ind, 1);
					}
					fs.writeFileSync(jsonFilePath, JSON.stringify(subscriptionJson))
				}else{
					msg.payload ="possible actions are add or remove"
			}
			generateSubscribePayload(node, n).then(function (payload) {
                node.brokerConn.subscribe(node, n, payload);
            });
			
			msg.info=msg.payload;

			node.send(msg);
			
		});
			
		
		node.brokerConn.init(node, n).then(function () {
			var correctPath =os.homedir() + "/.snap4cityConfig/";//consider edge scenario
			
			if (RED.settings.APPID != null) {//check edge scenario or cloud scenario
				correctPath = "/data/.snap4cityConfig/";//consider cloud scenario
				}
			var jsonFilePath=correctPath+n.id+".json";	
			if (fs.existsSync(jsonFilePath)){

				generateSubscribePayload(node, n).then(function (payload) {
					node.brokerConn.subscribe(node, n, payload);
					});
				}else{
					generateSubscribePayload(node, n).then(function (payload) {
					node.brokerConn.subscribe(node, n, payload);
					});

					
				}
			
			});
		
		
    }

    function listenOnUrl(url, callback) {
        var errorHandler = function (err, req, res, next) {
            res.sendStatus(500);
        };

        var next = function (req, res, next) {
            next();
        };
        // will listen on 'localhost/url' for notifications from context broker and call callback function
        RED.httpNode.post("/" + url, next, next, next, jsonParser, urlencParser, rawBodyParser, callback, errorHandler);
    }

    function getMyUri(node) {
        return when.promise(
            function (resolve, reject) {

                const logger = s4cUtility.getLogger(RED, node);

                // first try to get user specified uri, TODO: many input validations...
                var myUri = node.noderedhost;
                if (myUri) {
                    resolve(myUri + RED.settings.httpRoot /*+ ":" + RED.settings.uiPort*/); //PB removed port
                } else {
                    myUri = RED.settings.externalHost; //PB fix added
                    if (myUri)
                        //TODO check if this one is needed 
                        //resolve(myUri + RED.settings.httpRoot.substring(0, RED.settings.httpRoot.lenght - 1) /*+ ":" + RED.settings.uiPort*/ ); //PB remove port
                        resolve(myUri + RED.settings.httpRoot /*+ ":" + RED.settings.uiPort*/); //PB remove port
                    else {
                        // attempt to get from bluemix
                        try {
                            var app = JSON.parse(process.env.VCAP_APPLICATION);
                            myUri = app['application_uris'][0];
                        } catch (e) {
                            logger.error("Probably not running in bluemix...");
                        }
                    }
                }

                if (myUri) {
                    resolve(myUri);
                } else {
                    var net = require('net');
                    var client = net.connect({
                        port: 80,
                        host: "google.com"
                    },
                        function () {
                            if (!client.localAddress) {
                                reject("Failed to get local address");
                            } else {
                                resolve(client.localAddress + ":" + RED.settings.uiPort);
                            }
                        }
                    );
                }
            }
        );
    }

    //OrionQueryV2 node constructor	
    RED.nodes.registerType("orion-query-api-v2", OrionQueryV2);

    function OrionQueryV2(config) {
        RED.nodes.createNode(this, config);
        const logger = s4cUtility.getLogger(RED, this);     

        this.on("input", function (msg) {
            this.service = config.service;
            this.serviceNode = RED.nodes.getNode(this.service);
            var node = this;
			
            // process input from UI and input pipe
            s4cOrionUtility.processInput(config, msg);

            var queryParams = {
                "entities": [{
                    "type": config.entype,
                    "id": config.enid
                }],
                "attributes": config.attributes
            };

            try {
                node.serviceNode.init(node, config).then(function () {
                    node.serviceNode.queryContext(node, config, queryParams).then(
                        function (msg) {
                            logger.debug("queryContext result:" + JSON.stringify(msg));
                            nodeStatus.send(node, [JSON.parse(msg.payload)], 200)
                            nodeStatus.success(node)
                        },
                        function (reason) {
                            logger.error("queryContext error:" + JSON.stringify(reason));
                            nodeStatus.getError(node, reason, "Failed to query! Reason: " + JSON.stringify(reason))
                        }
                    );
                });
            } catch (err) {
                nodeStatus.getError(node, err.code, msg)
                node.send({
                    payload: err.toString(),
                    statusCode: err.code
                });
            }
        });
    }

    //OrionUpdate node constructor
    RED.nodes.registerType("orion-update-api-v2", OrionUpdateV2);

    function OrionUpdateV2(config) {
        RED.nodes.createNode(this, config);

        const logger = s4cUtility.getLogger(RED, this);

        this.on("input", function (msg) {
            this.service = config.service;
            this.serviceNode = RED.nodes.getNode(this.service);
            var node = this;
			
            if (typeof msg.auth == "string") {
                msg.auth = JSON.parse(msg.auth);
            }

            var payload = generateUpdatePayload(config);

            try {
                node.serviceNode.init(node, config).then(function () {
                    node.serviceNode.updateContext(node, config, payload, msg.auth).then(
                        function () {
                            //In API v2 there is no body in response
                            logger.debug("Entity updated");
                            nodeStatus.send(node, "Success", 200)
                            nodeStatus.success(node)
                        },
                        function (reason) {
                            logger.error("updateContext error:" + JSON.stringify(reason));
                            nodeStatus.getError(node, reason, "failed to update, reason: " + JSON.stringify(reason));
                        }
                    );
                });
            } catch (err) {
                nodeStatus.getError(node, err.code, msg)
            }
        });
    }

    function generateUpdatePayload(nodeConfig) {
        var attr
        var attributesName = [];
        var attributesValue = [];
        var payload = {}

        if (nodeConfig.attrkey && nodeConfig.attrvalue) {
            attributesName = nodeConfig.attrkey.replace(' ', '').split(',')
            attributesValue = nodeConfig.attrvalue.replace(' ', '').split(',')
            //Remove last element if attributes list ends with , (comma)
            if (attributesName[attributesName.length - 1] === '')
                attributesName.pop()
            if (attributesValue[attributesValue.length - 1] === '')
                attributesName.pop()
            if (attributesName.length !== attributesValue.length)
                throw "Missing attributes name or value "
        }

        attributesValue.forEach((attrValue, index) => {
            attr = { "value": attrValue, "type": "string" }
            if (attrValue.indexOf('.') !== -1 && attrValue === Number.parseFloat(attrValue).toString())
                attr = { "value": Number.parseFloat(attrValue), "type": "float" }
            if (attrValue === Number.parseInt(attrValue).toString())
                attr = { "value": Number.parseInt(attrValue), "type": "int" }
            payload[attributesName[index]] = attr
        })
        return payload;
    }

    //OrionOut node constructor	
    RED.nodes.registerType("orion-out-api-v2", OrionOutV2);

    function OrionOutV2(config) {
        const logger = s4cUtility.getLogger(RED, this);
        RED.nodes.createNode(this, config);

        this.on("input", function (msg) {
            this.service = config.service;
            this.serviceNode = RED.nodes.getNode(this.service);
            var node = this;
			
            try {
                if (typeof msg.auth == "string") {
                    msg.auth = JSON.parse(msg.auth);
                }

                if (typeof msg.payload == "string") {
                    msg.payload = JSON.parse(msg.payload);
                }

                //it converts to array a single attribute
                if (typeof msg.payload.length == "undefined" && typeof msg.payload.id == "undefined" && typeof msg.payload.type == "undefined") {
                    msg.payload = [msg.payload];
                }

				var msgToSend;
                if (Array.isArray(msg.payload)) {
                    if ((config.entype == "") || (config.enid == ""))
                        throw ("entype or enid missing");								
					msgToSend=msg.payload[0];
                } else {
                    if (((msg.payload.type == undefined) && (config.entype == "")) ||
                        ((msg.payload.id == undefined) && (config.enid == "")))
                        throw ("entype or enid missing");
					config.enid=msg.payload.id;
					config.entype=msg.payload.type;						
					delete msg.payload['type'];
					delete msg.payload['id'];
					msgToSend=msg.payload;
                }

                try {
                    node.serviceNode.init(node, config).then(() => {
                        node.serviceNode.updateContext(node, config, msgToSend, msg.auth)
                            .then(
                                () => {
									nodeStatus.success(node)
									msg.payload={"data":{"id":config.enid,"type":config.entype,msgToSend},"status":{"statusCode":200,"headers":{},"payload":"Success"}}
									node.send(msg)
									//console.log(node.currentContextBroker)
									/*try {
										//s4cUtility.eventLog(RED, {"id":config.enid,"type":config.entype,msgToSend}, msg.payload, config, "Node-Red", "Orion", node.currentContextBroker.accesslink, "TX");
										console.log("FATTO")
									}catch (e) {
										console.log("ENTRATO NEL CATCH")
									}*/
								},
                                (reason) => {
									logger.error("Update id:"+config.enid+",type:"+config.entype+JSON.stringify({"data":msgToSend,"status":reason}));
									nodeStatus.getError(node, reason,"Update id:"+config.enid+",type:"+config.entype+JSON.stringify({"data":msgToSend,"status":reason}) );
									msg.payload={"data":{"id":config.enid,"type":config.entype,msgToSend},"status":reason}
									node.send(msg)
									s4cUtility.eventLog(RED, {"id":config.enid,"type":config.entype,msgToSend}, msg.payload, config, "Node-Red", "Orion", node.currentContextBroker.accesslink, "TX");
                                
                                }
                            );
                    });
                } catch (err) {
                    nodeStatus.getError(node, err.code, msg);
                    nodeStatus.send(node, err.toString(), err.code)
                }
            } catch (e) {
                node.status({
                    fill: "red",
                    shape: "ring",
                    text: "Problem with input msg"
                });
                node.error(e);
            }
        });
    }
	
	function retrieveDeviceName(node, id, tenant, servicepath){
		const logger = s4cUtility.getLogger(RED, node);
		var deviceName=id;
		//logger.info("Device name is:"+deviceName);
		//logger.info("tenant is:"+tenant);
		//logger.info("servicepath is:"+servicepath);
		if ((tenant != null && tenant != "")||(servicepath != null && servicepath != "")) {
			if (servicepath != null && servicepath != "") {
				if (!servicepath.startsWith("/"))
					deviceName="/"+servicepath+"."+deviceName;
				else
					deviceName=servicepath+"."+deviceName;
			}
			else
				deviceName="/."+deviceName;
			
			if (tenant != null && tenant != "")
				deviceName=tenant+"."+deviceName;
			else
				deviceName="."+deviceName;
		}
		logger.info("Device name is:"+deviceName);
		return deviceName;
	}
	
	RED.httpAdmin.get('/myContextbrokerDataList', RED.auth.needsPermission('orion-api-v2.read'), function (req, res) {
        var s4cUtility = require("./snap4city-utility.js");
		var s4cOrionUtility = require("./snap4city-orion-utility.js");
        var accessToken = s4cUtility.retrieveAccessToken(RED, null, req.body.authenticationNodeId, null);
		var lista=s4cOrionUtility.getContextBrokerList(RED, accessToken, req.body.authenticationNodeId );
		if (lista==null)
			lista=[];
		res.send({
			"contextbrokerDataList": lista
		});
    });
}
