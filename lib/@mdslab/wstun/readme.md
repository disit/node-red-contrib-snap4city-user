# WSTUN - Tunnels and Reverse Tunnels over WebSocket for Node.js

[![npm version](https://badge.fury.io/js/%40mdslab%2Fwstun.svg)](https://badge.fury.io/js/%40mdslab%2Fwstun)

## Overview

A set of Node.js tools to establish TCP tunnels (or TCP reverse tunnels) over WebSocket connections for circumventing the problem of directly connect to hosts behind a strict firewall or without public IP. It also supports WebSocket Secure (wss) connections.

## Installation
```
npm install @mdslab/wstun
```

## Usage (from a Node.js application)

### Instantiation of a tunnel server 
```JavaScript
var wstun = require("@mdslab/wstun");

// without security
server = new wstun.server();

// or with security (<PRIVATE-KEY-PATH> and <PUBLIC-KEY-PATH> are the paths of the private and public keys in .pem formats)
server = new wstun.server({ssl:true, key:"<PRIVATE-KEY-PATH>", cert:"<PUBLIC-KEY-PATH>"});

//start the server (<PORT> is the listening port)
server.start(<PORT>)
```

### Implementation of a tunnel client
```JavaScript
var wstun = require("@mdslab/wstun");

client = new wstun.client();

// without security
wstunHost = 'ws://wstunServerIP:wstunPort';

// or with security 
wstunHost = 'wss://wstunServerIP:wstunPort';

// <localPort> is the port on the localhost on which the tunneled service will be reachable
// <remoteHost>:<remotePort> is the endpoint of the service to be tunneled
client.start(<localPort>, wstunHost, '<remoteHost>:<remotePort>');
```

### Instantiation of a reverse tunnel server
```JavaScript
var wstun = require("@mdslab/wstun");

// without security
reverse_server = new wstun.server_reverse();

// or with security (<PRIVATE-KEY-PATH> and <PUBLIC-KEY-PATH> are the paths of the private and public keys in .pem formats)
reverse_server = new wstun.server_reverse({ssl:true, key:"<PRIVATE-KEY-PATH>", cert:"<PUBLIC-KEY-PATH>"});

//start the server (<PORT> is the listening port)
reverse_server.start(<PORT>);

``` 
### Implementation of a reverse tunnel client
```JavaScript   
var wstun = require("reverse-wstunnel");

reverse_client = new wstun.client_reverse();

// without security
wstunHost = 'ws://wstunServerIP:wstunPort';

// or with security 
wstunHost = 'wss://wstunServerIP:wstunPort';

// <publicPort> is the port on the reverse tunnel server on which the tunneled service will be reachable
// <remoteHost>:<remotePort> is the endpoint of the service to be reverse tunneled
reverse_client.start(<publicPort>, wstunHost, '<remoteHost>:<remotePort>');
```

## Usage (from command line)
A command line tool (wstun.js) is also available in the bin directory.

Examples about how to run a tunnel server:
```
//without security
./wstun.js -s 8080

//with security
./wstun.js -s 8080 --ssl=true --key="<PRIVATE-KEY-PATH>" --cert="<PUBLIC-KEY-PATH>"
```
Examples about how to run a tunnel client:
```
//without security
./wstun.js -t 33:2.2.2.2:33 ws://wstunServerIP:8080 

//with security
./wstun.js -t 33:2.2.2.2:33 wss://wstunServerIP:8080
```
In both examples, connections to localhost:33 on the client will be tunneled to 2.2.2.2:33 through the Websocket connection with the server. Note that the decision about the final destination of the tunnel is up to the client. Alternatively, it is possible to lock the final destination of the tunnel on the server side. 

Examples about how to run a tunnel server locking the final tunnel destination: 
```
//without security 
./wstun.js -s 8080 -t 2.2.2.2:33

//with security
./wstun.js -s 8080 -t 2.2.2.2:33 --ssl=true --key="<PRIVATE-KEY-PATH>" --cert="<PUBLIC-KEY-PATH>"
```
Examples about how to run a tunnel client when the final tunnel destination has been locked by the server:
```
//without security
./wstun.js -t 33 ws://wstunServerIP:8080 

//with security
./wstun.js -t 33 wss://wstunServerIP:8080
```

Examples about how to run a reverse tunnel server:
```
//without security
./wstun.js -r -s 8080

//with security
./wstun.js -r -s 8080 --ssl=true --key="<PRIVATE-KEY-PATH>" --cert="<PUBLIC-KEY-PATH>"
```
Examples about how to run a reverse tunnel client:
```
//without security
./wstun.js -r6666:2.2.2.2:33 ws://server:8080

//with security 
./wstun.js -r6666:2.2.2.2:33 wss://server:8080
```
In the above examples, the client asks the server to open a TCP server on port 6666 and all connections on this port are tunneled to the client that is directely connected to 2.2.2.2:33.


## Logging system
WSTUN uses Log4js library to manage its logs in /var/log/wstun/
