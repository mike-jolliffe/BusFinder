// API key for accessing TriMet data
import {key} from "./secret.js";

// All bus stop point features
let all_points;
// Selected subset of bus stop point features
let subset_points;
// vector layer of all bus stops
let stops_vector;
// vector layer of all buses
let bus_vector;
// placeholder for selected bus route
let bus_route = "All Routes";
// vector layer for selected route
let routes_vector;
// object storing arrival times by bus stop
let arrivalsObj;
// current longitude
let lon;
// current latitude
let lat;

// declare map object
let map = new ol.Map({
    layers: [
        new ol.layer.Tile({source: new ol.source.OSM()}),
    ],
    target: 'map',
    view: new ol.View({
        center: ol.proj.fromLonLat([-122.7, 45.5]),
        zoom: 14
    })
});

// Get data for nearby bus stops
function geoSuccess(pos) {
    let crd = pos.coords;
    lon = crd.longitude;
    lat = crd.latitude;
    let position = lon + "," + lat;

    $.ajax({
        type: "GET",
        url: "https://developer.trimet.org/ws/V1/stops",
        data: {
            appID: key,
            json: true,
            ll: position,
            meters: 500,
            showRoutes: true
        },
        success: function (response) {
            // Add my current location to the map
            locate_me();
            // Parse object and map all bus stops
            parseResponse(response, renderMap);
            // Send another AJAX for actual bus routes bounded by distance from current position
            getBuses();
        }
    });
}

// if getting current location fails
function geoError(err) {
    console.warn(`ERROR(${err.code}): ${err.message}`);
}

// Get current location and run app
navigator.geolocation.getCurrentPosition(geoSuccess, geoError);

// Map current location of user
function locate_me() {
    let pointStyle = new ol.style.Style({
        image: new ol.style.Circle({
            radius: 5,
            fill: new ol.style.Fill({
                color: '#ffa500'
            }),
            stroke: new ol.style.Stroke({
                color: '#000000',
                width: 3
            })
        }),
        text: new ol.style.Text({
            text: "Current\nLocation\n",
            textBaseline: "bottom"
        })
    });

    let locationPoint = new ol.Feature({
        geometry: new ol.geom.Point([lon, lat]),
    });

    locationPoint.setStyle(pointStyle);

    locationPoint.getGeometry().transform('EPSG:4326', 'EPSG:3857');

    // A vector layer to hold the location point
    var locationLayer = new ol.layer.Vector({
        source: new ol.source.Vector({
            features: [
                locationPoint
            ]
        })
    });
    map.addLayer(locationLayer);
    map.setView(new ol.View({
        center: ol.proj.fromLonLat([lon, lat]),
        zoom: 17
    }));
}

// Create bus stop layer
function parseResponse(data, callback) {
    let coords = [];
    all_points = new Array(data.resultSet.location.length - 1);
    for (let i = 0; i <= data.resultSet.location.length - 1; i++) {
        // Apply projection transformation to the geometries
        coords.push(ol.proj.fromLonLat([data.resultSet.location[i].lng,
                data.resultSet.location[i].lat],
            'EPSG:3857'));

        // Create new feature from each lon/lat pair
        all_points[i] = new ol.Feature({
            'geometry': new ol.geom.Point(
                [coords[i][0], coords[i][1]]),
            'attributes': {
                'stop_id': data.resultSet.location[i].locid,
                'route': data.resultSet.location[i].route,
            },
            'i': i,
            'size': 8
        });
        let routes = all_points[i].getProperties().attributes.route;

        for (let i of routes) {
            var exists = false;
            $('.dropdowncontent select option').each(function () {
                if (this.value == i.route) {
                    exists = true;
                }
            });

            if (exists == false) {
                $('.dropdowncontent select').append('<option value=" ' + i.route + '">' + "Route " + i.route + '</option>')
            }
        }
    }
    callback(all_points)
}

// Create list of stops to pass into API
function stringifyStops() {
    let stopString = [];
    for (let point of subset_points) {
        stopString.push(parseInt(point.getProperties().attributes.stop_id))
    }
    return stopString
    }

// Get bus data
function getBuses() {
    $.ajax({
        type: "GET",
        url: "https://developer.trimet.org/ws/v2/vehicles",
        data: {
            appID: key,
            bbox: (lon - .1, lat - .1, lon + .1, lat + .1)
        },
        success: function (response) {
            parseBuses(response, mapBuses);
        }
    });

    //Get arrival times for limited subset of routes selected by user
    if (!(bus_route == "All Routes")) {
        $.ajax({
            type: "GET",
            url: "https://developer.trimet.org/ws/V1/arrivals",
            data: {
                appID: key,
                locIDs: stringifyStops,
                json: "true",
            },
            success: function(response) {
                parseStops(response, validStops);
            }
        })
    }
}

// Create buses layer
function parseBuses(data, callback) {
    let coords = [];
    let busPoints = new Array(data.resultSet.vehicle.length - 1);
    for (let i = 0; i <= data.resultSet.vehicle.length - 1; i++) {
        // Apply projection transformation to the geometries
        coords.push(ol.proj.fromLonLat([data.resultSet.vehicle[i].longitude,
                data.resultSet.vehicle[i].latitude],
            'EPSG:3857'));

        // Create new feature from each lon/lat pair
        busPoints[i] = new ol.Feature({
            'geometry': new ol.geom.Point(
                [coords[i][0], coords[i][1]]),
            'attributes': {
                'type': data.resultSet.vehicle[i].type,
                'route': data.resultSet.vehicle[i].routeNumber,
            },
            'i': i,
            'size': 5
        });
    }
    callback(busPoints)
}

