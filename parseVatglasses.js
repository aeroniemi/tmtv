const fs = require("fs")
var excludeControllers = [119]

function parseSectors(sectorFile) {
    var sectors = []
    var sectorsObj = {}
    // console.log(sectorFile)
    var fileSplit = sectorFile.split(`\n`)
    fileSplit.forEach(sector => {
        // console.log(sector)
        if (sector != "" && sector.charAt(0) != ";") {
            var sectorSplitEvenFurther = sector.split(/[|;]/)
            // console.log(details)
            var coords = []
            var isCircle = Boolean(Number(sectorSplitEvenFurther[4]))
            var radius = null
            if (isCircle == false) {
                for (let i = 5; i < sectorSplitEvenFurther.length - 1; i++) {
                    var st = sectorSplitEvenFurther[i].split(`,`)
                    var lat = Number(st[0])
                    var lon = Number(st[1])
                    coords.push([lon, lat])
                    // coords.push({ latitude: lat, longitude: lon })
                }
            } else {
                var st = sectorSplitEvenFurther[5].split(`,`)
                var lat = Number(st[0])
                var lon = Number(st[1])
                coords.push(lon, lat)
                radius = sectorSplitEvenFurther[sectorSplitEvenFurther.length - 2]
            }
            var results = {
                name: sectorSplitEvenFurther[sectorSplitEvenFurther.length - 1],
                sectorId: Number(sectorSplitEvenFurther[0]),
                base: Number(sectorSplitEvenFurther[1]),
                top: Number(sectorSplitEvenFurther[2]),
                isCircle: isCircle,
                coordinates: coords,
                radius: Number(radius)
            }
            if (results.name.includes("Info") == false) {
                sectorsObj[sectorSplitEvenFurther[0]] = results
                sectors.push(results)
            }
        }
    });
    sectors.push(sectors[0])
    var geoJson = {
        type: "FeatureCollection",
        features: [
        ]
    }
    sectors.forEach(sector => {
        if (sector.isCircle == false) {
            var feature = {
                type: "Feature",
                properties: {
                    base: sector.base,
                    id: sector.id,
                    top: sector.top,
                    name: sector.name
                },
                geometry: {
                    type: "Polygon",
                    coordinates: [sector.coordinates]
                },
            }
            geoJson.features.push(feature)
        } else {
            var feature = {
                type: "Feature",
                properties: {
                    base: sector.base,
                    id: sector.id,
                    top: sector.top,
                    name: sector.name,
                    radius: sector.radius
                },
                geometry: {
                    type: "Point",
                    coordinates: sector.coordinates
                },
            }
            geoJson.features.push(feature)
        }
    })
    fs.writeFileSync("./vatglasses/sectors.geojson", JSON.stringify(geoJson), 'utf8')
    fs.writeFileSync("./vatglasses/sectors.json", JSON.stringify(sectors), 'utf8')
    fs.writeFileSync("./vatglasses/sectorsObj.json", JSON.stringify(sectorsObj), 'utf8')
}
function parseControllers(file) {
    var controllers = []
    var fileSplit = file.split(`\n`)
    fileSplit.forEach(sector => {
        if (sector != "" && sector.charAt(0) != ";") {
            var ss = sector.split(/[|;]/)
            var id = Number(ss[0])
            if (excludeControllers.includes(id) == false) {
                var results = {
                    id: id,
                    initial: ss[1],
                    type: ss[2],
                    frequency: ss[3],
                    fir: ss[4],
                    callsign: ss[5],
                    fullIdent: ss[6]
                }
                controllers.push(results)
            }

        }
    });
    fs.writeFileSync("./vatglasses/controllers.json", JSON.stringify(controllers), 'utf8')
}
function parseInheritance(file) {
    var inheritance = []
    var inheritanceObj = {}
    var fileSplit = file.split(`\n`)
    fileSplit.forEach(sector => {
        if (sector != "" && sector.charAt(0) != ";") {
            var ss = sector.split(/[|;]/)
            var units = ss.slice(2, ss.length - 2)
            units = units.reduce((result, unit) => {
                var sub = unit.split(",")
                // console.log(sub)
                if (unit.includes("/") == false) {
                    result.push(Number(sub[0]))
                }

                return result
            }, [])
            var results = {
                id: Number(ss[0]),
                sectors: ss[1].split(",").map(sector => { return Number(sector) }),
                order: units,
                name: ss[ss.length - 2],
                group: ss[ss.length - 1]
            }
            inheritanceObj[results.id] = results
            inheritance.push(results)
        }
    });
    fs.writeFileSync("./vatglasses/inheritance.json", JSON.stringify(inheritance), 'utf8')
    fs.writeFileSync("./vatglasses/inheritanceObj.json", JSON.stringify(inheritanceObj), 'utf8')
}


function importSectors() {
    var controllers = parseControllers(fs.readFileSync("./vatglasses/controllers.txt", 'utf8'))
    var airspace = parseInheritance(fs.readFileSync("./vatglasses/airspace.txt", 'utf8'), controllers)
    var sectors = parseSectors(fs.readFileSync("./vatglasses/sector.txt", 'utf8'))


}
importSectors()