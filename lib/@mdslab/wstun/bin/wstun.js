#!/usr/bin/env node

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


log4js = require('log4js');

try{
    log4js.loadAppender('file');
    logfile = '/var/log/wstun/wstun.log';
    loglevel = 'debug';
    log4js.addAppender(log4js.appenders.file(logfile));
}
catch (err) {
    console.log("error log folder creation")
}

var logger = log4js.getLogger('main');
logger.setLevel(loglevel);

var portTunnel , argv, client, host, localport, optimist, port, server, wsHost, wst, _, _ref, _ref1;

var _ = require("under_score");

optimist = require('optimist').usage("Tunnels and reverse tunnels over WebSocket.\n" +
    "\nUsage: https://github.com/MDSLab/wstun/blob/master/readme.md")
    .string("s").alias('s', "server").describe('s', 'run as server, specify listening port')
    .string("t").alias('t', "tunnel").describe('t', 'run as tunnel client, specify localport:host:port')
    .boolean("r").alias('r', "reverse").describe('r', 'run in reverse tunneling mode')
    .string("ssl").describe('ssl', '\"true\" | \"false\" to enable|disable HTTPS communication.')
    .string("key").describe('key', '[only with --ssl="true"] path to private key certificate.')
    .string("cert").describe('cert', '[only with --ssl="true"] path to public key certificate.');

argv = optimist.argv;

wst = require("../lib/wrapper");

if (argv.s && !argv.r) {
  
    // WS tunnel server side
    if (argv.t) {
        _ref = argv.t.split(":"), host = _ref[0], port = _ref[1];
        server_opts = {dstHost:dstHost, dstPort:dstPort, ssl:https_flag, key:key, cert:cert};
    }
    else {
        server_opts = {ssl:argv.ssl, key:argv.key, cert:argv.cert};
    }

    server = new wst.server(server_opts);
    server.start(argv.s);

}else if (argv.t) {

  // WS tunnel client side

  client = new wst.client;

  wsHost = _.last(argv._);
  _ref1 = argv.t.split(":"), localport = _ref1[0], host = _ref1[1], port = _ref1[2];

  if (host && port) {
    client.start(localport, wsHost, "" + host + ":" + port);
  } else {
    client.start(localport, wsHost);
  }


}else if (argv.r) {

  // WS reverse tunnel

  if (argv.s){

    // Server side
    server_opts = {ssl:argv.ssl, key:argv.key, cert:argv.cert};
    server = new wst.server_reverse(server_opts);
    server.start(argv.s);

  }
  else{

    // Client side
    client = new wst.client_reverse;
    wsHost = _.last(argv._);
    _ref1 = argv.r.split(":"), portTunnel = _ref1[0], host = _ref1[1], port =_ref1[2];
    client.start(portTunnel, wsHost, "" + host + ":" + port);

  }

} else {

  // Wrong options
  return console.log(optimist.help());

}