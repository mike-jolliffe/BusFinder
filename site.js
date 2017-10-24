import {key} from "./secret.js";

let bus_vector;
let bus_route = "All Routes";
let routes_vector;
let routeLine_vector;
let lon;
let lat;
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

// AJAX to execute if getting current position is successful
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
        success: function(response) {
            // Add my current location to the map
            locate_me();
            // Parse object and map all bus stops
            parseResponse(response, renderMap);
            // Send another AJAX for actual bus routes bounded by distance from current position
            getBuses();
            }
    });
}

function geoError(err) {
  console.warn(`ERROR(${err.code}): ${err.message}`);
}

// Get current location and run app
navigator.geolocation.getCurrentPosition(geoSuccess, geoError);

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

    console.log(locationPoint.getStyle());
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

function parseResponse(data, callback) {
    let coords = [];
    let points = new Array(data.resultSet.location.length - 1);
    for (let i = 0; i <= data.resultSet.location.length - 1; i++) {
        // Apply projection transformation to the geometries
        coords.push(ol.proj.fromLonLat([data.resultSet.location[i].lng,
                data.resultSet.location[i].lat],
            'EPSG:3857'));

        // Create new feature from each lon/lat pair
        points[i] = new ol.Feature({
            'geometry': new ol.geom.Point(
                [coords[i][0], coords[i][1]]),
            'attributes': {
                'stop_id': data.resultSet.location[i].locid,
                'route': data.resultSet.location[i].route,
            },
            'i': i,
            'size': 8
        });
        let routes = points[i].getProperties().attributes.route;
        for (let i of routes) {
        //     let baseURL = "https://trimet.org/schedules/img/";
        //     let routeURL = function() {
        //         if (String(i.route).length === 1) {
        //             return baseURL + "00" + String(i.route) + ".png"
        //         } else if (String(i.route).length === 2) {
        //             return baseURL + "0" + String(i.route) + ".png"
        //         } else {
        //             return baseURL + String(i.route) + ".png"
        //         }
        //     };
        //     let url = routeURL();
        //     $('#nearby-stops ol').append('<li><a href="' + url + '">' + "Route Number: " + i.route + '</a></li>');
            $('.dropdowncontent select').append('<option value=" ' + i.route + '">' + "Route " + i.route + '</option>')
        }
    }
    callback(points)
}

function getBuses() {
    $.ajax({
        type: "GET",
        url: "https://developer.trimet.org/ws/v2/vehicles",
        data: {
            appID: key,
            bbox: (lon - .1, lat - .1, lon + .1, lat + .1)
        },
        success: function(response) {
            parseBuses(response, mapBuses);
            }
    });
}

function parseBuses(data, callback) {
    let coords = [];
    let points = new Array(data.resultSet.vehicle.length - 1);
    for (let i = 0; i <= data.resultSet.vehicle.length - 1; i++) {
        // Apply projection transformation to the geometries
        coords.push(ol.proj.fromLonLat([data.resultSet.vehicle[i].longitude,
                data.resultSet.vehicle[i].latitude],
            'EPSG:3857'));

        // Create new feature from each lon/lat pair
        points[i] = new ol.Feature({
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
    callback(points)
}

// Load in kml layer of bus routes
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

    console.log(route_num);

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
    console.log("ROUTES");
    console.log(routes_vector);
    //map.addLayer(routes_vector);
    callback(routes_vector);
}

// filter kml of all routes to just selected route number
function getRoute(routes) {
    map.addLayer(routes);
    // let routeX = [];
    // routes.once('change', function () {
    //     routes.getSource().forEachFeature(function (feature) {
    //         if (bus_route == "All Routes") {
    //             routeX.push(feature)
    //         } else if (feature.getProperties().route_number == bus_route) {
    //             routeX.push(feature)
    //         }
    //     });
    // });
    // console.log(routeX);
    // return routeX
}

// Map relevant buses and their routes
function mapBuses(buses) {
    let busX = [];
    if (bus_vector) {
        bus_vector.getSource().clear();
    }

    if (routeLine_vector) {
        routeLine_vector.getSource().clear();
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


    // Create route vector for addition to map
    // let route_line = vectorizeRoutes(getRoute);
    // let routeLine_source = new ol.source.Vector({
    //     features: route_line,
    //     wrapX: false
    //     });
    //
    // routeLine_vector = new ol.layer.Vector({
    //     source: routeLine_source,
    //     style: function (feature) {
    //         var style = new ol.style.Style({
    //                 stroke: new ol.style.Stroke({color: 'black', width: 2})
    //         });
    //     return style
    //     }
    // });
    //

    map.addLayer(bus_vector);

}

// Map the bus stops
function renderMap(data) {
    let vectorSource = new ol.source.Vector({
        features: data,
        wrapX: false
    });

    let vector = new ol.layer.Vector({
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
    map.addLayer(vector);
}

// Filter dropdown for bus routes of interest
$('#drop-btn').click(function() {
    bus_route = $(this).prev().find('select').val();
    bus_route = bus_route.replace(/ /g, '');
    vectorizeRoutes(getRoute);
});

// Update real-time bus locations
vectorizeRoutes(getRoute);
setInterval(getBuses, 4000);