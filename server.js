const express = require('express')
const exphbs = require('express-handlebars');
const geo = require('geolib');
const chalk = require("chalk")
const app = express()
const port = 8080
var activities = require('./activities.js')
var config = require('./config.js')
var helpers = {}
helpers.json = function (context) {
    return JSON.stringify(context);
}
var sectorOwner = {}
var ownedSectors = {}
var pilotsArray = []
var pilotsObj = {}
var timer = new Date()
var livePilotsArray = []
var livePilotsObj = {}
async function run() {
    var sectors = await activities.readSectors()
    var controllers = await activities.readControllers()
    var inheritance = await activities.readInheritance()
    // console.log(inheritance)
    var parseResults = await activities.parse()
    pilotsArray = parseResults.body
    pilotsObj = parseResults.bodyObj
    app.use('/static', express.static('static'))
    app.use('/api/sector', express.static('vatglasses'))
    app.engine('handlebars', exphbs({ helpers, extname: '.hbs' }));
    app.set('view engine', 'handlebars');
    app.get('/', function (req, res) {
        res.send('Hello World!')
    })

    app.listen(port, () => {
        console.log(`Open for buisness at http://localhost:${port}`)
    })
    function createError(status, message) {
        var err = new Error(message);
        err.status = status;
        return err;
    }

    app.get('/aircraft/:id', function (req, res, next) {
        var id = req.params.id
        var apiUrl = `/aircraft/${req.params.id}`
        res.render("aircraftById", { apiUrl: apiUrl })
    });
    app.get('/map/all', function (req, res, next) {
        console.log(timer)
        res.render("generic", { apiUrl: "/aircraft/", mapboxToken: config.mapboxToken })
    });
    app.get('/map/sector/:id', function (req, res, next) {
        res.render("generic", { apiUrl: `/sector/${req.params.id}`, mapboxToken: config.mapboxToken })
    });
    app.get('/map/frequency/:id', function (req, res, next) {
        res.render("generic", { apiUrl: `/frequency/${req.params.id}`, mapboxToken: config.mapboxToken })
    });
    app.get('/map/sector/', function (req, res, next) {
        res.render("generic", { apiUrl: `/sector/sectors.geojson`, mapboxToken: config.mapboxToken, additionalFunctions: "requestJson('/api/sector/sectors.geojson', addSectors)" })
        // res.render("generic", { apiUrl: `/sector/sectors.geojson`, mapboxToken: config.mapboxToken, additionalFunctions: "requestJson('/api/sector/sectors.geojson', addSectors)" })
    });
    app.get('/map/all/heat', function (req, res, next) {
        res.render("heat", { apiUrl: "/aircraft/heat" })
    });
    app.get('/api/aircraft', function (req, res, next) {
        var id = req.params.id
        // console.log(parseResults, id, parseResults[id])
        var planes = {
            type: "FeatureCollection",
            features: []
        }

        pilotsArray.forEach((flight) => {
            planes.features.push(activities.convertFlightToGeoJson(flight))
        })
        res.send(planes)

    });
    app.get('/api/aircraft/heat', function (req, res, next) {
        var id = req.params.id
        // console.log(parseResults, id, parseResults[id])
        var planes = []
        pilotsArray.forEach((flight) => {
            flight.log.forEach((point) => {
                planes.push([point.latitude, point.longitude, 0.5])
            })
        })
        res.send(planes)

    });
    app.get('/api/aircraft/:id', function (req, res, next) {
        var id = req.params.id
        // console.log(parseResults, id, parseResults[id])
        if (id in pilotsObj) {
            var pilot = pilotsObj[id]
            var route = activities.convertLogToGeoJson(pilot.log, true)
            res.send(route)
        } else {
            res.send(`Aircraft with id ${id} not found.`)
            // createError(404, `Aircraft with id ${id} not found.`)
        }
        // console.log(results.bodyTable, "hi")
    });
    app.get('/api/user/:cid', function (req, res, next) {
        var planes = {
            type: "FeatureCollection",
            features: []
        }
        pilotsArray.forEach((flight) => {
            if (flight.cid == req.params.cid) {
                planes.features.push(activities.convertLogToGeoJson(flight.log))
            }
        })
        res.send(planes)

    });
    app.get('/api/airport/:icao', function (req, res, next) {
        var planes = {
            type: "FeatureCollection",
            features: []
        }
        pilotsArray.forEach((flight) => {
            if (flight.departure == req.params.icao) {
                var plane = activities.convertLogToGeoJson(flight.log)
                // plane.properties.departure
                planes.features.push(activities.convertLogToGeoJson(flight.log))
            } else if (flight.destination == req.params.icao) {
                planes.features.push(activities.convertLogToGeoJson(flight.log))
            }
        })
        res.send(planes)

    });
    app.get('/api/sector/:id', function (req, res, next) {
        var sector = sectors[req.params.id]
        if (typeof sector === undefined) {
            res.send("error")
        }
        if (sector.top == 0) {
            sector.top = 100000
        }
        // console.log(sector)
        var planesInSector = []
        var geoJson = {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: "Polygon",
                        coordinates: [sector.coordinates]
                    },
                }
            ]
        }
        pilotsArray.forEach((flight) => {
            var timeInSector = []
            flight.log.some((point) => {
                if (point.altitude > sector.base && point.altitude < sector.top) {
                    var isInSectorHoriz = geo.isPointInPolygon({ latitude: point.latitude, longitude: point.longitude }, sector.coordinates);
                    if (isInSectorHoriz === true) {
                        console.log(`${flight.callsign} is in sector ${sector.name}`)
                        planesInSector.push({ flight })
                        geoJson.features.push(activities.convertFlightToGeoJson(flight))
                        return
                    }
                }
            })

        })
        res.send(geoJson)

    });
    app.get('/api/frequency/:id', function (req, res, next) {
        var controllerId = null
        controllers.some((controller, index) => {
            if (controller.frequency == req.params.id) {
                controllerId = controller.id
                return
            }
        })

        if (controllerId != null) {
            manageSectorOwnership([controllerId])
            // console.log(ownedSectors)
            var sec = checkOwnedSectors(controllerId)
            var atco = getControllerInfo(controllerId)
            atco.sectors = sec
            var geoJson = {
                type: "FeatureCollection",
                features: [
                ]
            }
            geoJson.features = sec.map(sector => {
                return geoJsonSector(sector)
            })
            res.send(geoJson)
        } else {
            res.send(`Controller with frequency ${req.params.id} not found.`)
        }
    });
    function checkOwnedSectors(id) {
        return ownedSectors[id]
    }
    function getControllerInfo(id) {
        console.log(chalk.red("hi"), ownedSectors)
        return controllers[id]
    }
    function geoJsonSector(sector) {
        var sectorDetails = sectors[sector]
        var geoJson = {
            type: "Feature",
            properties: {
                base: sectorDetails.base,
                top: sectorDetails.top,
                name: sectorDetails.name
            },
            geometry: {
                type: "Polygon",
                coordinates: [sectorDetails.coordinates]
            },
        }
        return geoJson
    }
    function manageSectorOwnership(onlineFacilities) {
        // for (var member in ownedSectors) ownedSectors[member] = [];
        for (var member in sectorOwner) sectorOwner[member] = null;
        onlineFacilities.forEach(fac => {
            ownedSectors[fac] = []
        })
        inheritance.forEach(unit => {
            console.log(unit.id)
            if (unit.order.length > 0) {
                unit.order.some(pos => {
                    // console.log(onlineFacilities, pos)
                    if (onlineFacilities.includes(pos)) {
                        unit.sectors.forEach(sector => {
                            sectorOwner[sector] = pos
                        })
                        if (ownedSectors[pos] === undefined) {
                            ownedSectors[pos] = unit.sectors
                            return true
                        }
                        console.log(`${pos} owns unit ${unit.id}`)
                        ownedSectors[pos].push(...unit.sectors)
                        return true

                    }
                })
            } else {
                unit.sectors.forEach(sector => {
                    sectorOwner[sector] = null
                })
            }
        })
        // console.log(sectorOwner)
        // console.log(ownedSectors[125])
    }
}
run()

function watch(maxAge, verbose) {
    setInterval(() => activities.getNewest().then(
        function (newest) {
            let lastUpdated = new Date(newest * 1000);
            let age = Date.now() - lastUpdated
            if (age > maxAge) {
                if (verbose) console.info(`Local datafeed was last updated ${Math.round(age / (1000 * 60))} minutes ago, downloading a new version`)
                activities.downloadLatestData()
                    .catch((e) => {
                        console.log(chalk.bgRed(e))
                        return
                    })
                    .then((data) => {

                    })
            } else {
                if (verbose) console.info(`Local datafeed was last updated ${Math.round(age / (1000))} seconds ago - no need for a new one`)
            }
        },
        function (error) { console.log(error) }
    ), maxAge)
}
watch(60000, false)