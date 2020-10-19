
class HttpRequestOptions {

    setHeaderAuthTenantAndTls(options, config, RED, auth = null) {
        var tlsNode = RED.nodes.getNode(config.tls);
        var apikey = (auth && auth.apikey) ? auth.apikey : ((config.apikey && config.apikey != "") ? config.apikey : undefined);
        var basicAuth = (auth && auth.basicAuth) ? auth.basicAuth : ((config.basicAuth && config.basicAuth != "") ? config.basicAuth : undefined);

        if (apikey)
            options.headers.apikey = config.apikey;

        if (basicAuth)
            options.headers.Authorization = config.basicAuth;

        if (config.tenant != null && config.tenant != "") {
            options.headers["Fiware-Service"] = config.tenant;
            options.headers["Fiware-ServicePath"] = config.servicepath;
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
            path: prefixPath + "/v2/entities/" + config.enid + "/attrs?elementid=" + config.enid + (k1 ? "&k1=" + k1 : "") + (k2 ? "&k2=" + k2 : ""),
            method: 'PATCH',
            rejectUnauthorized: false,
            headers: {
                'Authorization': 'Bearer ' + accessToken, //by default, we insert the Snap4City SSo AccessToken, that can be overrided by the config.basicAuth
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
                'Authorization': 'Bearer ' + accessToken, //by default, we insert the Snap4City SSo AccessToken, that can be overrided by the config.basicAuth
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
                'Authorization': 'Bearer ' + accessToken, //by default, we insert the Snap4City SSo AccessToken, that can be overrided by the config.basicAuth			
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
                'Authorization': 'Bearer ' + accessToken, //by default, we insert the Snap4City SSo AccessToken, that can be overrided by the config.basicAuth			
            }
        };
        return options
    }

}

module.exports = HttpRequestOptions