// Get bus arrival times by stop
function parseStops(data, callback) {
    arrivalsObj = {};
    for (let bus of data.resultSet.arrival) {
        let arrival_time = new Date(bus.estimated);
        let full_minutes = function(){
            if (arrival_time.getMinutes() < 10) {
                return "0" + arrival_time.getMinutes()
            } else {
                return arrival_time.getMinutes()
            }
        };
        let time = arrival_time.getHours() - 12 + ":" + full_minutes();
        //console.log("StopID: " + bus.locid + ", " + "Arrival Time: " + time);
        arrivalsObj[String(bus.locid)] = time
    }
    callback()
}

// Create bus routes layer
function vectorizeRoutes(callback) {
    if (routes_vector) {
        map.removeLayer(routes_vector);
    }

    let route_num;

    if (bus_route.length === 1) {
        route_num = "route00" + bus_route + ".kml"
    } else if (String(bus_route).length === 2) {
        route_num = "route0" + bus_route + ".kml"
    } else if (String(bus_route).length === 3) {
        route_num = "route" + String(bus_route) + ".kml"
    } else {
        route_num = 'routes.kml'
    }

    routes_vector = new ol.layer.Vector({
        source: new ol.source.Vector({
            url: 'split_routes/' + route_num,
            format: new ol.format.KML({
                extractStyles: false,
                extractAttributes: true
            })
        }),
        style: [
            new ol.style.Style({
                stroke: new ol.style.Stroke({color: 'black', width: 2})
            })
        ]

    });

    callback(routes_vector);
}

// Add route layer to map
function getRoute(routes) {
    map.addLayer(routes);
}

// Add bus layer to map
function mapBuses(buses) {
    let busX = [];
    if (bus_vector) {
        bus_vector.getSource().clear();
    }

    for (let bus of buses) {
        if (bus_route == "All Routes") {
            busX.push(bus)
        } else if (bus.getProperties().attributes.route == bus_route) {
            busX.push(bus)
        }
    }

    let bus_vectorSource = new ol.source.Vector({
        features: busX,
        wrapX: false
    });

    bus_vector = new ol.layer.Vector({
        source: bus_vectorSource,
        style: function (feature) {
            var style = new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 10 * Math.pow(map.getView().getZoom(), 1.2) / 10,
                    fill: new ol.style.Fill({color: '#007700'}),
                    stroke: new ol.style.Stroke({color: '#DDDDDD', width: 1})
                }),
                text: new ol.style.Text({
                    text: String(feature.getProperties().attributes.route),
                    fill: new ol.style.Fill({color: '#DDDDDD'}),
                }),
            });
            return style
        }
    });

    map.addLayer(bus_vector);
}

// Update map with stops on selected route
function validStops() {
    let stopsSubset = [];
    if (!(bus_route == "All Routes")) {
        map.removeLayer(stops_vector)
    }

    for (let stop of all_points) {
        if (stop.getProperties().attributes.route[0].route == bus_route) {
            stopsSubset.push(stop)
        }
    }
    subset_points = stopsSubset;

    let stopsSource = new ol.source.Vector({
        features: stopsSubset,
        wrapX: false
    });

    stops_vector = new ol.layer.Vector({
        source: stopsSource,
        style: function (feature) {
            var style = new ol.style.Style({
                image: new ol.style.Circle({
                    radius: feature.get('size') * Math.pow(map.getView().getZoom(), 1.2) / 10,
                    fill: new ol.style.Fill({color: '#882211'}),
                    stroke: new ol.style.Stroke({color: '#DDDDDD', width: 1})
                }),
                text: new ol.style.Text({
                    text: arrivalsObj[feature.getProperties().attributes.stop_id] || feature.getProperties().attributes.stop_id,
                    fill: new ol.style.Fill({color: '#DDDDDD'}),
                }),
            });
            return style
        }
    });
    stops_vector.setZIndex(1);
    map.addLayer(stops_vector);
}

// Map all nearby bus stops initially
function renderMap(data) {
    let vectorSource = new ol.source.Vector({
        features: data,
        wrapX: false
    });

    stops_vector = new ol.layer.Vector({
        source: vectorSource,
        style: function (feature) {
            var style = new ol.style.Style({
                image: new ol.style.Circle({
                    radius: feature.get('size') * Math.pow(map.getView().getZoom(), 1.2) / 10,
                    fill: new ol.style.Fill({color: '#882211'}),
                    stroke: new ol.style.Stroke({color: '#DDDDDD', width: 1})
                }),
                text: new ol.style.Text({
                    text: String(feature.getProperties().attributes.stop_id),
                    fill: new ol.style.Fill({color: '#DDDDDD'}),
                }),
            });
            return style
        }
    });
    stops_vector.setZIndex(1);
    map.addLayer(stops_vector);
}

// Filter dropdown for bus routes of interest
$('#drop-btn').click(function () {
    bus_route = $(this).prev().find('select').val();
    if (bus_route == "All Routes") {
        map.removeLayer(stops_vector);
        renderMap(all_points)
    } else {
        bus_route = bus_route.replace(/ /g, '');
        validStops();
    }
    vectorizeRoutes(getRoute);
});


// Update real-time bus locations
vectorizeRoutes(getRoute);
setInterval(getBuses, 4000);