# node-red-contrib-snap4city-user

Node-red nodes for developing IoT applications for smart cities and Industry 4.0.
These nodes are targeted to a not developer user.

A description of the available nodes can be found [here](https://www.km4city.org/iot-micro-doc/user.html).

Snap4City Https://www.snap4city.org provides a large library of nodes for smart cities to create flow exploiting:
•	Smart City Entities Search: search and access to city entities and their relationships in the city. The data access should not be based on a simple database query since it would constrain the IOT App Developer to know all the tiny details of the many large storages adopted. To this end, a view based in terms of entities and MicroServices is needed to search and access in terms of city entities, such as: get data about bus, parking, light, POI, events, etc. The search should return information close to a point, along a path, in an area, etc. The resulting data may be one or more services, or paths, etc.
•	Historical Data: search and access to data collected over time into the smart city data aggregator. They could be the IOT data shadow, data collected in traditional PULL based ETL processes, databases of the public administration, etc. In this case, one may request the data on the basis of the identified services from the previous point.
•	Geo Information. This means that the developers may need to solve the so-called geo referencing. For example, passing from GPS coordinate to the Civic Number, from GPS to the close sensor, or from the certain sensor to its GPS coordinates. 
•	Data Analytic. The real need in the context of smart City is to have the possibility for a data-analysts of creating some data analytic processes (may be in R, Python, Java, etc.) and use it into the flow as MicroService without the intervention of a programmer nor administrator.  
•	IOT Device Connection. This means that the developers expect to have the possibility of using nodes for connecting to a large set of IOT devices using different protocols, and thus connecting to different kind of IOT brokers. This feature is quite mature on Node-RED since in the library one can find a large collection of nodes covering tens of protocols. In some cases, the limitations are on security and authentication since in most cases, the username and password, or keys have to be included into the flow in clear.
•	Save and Get Personal Data: that could be time series tracking, click on mobiles Applications, POI, shapes, KPI, etc. For many smart city applications, the possibility of saving and retrieval of personal data enables a large variety of smart scenarios for the final users and operators. 
•	Advanced Dashboards. This means to have the possibility of developing a real user interface of the Node-red IOT App (to render and produce data for the IOT network) and the possibility of adding to the user interface several kinds of graphic widget even accessing directly to the smart city data or IOT devices without disturbing the IOT App such as: External Services, Micro Applications, Tracking, Origin destination tools, traffic flows, maps of any kind, etc. This also means that an IOT App may have connected multiple Dashboards, and a Dashboard may be connected with multiple IOT devices and IOT Apps.
•	IOT Directory. It should be a single point service for searching, managing and discovering all the IOT Devices which can be connected to the infrastructure by means of a large set of heterogenous IOT Brokers. Some of them can be internally managed while others can be managed by third party. The IOT Directory would provide a set of nodes into the flow for abstracting the connection of devices with respect to protocols and brokers. It includes the IOT Discovery that should be am integrated service for searching, managing and discovering all the IOT sensor/actuator independently from IOT Devices and Brokers they are connected. For example, to provide answer at queries such as: give me all temperature sensor close to my house.
•	Other services: such as advanced social media, logging events, connecting SMS, sending email, etc. 

Snap4City collection adds more than 150 nodes covering the above-mentioned needs and much more. For example, for providing: search for busses, access to time table, access to parking status, getting sensors, travel routing, saving and loading trajectories, spatio-temporal search and discovery, data analytic, dashboarding, networking among IOT devices, IOT data abstraction, storage support GDPR compliant, etc. Please visit Https://www.snap4city.org for details.  
