import {key} from "./secret.js";

function geoSuccess(pos) {
    let crd = pos.coords;
    let lon = crd.longitude;
    let lat = crd.latitude;
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
            console.log(response)
        }
    });
}

function geoError(err) {
  console.warn(`ERROR(${err.code}): ${err.message}`);
}

// Get current location and run app
navigator.geolocation.getCurrentPosition(geoSuccess, geoError);

// ajax call to TriMet API

// Parse JSON response

// Give a list of all of the bus lines that have stops within 100 meters of your current location.
// Then provide a link for each bus line to its map


// Add buses to map, with your current location, stops within 100 meters, and live tracking