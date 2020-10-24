/*
 * These are the visual feedback you can see 
 * above the nodes and in debug side on node-red
 */
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

module.exports = NodeStatus