var fs = require('fs')

class SubscriptionStore {
    constructor(jsonFilePath = '/subscriptions.json') {
        this.jsonFilePath = '../../' + __dirname + jsonFilePath
        this.subscriptionJson = JSON.parse(fs.readFileSync(this.jsonFilePath));
    }

    getSubscriptionOfNode(nodeId) {
        return this.subscriptionJson[nodeId]
    }

    setSubscriptionOnNode(subscriptionId, nodeId) {
        this.subscriptionJson[nodeId] = subscriptionId
        fs.writeFileSync(this.jsonFilePath, JSON.stringify(this.subscriptionJson))
    }
}

module.exports = SubscriptionStore