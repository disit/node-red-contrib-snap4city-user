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
module.exports = function (RED) {

    function WktToGeoJson(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var s4cUtility = require("./snap4city-utility.js");
        const logger = s4cUtility.getLogger(RED, node);
		const WktParser = require('terraformer-wkt-parser');
		// Function to convert WKT to GeoJSON
		function wktToGeoJSONFunc(wkt) {
		  
			// Parse the WKT string to GeoJSON
			geojsontemp = WktParser.parse(wkt);
			return geojsontemp;
		  
		}

        node.on('input', function (msg) {
			var inPayload = msg.payload;
            var wkt = (msg.payload.wkt ? msg.payload.wkt : config.wkt);
            const uid = s4cUtility.retrieveAppID(RED);
            var inPayload = msg.payload;
            
            try {
				geojsonOutput = wktToGeoJSONFunc(wkt);
				
				msg.payload=JSON.parse(JSON.stringify(geojsonOutput));
				node.send(msg); 
			} catch (error) {
				node.error("Invalid WKT string");
		  }			
        });
    }
    RED.nodes.registerType("wkt-to-geojson", WktToGeoJson);
}