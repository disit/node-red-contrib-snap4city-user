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
  
  var WebSocketServer, bindSockets, http, net, url, wst_server;

  WebSocketServer = require('websocket').server;

  http = require('http');
  url = require("url");
  net = require("net");
  bindSockets = require("./bindSockets");

  https_flag = null;

  module.exports = wst_server = (function() {

    function wst_server(options) {

      if(options != undefined) {
        
        logger.info("[SYSTEM] - WS Tunnel Server starting with these paramters:\n" + JSON.stringify(options, null, "\t"));
        this.dstHost = options.dstHost;
        this.dstPort = options.dstPort;

        https_flag = options.ssl;

      }
      else
        logger.info("[SYSTEM] - WS Tunnel Server starting...");

      if(https_flag == "true"){

        //HTTPS
        logger.info("[SYSTEM] - WS over HTTPS");
          
        var https = require('https');
        var fs = require('fs');

        require("../lib/https_override");

        try{
          // certificates loading from file
          this.s4t_key = fs.readFileSync(options.key, 'utf8');
          this.s4t_cert = fs.readFileSync(options.cert, 'utf8');

        }catch (err) {
          // handle the error safely
          logger.info("[SYSTEM] --> ERROR: " + err);
          process.exit(1);
        }

        var credentials = {
          key: this.s4t_key,
          cert: this.s4t_cert
        };

        this.httpServer = https.createServer(credentials, function(request, response) {
          logger.info(request, response);
        });

        this.wsServer = new WebSocketServer({
          httpServer: this.httpServer,
          autoAcceptConnections: false
        });


      }else{

        //HTTP
        logger.info("[SYSTEM] - WS over HTTP");

        this.httpServer = http.createServer(function(request, response) {
          logger.info(request, response);
        });

        this.wsServer = new WebSocketServer({
          httpServer: this.httpServer,
          autoAcceptConnections: false
        });

      }



    }

    wst_server.prototype.start = function(port) {

      if (https_flag == "true")
        logger.info("[SYSTEM] - WS Tunnel Server starting on: wss://localhost:" + port + " - CERT: \n" + this.s4t_cert);
      else
        logger.info("[SYSTEM] - WS Tunnel Server starting on: ws://localhost:" + port);
      
      this.httpServer.listen(port, function() {
        return logger.info("[SYSTEM] - Server is listening on port " + port + "...");
      });
      
      return this.wsServer.on('request', (function(_this) {
        return function(request) {

          var host, remoteAddr, tcpconn, uri, _ref, _ref1;

          if (!_this.originIsAllowed(request.origin)) {
            return _this._reject(request, "Illegal origin " + origin);
          }

          uri = url.parse(request.httpRequest.url, true);
          _ref = [_this.dstHost, _this.dstPort], host = _ref[0], port = _ref[1];

          if (host && port) {

            remoteAddr = "" + host + ":" + port;

          } else {

            if (!uri.query.dst) {
              return _this._reject(request, "No tunnel target specified");
            }

            remoteAddr = uri.query.dst;
            _ref1 = remoteAddr.split(":"), host = _ref1[0], port = _ref1[1];

          }

          tcpconn = net.connect( { port: port, host: host }, function() {
              var wsconn;
              logger.info("[SYSTEM] - Establishing tunnel to " + remoteAddr);
              wsconn = request.accept('tunnel-protocol', request.origin);
              return bindSockets(wsconn, tcpconn);
          });

          return tcpconn.on("error", function(err) {
            return _this._reject(request, "Tunnel connect error to " + remoteAddr + ": " + err);
          });

        };
        
      })(this));

    };

    wst_server.prototype.originIsAllowed = function(origin) {
      return true;
    };

    wst_server.prototype._reject = function(request, msg) {
      request.reject();
      return logger.info("[SYSTEM] - Connection from " + request.remoteAddress + " rejected: " + msg);
    };

    return wst_server;

  })();

}).call(this);
