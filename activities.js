const https = require('https');
const fs = require('fs');
const chalk = require('chalk')
var randomColor = require('randomcolor')
const apiUrl = "https://data.vatsim.net/v3/vatsim-data.json";

// -----------------------------------------------------------------------------
// Download related
// -----------------------------------------------------------------------------
function downloadLatestData() {
    return new Promise(function (resolve, reject) {
        https.get(apiUrl, function (res) {
            var body = '';
            res.on('data', function (chunk) {
                body += chunk;
            });
            res.on('end', function () {
                try {
                    var data = JSON.parse(body);

                } catch (e) {
                    reject(e)
                    return
                }
                try {
                    var date = Math.trunc(new Date(data.general.update_timestamp).getTime() / 1000);

                } catch (e) {
                    reject(e)
                    return
                }

                var fileName = date + ".json";
                fs.mkdir('./temp/', { recursive: true }, (err) => { if (err) throw err });
                try {


                    fs.writeFile("./temp/" + fileName, JSON.stringify(data), "utf8", function (err) {
                        if (err) {
                            console.error(err);
                            reject(err);
                        };
                        resolve(fileName);
                    });
                } catch (e) {
                    reject(e)
                    return
                }

            });
        }).on('error', function (e) {
            console.error("Got an error: ", e);
            reject(e);
        });
    });
};
function getNewest() {
    return new Promise(function (resolve, reject) {
        var newest = 0;
        fs.readdir("./temp/", (err, files) => {
            // if (err) reject(err);
            if (files === undefined || files.length == 0) {
                resolve(1)
                return
            }
            newest = Math.max(...files.map(function (file) {
                return parseInt(file.substring(0, file.length - 5));
            }));
            resolve(newest);
            return
        });
    });
};
exports.downloadLatestData = downloadLatestData
exports.getNewest = getNewest
// -----------------------------------------------------------------------------
// Parse-related
// -----------------------------------------------------------------------------
const ID_RESUME_FLIGHT = 2
const ID_NEW_FLIGHT = 1
const ID_ALREADY_ASSIGNED = 0
const verbose = false
function report(text) {
    if (verbose) console.log(text)
}
function returnUniqueCid(table, cid, startTime, groundspeed) {
    var newCid = cid
    while (true) {
        if (newCid in table) {
            if (table[newCid].logon_time == startTime) {
                return [newCid, ID_ALREADY_ASSIGNED]
            } else if (groundspeed > 50) { // assumed to just be dropped data in the middle, fill out as normal
                report(`Pilot is mid flight - resuming their last flight (last id: ${newCid})`)
                return [newCid, ID_RESUME_FLIGHT]
            } else {
                if (newCid == cid) {
                    newCid = cid * 10
                } else {
                    newCid += 1
                }

            }
        } else {

            var timeSinceStart = (new Date() - new Date(startTime)) / 1000
            report(`Assigned new id to ${cid}: ${newCid}. Flight started ${timeSinceStart} seconds ago`)
            return [newCid, ID_NEW_FLIGHT]
        }
    }
}
function validReadings(oldest, newest) {
    return new Promise(function (resolve, reject) {
        var output = []
        var oldestUnix = Math.trunc(oldest.getTime() / 1000);
        var newestUnix = Math.trunc(newest.getTime() / 1000);
        fs.readdir("./temp/", (err, files) => {
            if (err) throw err;
            if (files === undefined || files.length == 0) {
                reject("no valid files")
            }
            var images = files.map(function (file) {
                return parseInt(file.substring(0, file.length - 5));
            })
            images.forEach((image) => {
                if (image > oldestUnix && image < newestUnix) {
                    output.push(image)
                }
            })
            resolve(output)
        })
    })
}

function assembleUsefulSubTable(image) {
    return new Promise(function (resolve, reject) {
        var name = image + ".json"
        fs.readFile("./temp/" + name, (err, body) => {
            if (err) reject(err)
            var results = JSON.parse(body)
            resolve(results)
        })
    })
}

