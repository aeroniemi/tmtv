const config = require("./config");
const activities = require("./activities.js")
const turf = require("@turf/turf")
const chalk = require("chalk")
var latestPilots = {}
var latestPilotsArray = []
var sectors = null
var controllers = null
var inheritance = null
var sectorOwner = {}
var ownedSectors = {}
var latestSectorGeo = []
var onlineFacilitiesG = []
async function handleLiveData() {
    let newest = await activities.getNewest()
    let lastUpdated = new Date(newest * 1000);
    let age = Date.now() - lastUpdated
    // console.log(newest)
    if (age > config.maxDatafeedAge) {
        // if (verbose) console.info(`Local datafeed was last updated ${Math.round(age / (1000 * 60))} minutes ago, downloading a new version`)
        var data = await activities.downloadLatestData()
            .catch((e) => {
                console.log(chalk.bgRed(e))
                return
            })
    } else {
        // if (verbose) console.info(`Local datafeed was last updated ${Math.round(age / (1000))} seconds ago - no need for a new one`)
        console.log("no need to do anything")
        return
    }
    // var usefulTable = await activities.assembleUsefulTable(data.pilots)
    var identities = await activities.mergeIdentities([data])
    latestPilots = identities
    latestPilotsArray = Object.values(identities)
    var controllerPromises = data.controllers.map((fac) => {
        return findControllerIds(fac)
    })
    Promise.all(controllerPromises)
        .then((facilities) => {
            var onlineFacilities = facilities.filter(function (el) {
                return el != null;
            });
            onlineFacilitiesG = onlineFacilities
            manageSectorOwnership(onlineFacilities).then((res) => {
                assemblePartTwo().then(() => { return })
            })
        })
}
function regular() {
    setInterval(() => {
        handleLiveData().then(() => {
            return
        })
    }, config.datafeedDownloadInterval)
}
function getLatestPilots() {
    return latestPilots
}
function getLatestPilotsArray() {
    return latestPilotsArray
}
function getSectors() {
    return sectors
}
function getControllers(id) {
    if (id != undefined) {
        return controllers[id]
    }
    return controllers
}
function getInheritance() {
    return inheritance
}
function getOwnedSectors() {
    return ownedSectors
}
function getSectorOwner() {
    return sectorOwner
}
function getLiveGeo() {
    return latestSectorGeo
}
function getOnlineFacilities() {
    return onlineFacilitiesG
}
setup()
handleLiveData()
regular()
exports.getLatestPilots = getLatestPilots
exports.getLatestPilotsArray = getLatestPilotsArray
exports.getSectors = getSectors
exports.getControllers = getControllers
exports.getInheritance = getInheritance
exports.getOwnedSectors = getOwnedSectors
exports.getSectorOwner = getSectorOwner
exports.getLiveGeo = getLiveGeo
exports.getOnlineFacilities = getOnlineFacilities
function findControllerIds(fac) {
    return new Promise(function (resolve, reject) {
        var cs = fac.callsign
        var type = cs.substring(cs.length - 3, cs.length)
        if (cs.match(/_M_/) || fac.frequency == "199.998") {
            // console.log(fac)
            resolve()
        }
        if (type == "CTR" && cs.match(/^(LON|SCO|LTC|MAN|STC)_/)) {
            controllers.some((controller) => {
                if (controller.frequency == fac.frequency) {
                    // console.log(`Unit ${controller.id} is online`)
                    resolve(controller.id)
                }
            })
        } else if ((cs.match(/^(EG)/) && fac.facility > 0) || (cs.match(/^(SOLENT|ESSEX)/))) {
            controllers.some((controller) => {
                if (controller.frequency == fac.frequency) {
                    // console.log(`Unit ${controller.id} is online`)
                    resolve(controller.id)
                }
            })
            // console.log(fac)
        }
        resolve()
    })
}
async function setup() {
    sectors = await activities.readSectors()
    controllers = await activities.readControllers()
    inheritance = await activities.readInheritance()
}
exports.setup = setup
function manageSectorOwnership(onlineFacilities) {
    return new Promise(function (resolve, reject) {
        for (var member in sectorOwner) sectorOwner[member] = null;
        onlineFacilities.forEach(fac => {
            ownedSectors[fac] = []
        })
        inheritance.forEach(unit => {
            if (unit.order.length > 0) {
                unit.order.some(pos => {
                    if (onlineFacilities.includes(pos)) {
                        unit.sectors.forEach(sector => {
                            sectorOwner[sector] = pos
                        })
                        if (ownedSectors[pos] === undefined) {
                            ownedSectors[pos] = unit.sectors
                            return true
                        }
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
        resolve(ownedSectors)
    })
}

async function assemblePartTwo() {
    var latestSectorGeo2 = []
    for (key in ownedSectors) {
        var subGeo = []
        var subGeoCirc = []
        ownedSectors[key].forEach((sec) => {
            var geo = sectors[sec].geoJson
            // console.log(geo.geometry["type"])
            geo.properties.owner = key
            if (geo === undefined) {
                throw new Error(geo)
            }
            if (geo.geometry.type != "Polygon") {
                subGeoCirc.push(geo)
            } else {
                // console.log("pushing")
                // console.log(geo)
                subGeo.push(geo)
            }
        })
        if (subGeo.length > 0) {
            var resultantFeature = subGeo[0]
            if (subGeo.length > 1) {
                subGeo.forEach((sector, i) => {
                    if (i > 0) {
                        resultantFeature = turf.union(sector, resultantFeature)
                    }
                })
            }
            resultantFeature.properties.owner = key

            var center = turf.getCoord(turf.centerOfMass(resultantFeature))
            // console.log(center)
            resultantFeature.properties.center = center
            // resultantFeature.properties.center = turf.getCoord(turf.centroid(resultantFeature))
            // console.log(chalk.bgCyan("THis is is:"))
            // console.log(resultantFeature)
            latestSectorGeo2.push(resultantFeature)
            // latestSectorGeo2.push(result)
            latestSectorGeo2.push(...subGeoCirc)
        }
    }

    latestSectorGeo = latestSectorGeo2
}