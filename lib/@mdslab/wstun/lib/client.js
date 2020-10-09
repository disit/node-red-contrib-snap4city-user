//###############################################################################
//##
//# Copyright (C) 2014-2015 Andrea Rocco Lotronto, 2017 Nicola Peditto
//##
//# Licensed under the Apache License, Version 2.0 (the "License");
//# you may not use this file except in compliance with the License.
//# You may obtain a copy of the License at
//##
//# http://www.apache.org/licenses/LICENSE-2.0
//##
//# Unless required by applicable law or agreed to in writing, software
//# distributed under the License is distributed on an "AS IS" BASIS,
//# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//# See the License for the specific language governing permissions and
//# limitations under the License.
//##
//###############################################################################

var logger = log4js.getLogger('wstun');

(function() {
  
  var WebSocketClient, bindSockets, net, wst_client;

  WebSocketClient = require('websocket').client;
  net = require("net");
  bindSockets = require("./bindSockets");

  module.exports = wst_client = (function() {

    function wst_client() {
      logger.info("[SYSTEM] - WS Tunnel Client starting...");
      this.tcpServer = net.createServer();
    }

    wst_client.prototype.start = function(localPort, wsHostUrl, remoteAddr) {

      logger.info("[SYSTEM] --> client started.");
      
      var proto = wsHostUrl.split(":")[0];
      if(proto == "wss")
        require("../lib/https_override");

      this.tcpServer.listen(localPort);

      logger.info("[SYSTEM] --> WS tunnel established. Waiting for incoming connections...");

      return this.tcpServer.on("connection", (function(_this) {

        return function(tcpConn) {

          var url, wsClient;
          logger.info("[SYSTEM] - New connection...");

          wsClient = new WebSocketClient();

          wsClient.on('connectFailed', function(error) {
            logger.info("[SYSTEM] --> WS connect error: " + error.toString());
            return tcpConn.destroy();
          });

          wsClient.on('connect', function(wsConn) {
            logger.info("[SYSTEM] --> WS connected.");
            return bindSockets(wsConn, tcpConn);
          });

          if (remoteAddr) {
            url = "" + wsHostUrl + "/?dst=" + remoteAddr;
          } else {
            url = "" + wsHostUrl;
          }

          return wsClient.connect(url, 'tunnel-protocol');

        };

      })(this));

    };

    return wst_client;

  })();

}).call(this);