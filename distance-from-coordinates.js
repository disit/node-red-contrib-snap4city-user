/* NODE-RED-CONTRIB-SNAP4CITY-DEVELOPER
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

    function DistanceFromCoordinates(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.on('input', function (msg) {
            var sourcelatitude = (msg.payload.sourcelatitude ? msg.payload.sourcelatitude : config.sourcelatitude);
            var sourcelongitude = (msg.payload.sourcelongitude ? msg.payload.sourcelongitude : config.sourcelongitude);
            var destinationlatitude = (msg.payload.destinationlatitude ? msg.payload.destinationlatitude : config.destinationlatitude);
            var destinationlongitude = (msg.payload.destinationlongitude ? msg.payload.destinationlongitude : config.destinationlongitude);
            var R = 6371; // Radius of the earth in km
            var dLat = deg2rad(destinationlatitude - sourcelatitude); // deg2rad below
            var dLon = deg2rad(destinationlongitude - sourcelongitude);
            var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(deg2rad(sourcelatitude)) * Math.cos(deg2rad(destinationlatitude)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            var d = R * c; // Distance in km
            msg.payload = d * 1000;
            node.send(msg);
        });
    }

    function deg2rad(deg) {
        return deg * (Math.PI / 180)
    }

    RED.nodes.registerType("distance-from-coordinates", DistanceFromCoordinates);
}