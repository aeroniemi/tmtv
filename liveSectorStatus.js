//this needs to:
//update its data once a minute from the server
//display a list of all sectors and the aircraft currently in them
const express = require('express')
const exphbs = require('express-handlebars');
const geo = require('geolib');
const app = express()
const port = 8080
var randomColor = require('randomcolor');
var config = require('./config.js')
const activities = require("./activities.js")
var liveData = require("./liveDataHandler")


var liveSectorStatus = []
async function serverSetup() {
    app.use('/static', express.static('static'))
    app.use('/api/sectorData/', express.static('vatglasses'))
    app.engine('handlebars', exphbs({ extname: '.hbs' }));
    app.set('view engine', 'handlebars');
    app.get('/live/', function (req, res) {
        res.render("liveStatus")
    })
    app.get('/live/map', function (req, res, next) {
        res.render("generic", { apiUrl: `live.json`, mapboxToken: config.mapboxToken })
    });
    app.get('/', function (req, res) {
        res.send(liveData.getLatestPilotsArray())
    })
    app.listen(port, () => {
        console.log(`Open for buisness at http://localhost:${port}`)
    })
    app.get('/api/live.json', function (req, res) {
        var onlineFacilities = {}
        liveData.getOnlineFacilities().forEach((fac) => {
            var controller = liveData.getControllers(fac)
            onlineFacilities[fac] = {
                colour: randomColor(),
                name: controller.fullIdent,
                frequency: controller.frequency
            }
        })
        var geo = {
            type: "FeatureCollection",
            features: liveData.getLiveGeo(),
            facilities: onlineFacilities
        }
        res.send(JSON.stringify(geo))
    })
}



async function manage() {
    await liveData.setup()
    await serverSetup()
}

function updateData() {

}
manage()