function managePilot(pilot) {
    return new Promise(function (resolve, reject) {
        var currentLog = {
            timestamp: pilot.last_updated,
            latitude: pilot.latitude,
            longitude: pilot.longitude,
            altitude: pilot.altitude,
            groundspeed: pilot.groundspeed,
            heading: pilot.heading,
            qnh_mb: pilot.qnh_mb
        }
        var outputPilot = {
            cid: pilot.cid,
            name: pilot.name,
            callsign: pilot.callsign,
            logon_time: pilot.logon_time,
            log: [currentLog]
        }
        resolve(outputPilot)
    })
}
function managePilots(data) {
    return new Promise(function (resolve, reject) {
        var promises = data.pilots.map(function (ele) {
            return managePilot(ele)
        })
        Promise.all(promises).then((results) => {
            resolve(results)
        })
    })
}

function mergeIdentities(table) {
    return new Promise(function (resolve, reject) {

        var promises = table.map(function (ele) {
            return managePilots(ele)
        })
        Promise.all(promises).then((results) => {
            var final = {}
            results.forEach((result) => {
                result.forEach((pilot) => {
                    if (final[pilot.cid]) {
                        if (final[pilot.cid].logon_time != pilot.logon_time) {
                            var [newCid, status] = returnUniqueCid(final, pilot.cid, pilot.logon_time, pilot.log[0].groundspeed)
                            if (status == ID_ALREADY_ASSIGNED) {
                                final[newCid].log.push(pilot.log[0])
                            } else if (status == ID_NEW_FLIGHT) {
                                pilot.initial_logon_time = pilot.logon_time
                                final[newCid] = pilot
                            } else if (status == ID_RESUME_FLIGHT) {
                                // if (pilot.callsign == "THY2323") console.log(pilot.callsign, newCid, pilot.logon_time)
                                final[newCid].logon_time = pilot.logon_time
                                final[newCid].log.push(pilot.log[0])

                            }
                        } else {
                            final[pilot.cid].log.push(pilot.log[0])
                        }

                    } else {
                        pilot.initial_logon_time = pilot.logon_time
                        final[pilot.cid] = pilot
                    }
                })
            })
            resolve(final)
        })
    })
}
function assembleUsefulTable(subset) {
    return new Promise(function (resolve, reject) {
        var res = subset.map(function (ele) {
            return assembleUsefulSubTable(ele)
        })
        Promise.all(res).then((results) =>
            resolve(results)
        )

    })
}
exports.assembleUsefulTable = assembleUsefulTable
exports.mergeIdentities = mergeIdentities
exports.validReadings = validReadings

parseResults = {
    lastUpdated: new Date("01-01-1970"),
    body: [],
    bodyTable: {}
}
function parse() {
    return new Promise(function (acc, reject) {
        if ((new Date() - parseResults.lastUpdated) < 60 * 1000) {
            console.log("new enough")
            acc(parseResults.body)
        }
        console.log("we're here")
        validReadings(new Date("2020-01-14 19:42:00"), new Date())
            .then((subset) => assembleUsefulTable(subset))
            .then((table) => mergeIdentities(table))
            .then((res) => {
                var array = Object.values(res)
                console.log(`Summary Statistics:
        Flights managed: ${array.length}`
                )
                parseResults = {
                    lastUpdated: new Date(),
                    body: array,
                    bodyObj: res
                }
                console.log("accepted the promise")
                acc(parseResults)
            })
    })
}
exports.parse = parse
function convertLogToGeoJson(log, full, colour) {
    var coords = []
    log.forEach((position) => {
        coords.push([position.longitude, position.latitude])
    })
    var style = { "stroke-width": 0.5 }
    style.color = colour || randomColor()
    // console.log(colour)
    if (full === true) {
        var geo = {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: "LineString",
                        coordinates: coords
                    },
                    style: style
                }
            ]
        }
        return geo
    } else {
        var geo = {
            type: "Feature",
            properties: {},
            geometry: {
                type: "LineString",
                coordinates: coords
            },
            style: style
        }
        return geo
    }
    return
}
exports.convertLogToGeoJson = convertLogToGeoJson