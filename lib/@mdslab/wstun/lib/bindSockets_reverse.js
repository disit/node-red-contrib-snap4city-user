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

bindSockets = function(wsconn, tcpconn) {
  
  wsconn.__paused = false;
  
  wsconn.on('message', function(message) {

    //logger.debug('[SYSTEM] --> WS MESSAGE:'); logger.debug(JSON.stringify(message));
    
    if (message.type === 'utf8') {
      return logger.info('Error, Not supposed to received message ');
    } 
    else if (message.type === 'binary') {
      if (false === tcpconn.write(message.binaryData)) {
        wsconn.socket.pause();
        wsconn.__paused = true;
        //DEBUG logger.info('WS message pause true');
        return "";
      } 
      else {
        if (true === wsconn.__paused) {
          wsconn.socket.resume();
          //DEBUG logger.info('WS message pause false');
          return wsconn.__paused = false;
        }
      }
    }
  });
  
  wsconn.on("overflow", function() {
    //DEBUG logger.info('TCP pause');
    return tcpconn.pause();
  });
  
  wsconn.socket.on("drain", function() {
    //DEBUG logger.info('WS message pause false');
    return tcpconn.resume();
  });
  
  wsconn.on("error", function(err) {
    return logger.info('[SYSTEM] --> WS Error: ' + err);
  });
  
  wsconn.on('close', function(reasonCode, description) {
    logger.info("[SYSTEM] --> WS Peer " + wsconn.remoteAddress + " disconnected - Reason: ["+reasonCode+"] " + description);
    return tcpconn.destroy();
  });
  
  
  tcpconn.on("drain", function() {
    wsconn.socket.resume();
    //DEBUG logger.info('WS resume');
    return wsconn.__paused = false;
  });
  
  tcpconn.on("data", function(buffer) {
    //DEBUG
    //logger.info('[SYSTEM] --> TCP data received:\n\n\n' + buffer + "\n\n"); //logger.info(JSON.stringify(buffer));
    return wsconn.sendBytes(buffer);
  });
  
  tcpconn.on("error", function(err) {
    logger.info("[SYSTEM] --> TCP Error " + err);
    return tcpconn.destroy();
  });
  
  tcpconn.on("close", function() {
    //DEBUG
    logger.info("[SYSTEM] --> TCP connection close.");
    //return tcpconn.destroy();
    return wsconn.close();
  });

};

module.exports = bindSockets;