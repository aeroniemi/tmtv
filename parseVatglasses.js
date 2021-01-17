const fs = require("fs")


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
            for (let i = 5; i < sectorSplitEvenFurther.length - 1; i++) {
                var st = sectorSplitEvenFurther[i].split(`,`)
                var lat = Number(st[0])
                var lon = Number(st[1])
                coords.push([lon, lat])
                // coords.push({ latitude: lat, longitude: lon })
            }
            var results = {
                name: sectorSplitEvenFurther[sectorSplitEvenFurther.length - 1],
                sectorId: sectorSplitEvenFurther[0],
                base: Number(sectorSplitEvenFurther[1]),
                top: Number(sectorSplitEvenFurther[2]),
                isCircle: Boolean(Number(sectorSplitEvenFurther[4])),
                coordinates: coords
            }
            sectorsObj[sectorSplitEvenFurther[0]] = results
            sectors.push(results)
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
        }
    })
    fs.writeFileSync("./vatglasses/sectors.geojson", JSON.stringify(geoJson), 'utf8')
    fs.writeFileSync("./vatglasses/sectors.json", JSON.stringify(sectors), 'utf8')
    fs.writeFileSync("./vatglasses/sectorsObj.json", JSON.stringify(sectorsObj), 'utf8')
}

function importSectors() {
    var file = fs.readFileSync("./vatglasses/sector.txt", 'utf8')
    var sectors = parseSectors(file)
}
importSectors()