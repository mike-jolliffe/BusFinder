import {key} from "./secret.js";

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
            meters: 100,
            showRoutes: true
        },
        success: function(response) {
            locate_me();
            parseResponse(response, renderMap)

            }
    });
}

function geoError(err) {
  console.warn(`ERROR(${err.code}): ${err.message}`);
}

// Get current location and run app
navigator.geolocation.getCurrentPosition(geoSuccess, geoError);

function locate_me() {
    var locationPoint = new ol.Feature({
        geometry: new ol.geom.Point([lon, lat])
    });
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
}

function parseResponse(data, callback) {
    let coords = [];
    let points = new Array(data.resultSet.location.length - 1);
    for (let i = 0; i <= data.resultSet.location.length - 1; i++) {
        // Apply projection transformation to the geometries
        coords.push(ol.proj.fromLonLat([data.resultSet.location[i].lng,
                data.resultSet.location[i].lat],
            'EPSG:3857'));
        console.log("Coords: " + coords);

        // Create new feature from each lon/lat pair
        points[i] = new ol.Feature({
            'geometry': new ol.geom.Point(
                [coords[i][0], coords[i][1]]),
            'attributes': {
                'stop_id': data.resultSet.location[i].locid,
                'route': data.resultSet.location[i].route,
            },
            'i': i,
            'size': 4
        });
    }
    callback(points)
}

function renderMap(data) {
    var vectorSource = new ol.source.Vector({
        features: data,
        wrapX: false
    });

    var vector = new ol.layer.Vector({
        source: vectorSource,
        style: function (feature) {
            var style = new ol.style.Style({
                text: new ol.style.Text({
                    textAlign: "Start",
                    textBaseline: "Middle",
                    font: 'Normal 12px Arial',
                    text: "TESTING",//${feature.attributes.stop_id}',
                    fill: new ol.style.Fill({
                        color: '#ffa500',
                        stroke: new ol.style.Stroke({
                            color: '#000000',
                            width: 3
                        }),
                        offsetX: -45,
                        offsetY: 0,
                        rotation: 0
                    }),
                }),
                image: new ol.style.Circle({
                    radius: feature.get('size') * Math.pow(map.getView().getZoom(), 1.2) / 10,
                    fill: new ol.style.Fill({color: '#882211'}),
                    stroke: new ol.style.Stroke({color: '#DDDDDD', width: 1})
                })
            });
        return style
        }
    });
    map.addLayer(vector);
}


// Give a list of all of the bus lines that have stops within 100 meters of your current location.
// Link each bus line to an href of its map


// Add buses to map, with your current location, stops within 100 meters, and live tracking