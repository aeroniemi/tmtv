// -----------------------------------------------------------------------------
// Modules
// -----------------------------------------------------------------------------
const activities = require("./activities.js");
const chalk = require("chalk");
const config = require("./config.js");
const dayjs = require("dayjs");
const expect = require("chai").expect;
const exphbs = require("express-handlebars");
const express = require("express");
// const sma = require("sma");
const CONSTS = require("./consts.js");
const isBetween = require("dayjs/plugin/isBetween");
dayjs.extend(isBetween);
// -----------------------------------------------------------------------------
// Variables
// -----------------------------------------------------------------------------
const app = express();
var sectorOwner = {};
var ownedSectors = {};
var pilotsArray = [];
var pilotsObj = {};
var livePilotsArray = [];
var livePilotsObj = {};
var loadedFiles = [];

async function pastDataSetup(start, end) {
  // var sectors = await activities.readSectors();
  // var controllers = await activities.readControllers();
  // var inheritance = await activities.readInheritance();
  activities.setAirports(await activities.loadAirports());
  var files = await activities.getResultsInAgeRange(start, end).catch((err) => {
    throw err;
  });
  var parseResults = await activities.initialFileLoad(files[1]);
  pilotsArray = parseResults.body;
  pilotsObj = parseResults.bodyObj;
  pilotsArray = await activities.workOutAllFlightPhases(pilotsArray);
  return;
}
// -----------------------------------------------------------------------------
// Run function
// Runs the server stuff
// -----------------------------------------------------------------------------
async function runServerStartup() {
  app.use("/static", express.static("static"));
  app.use("/api/sector", express.static("vatglasses"));
  app.engine("handlebars", exphbs({ extname: ".hbs" }));
  app.set("view engine", "handlebars");
  app.get("/", function (req, res) {
    res.send("Hello World!");
  });
  app.listen(config.port, () => {
    console.log(`Open for buisness at http://localhost:${config.port}`);
  });
  app.get("/aircraft/:id", function (req, res, next) {
    var id = req.params.id;
    var apiUrl = `aircraft/${req.params.id}`;
    res.render("aircraftById", { apiUrl: apiUrl });
  });
  app.get("/map/all", function (req, res, next) {
    res.render("generic", {
      apiUrl: "aircraft/",
      mapboxToken: config.mapboxToken,
    });
  });
  app.get("/map/airport/:icao", function (req, res, next) {
    var icao = req.params.icao.toUpperCase();
    res.render("generic", {
      apiUrl: `airport/${icao}`,
      mapboxToken: config.mapboxToken,
    });
  });
  app.get("/map/sector/:id", function (req, res, next) {
    res.render("generic", {
      apiUrl: `/sector/${req.params.id}`,
      mapboxToken: config.mapboxToken,
    });
  });
  app.get("/map/frequency/:id", function (req, res, next) {
    res.render("generic", {
      apiUrl: `frequency/${req.params.id}`,
      mapboxToken: config.mapboxToken,
    });
  });

  app.get("/map/sector/", function (req, res, next) {
    res.render("generic", {
      apiUrl: `sector/sectors.geojson`,
      mapboxToken: config.mapboxToken,
      additionalFunctions:
        "requestJson('/api/sector/sectors.geojson', addSectors)",
    });
    // res.render("generic", { apiUrl: `/sector/sectors.geojson`, mapboxToken: config.mapboxToken, additionalFunctions: "requestJson('/api/sector/sectors.geojson', addSectors)" })
  });
  app.get("/map/all/heat", function (req, res, next) {
    res.render("heat", { apiUrl: "aircraft/heat" });
  });
  app.get("/api/aircraft", function (req, res, next) {
    var id = req.params.id;
    // console.log(parseResults, id, parseResults[id])
    var planes = {
      type: "FeatureCollection",
      features: [],
    };

    pilotsArray.forEach((flight) => {
      planes.features.push(activities.convertFlightToGeoJson(flight));
    });
    res.send(planes);
  });
  app.get("/api/aircraft/heat", function (req, res, next) {
    var id = req.params.id;
    // console.log(parseResults, id, parseResults[id])
    var planes = [];
    pilotsArray.forEach((flight) => {
      flight.log.forEach((point) => {
        planes.push([point.latitude, point.longitude, 0.5]);
      });
    });
    res.send(planes);
  });
  app.get("/api/aircraft/:id", function (req, res, next) {
    var id = req.params.id;
    // console.log(parseResults, id, parseResults[id])
    if (id in pilotsObj) {
      var pilot = pilotsObj[id];
      var route = activities.convertLogToGeoJson(pilot.log, true);
      res.send(route);
    } else {
      res.send(`Aircraft with id ${id} not found.`);
      // createError(404, `Aircraft with id ${id} not found.`)
    }
    // console.log(results.bodyTable, "hi")
  });
  app.get("/api/user/:cid", function (req, res, next) {
    var planes = {
      type: "FeatureCollection",
      features: [],
    };
    pilotsArray.forEach((flight) => {
      if (flight.cid == req.params.cid) {
        planes.features.push(activities.convertLogToGeoJson(flight.log));
      }
    });
    res.send(planes);
  });
  app.get("/api/airport/:icao", function (req, res, next) {
    var icao = req.params.icao.toUpperCase();
    var planes = {
      type: "FeatureCollection",
      features: [],
    };
    pilotsArray.forEach((flight) => {
      // console.log(flight);
      if (flight.flightplan !== null && flight.log && flight.log.length > 0) {
        if (
          flight.flightplan.departure == icao ||
          flight.flightplan.destination == icao
        ) {
          var plane = activities.convertLogToGeoJson(flight.log);
          Object.assign(plane.properties, flight);
          delete plane.properties.log;
          // console.log(plane);
          planes.features.push(plane);
        }
      }
    });
    res.send(planes);
  });

  // ---------------------------------------------------------------------------
  // Performance
  // ---------------------------------------------------------------------------
  app.get("/performance/:icao", function (req, res, next) {
    res.render("opsRate", req);
  });
  app.get("/api/airport/:icao/performance.json", function (req, res, next) {
    var icao = req.params.icao.toUpperCase();
    var ta = calculateAirportPerformance(icao);
    res.header("Content-Type", "text/json");
    res.send(JSON.stringify(ta));
  });
  app.get(
    "/api/airport/:icao/performanceChart.json",
    function (req, res, next) {
      var icao = req.params.icao.toUpperCase();
      var ta = calculateAirportPerformance(icao);
      var newTable = [
        {
          x: [],
          raw: [],
          y: [],
          stackgroup: "one",
          name: "Takeoffs",
        },
        {
          x: [],
          raw: [],
          y: [],
          stackgroup: "one",
          name: "Landings",
        },
        {
          x: [],
          raw: [],
          y: [],
          stackgroup: "two",
          name: "Taxi",
        },
        {
          x: [],
          raw: [],
          y: [],
          stackgroup: "two",
          name: "Top of Descent",
        },
      ];
      ta.forEach((slot, index) => {
        if (index >= 1) {
          newTable[0].x.push(dayjs(slot.time).toISOString());
          newTable[1].x.push(dayjs(slot.time).toISOString());
          newTable[2].x.push(dayjs(slot.time).toISOString());
          newTable[3].x.push(dayjs(slot.time).toISOString());

          newTable[0].raw.push(slot.events[1] * 60);
          newTable[1].raw.push(slot.events[5] * 60);
          newTable[2].raw.push(slot.events[0] * 60);
          newTable[3].raw.push(slot.events[4] * 60);
        }
      });
      newTable[0].y = activities.sma(
        newTable[0].raw,
        config.movingAveragePeriod
      );
      newTable[1].y = activities.sma(
        newTable[1].raw,
        config.movingAveragePeriod
      );
      newTable[2].y = activities.sma(
        newTable[2].raw,
        config.movingAveragePeriod
      );
      newTable[3].y = activities.sma(
        newTable[3].raw,
        config.movingAveragePeriod
      );
      // newTable[0].x.splice(0, config.movingAveragePeriod - 1);
      // newTable[1].x.splice(0, config.movingAveragePeriod - 1);
      // newTable[2].x.splice(0, config.movingAveragePeriod - 1);
      // newTable[3].x.splice(0, config.movingAveragePeriod - 1);
      // console.log(`${newTable[0].x.length},${newTable[0].y.length}`);
      delete newTable[0].raw;
      delete newTable[1].raw;
      delete newTable[2].raw;
      delete newTable[3].raw;
      res.header("Content-Type", "text/json");
      res.send(JSON.stringify(newTable));
    }
  );
  app.get("/api/airport/:icao/performance.csv", function (req, res, next) {
    var icao = req.params.icao.toUpperCase();
    var ta = calculateAirportPerformance(icao);
    var csv = activities.stringifyCsv(ta);
    res.header("Content-Type", "text/csv");
    res.send(csv);
  });
  app.get(
    "/api/airport/:icao/performanceChartLatest.json",
    function (req, res, next) {
      var icao = req.params.icao.toUpperCase();
      var ta = calculateAirportPerformance(icao);
      var newTable = [
        {
          x: [],
          raw: [],
          y: [],
          stackgroup: "one",
          name: "Takeoffs",
        },
        {
          x: [],
          raw: [],
          y: [],
          stackgroup: "one",
          name: "Landings",
        },
        {
          x: [],
          raw: [],
          y: [],
          stackgroup: "two",
          name: "Taxi",
        },
        {
          x: [],
          raw: [],
          y: [],
          stackgroup: "two",
          name: "Top of Descent",
        },
      ];
      ta.forEach((slot) => {
        newTable[0].x.push(dayjs(slot.time).toISOString());
        newTable[1].x.push(dayjs(slot.time).toISOString());
        newTable[2].x.push(dayjs(slot.time).toISOString());
        newTable[3].x.push(dayjs(slot.time).toISOString());

        newTable[0].raw.push(slot.events[1] * 60);
        newTable[1].raw.push(slot.events[5] * 60);
        newTable[2].raw.push(slot.events[0] * 60);
        newTable[3].raw.push(slot.events[4] * 60);
      });
      newTable[0].y = activities.sma(newTable[0].raw, 20);
      newTable[1].y = activities.sma(newTable[1].raw, 20);
      newTable[2].y = activities.sma(newTable[2].raw, 20);
      newTable[3].y = activities.sma(newTable[3].raw, 20);
      newTable[0].x.splice(0, 19);
      newTable[1].x.splice(0, 19);
      newTable[2].x.splice(0, 19);
      newTable[3].x.splice(0, 19);
      // console.log(`${newTable[0].x.length},${newTable[0].y.length}`);
      delete newTable[0].raw;
      delete newTable[1].raw;
      delete newTable[2].raw;
      delete newTable[3].raw;
      res.header("Content-Type", "text/json");
      res.send(JSON.stringify(newTable));
    }
  );
  app.get("/api/airport/:icao/performance.csv", function (req, res, next) {
    var icao = req.params.icao.toUpperCase();
    var ta = calculateAirportPerformance(icao);
    var csv = activities.stringifyCsv(ta);
    res.header("Content-Type", "text/csv");
    res.send(csv);
  });
  // ---------------------------------------------------------------------------
  //
  // ---------------------------------------------------------------------------
  app.get("/api/sector/:id", function (req, res, next) {
    var sector = sectors[req.params.id];
    if (typeof sector === undefined) {
      res.send("error");
    }
    if (sector.top == 0) {
      sector.top = 100000;
    }
    // console.log(sector)
    var planesInSector = [];
    var geoJson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [sector.coordinates],
          },
        },
      ],
    };
    pilotsArray.forEach((flight) => {
      var timeInSector = [];
      flight.log.some((point) => {
        if (point.altitude > sector.base && point.altitude < sector.top) {
          var isInSectorHoriz = geo.isPointInPolygon(
            { latitude: point.latitude, longitude: point.longitude },
            sector.coordinates
          );
          if (isInSectorHoriz === true) {
            console.log(`${flight.callsign} is in sector ${sector.name}`);
            planesInSector.push({ flight });
            geoJson.features.push(activities.convertFlightToGeoJson(flight));
            return;
          }
        }
      });
    });
    res.send(geoJson);
  });
  app.get("/api/frequency/:id", function (req, res, next) {
    var controllerId = null;
    controllers.some((controller, index) => {
      if (controller.frequency == req.params.id) {
        controllerId = controller.id;
        return;
      }
    });

    if (controllerId != null) {
      manageSectorOwnership([controllerId]);
      // console.log(ownedSectors)
      var sec = checkOwnedSectors(controllerId);
      var atco = getControllerInfo(controllerId);
      atco.sectors = sec;
      var geoJson = {
        type: "FeatureCollection",
        features: [],
      };
      geoJson.features = sec.map((sector) => {
        return geoJsonSector(sector);
      });
      res.send(geoJson);
    } else {
      res.send(`Controller with frequency ${req.params.id} not found.`);
    }
  });
  function checkOwnedSectors(id) {
    return ownedSectors[id];
  }
  function getControllerInfo(id) {
    console.log(chalk.red("hi"), ownedSectors);
    return controllers[id];
  }
  function geoJsonSector(sector) {
    var sectorDetails = sectors[sector];
    var geoJson = {
      type: "Feature",
      properties: {
        base: sectorDetails.base,
        top: sectorDetails.top,
        name: sectorDetails.name,
      },
      geometry: {
        type: "Polygon",
        coordinates: [sectorDetails.coordinates],
      },
    };
    return geoJson;
  }
  function manageSectorOwnership(onlineFacilities) {
    // for (var member in ownedSectors) ownedSectors[member] = [];
    for (var member in sectorOwner) sectorOwner[member] = null;
    onlineFacilities.forEach((fac) => {
      ownedSectors[fac] = [];
    });
    inheritance.forEach((unit) => {
      // console.log(unit.id);
      if (unit.order.length > 0) {
        unit.order.some((pos) => {
          // console.log(onlineFacilities, pos)
          if (onlineFacilities.includes(pos)) {
            unit.sectors.forEach((sector) => {
              sectorOwner[sector] = pos;
            });
            if (ownedSectors[pos] === undefined) {
              ownedSectors[pos] = unit.sectors;
              return true;
            }
            console.log(`${pos} owns unit ${unit.id}`);
            ownedSectors[pos].push(...unit.sectors);
            return true;
          }
        });
      } else {
        unit.sectors.forEach((sector) => {
          sectorOwner[sector] = null;
        });
      }
    });
    // console.log(sectorOwner)
    // console.log(ownedSectors[125])
  }
}
// -----------------------------------------------------------------------------
// Calculates airport performance (landing/takeoff rate)
// -----------------------------------------------------------------------------
function calculateAirportPerformance(icao) {
  var rows = [];
  pilotsArray.forEach((flight) => {
    if (flight.flightplan !== null) {
      if (flight.diverted !== undefined) {
        flight.flightplan.arrival = flight.diverted;
      }
      if (
        flight.flightplan.departure == icao ||
        flight.flightplan.arrival == icao
      ) {
        expect(flight.events).to.be.a("array");
        var flightEvents = [];
        flight.events.forEach((event) => {
          if (event.type === CONSTS.EVENT.TAXI) {
            if (flight.flightplan.departure == icao) {
              flightEvents.push({
                time: event.time,
                type: event.type,
                airport: flight.flightplan.departure,
              });
            }
          } else if (event.type === CONSTS.EVENT.TAKEOFF) {
            if (flight.flightplan.departure == icao) {
              flightEvents.push({
                time: event.time,
                type: event.type,
                airport: flight.flightplan.departure,
              });
            }
            // } else if (event.type === CONSTS.EVENT.TOPOFDESCENT) {
            //   if (flight.flightplan.arrival == icao) {
            //     flightEvents.push({
            //       time: event.time,
            //       type: event.type,
            //       airport: flight.flightplan.arrival,
            //     });
            //   }
          } else if (event.type === CONSTS.EVENT.LANDING) {
            if (flight.flightplan.arrival == icao) {
              flightEvents.push({
                time: event.time,
                type: event.type,
                airport: flight.flightplan.arrival,
              });
            }
          }
        });
        rows.push(...flightEvents);
      }
    }
  });
  rows = rows.sort((a, b) => new Date(a.time) - new Date(b.time));
  // console.log(rows[0]);
  if (rows.length === 0) {
    return [];
  }
  var ta = [
    {
      time: dayjs(rows[0].time).startOf("minute"),
      events: {
        5: 0,
        1: 0,
        0: 0,
        3: 0,
      },
    },
  ];
  var timeIndex = 0;
  var rowIndex = 0;
  while (rowIndex < rows.length) {
    var row = rows[rowIndex];
    if (dayjs(row.time).isBefore(dayjs(ta[timeIndex].time).add(1, "minute"))) {
      ta[timeIndex].events[row.type] += 1;
      rowIndex++;
    } else {
      ta.push({
        time: dayjs(ta[timeIndex].time).add(1, "minute"),
        events: {
          5: 0,
          1: 0,
          0: 0,
          3: 0,
        },
      });
      timeIndex += 1;
    }
  }
  return ta;
}
// -----------------------------------------------------------------------------
// Watch the datafeed
// -----------------------------------------------------------------------------
function watchDatafeed(hours) {
  setInterval(async function () {
    console.log("updating datafeed");
    var [newest, all] = await activities.getResultsInAgeRange(
      dayjs().subtract(hours, "hours"),
      dayjs()
    );
    let age = dayjs().diff(dayjs.unix(newest), "seconds");
    // console.log(newest, age);
    if (age > config.maximumDatafeedAge) {
      var data = await activities.downloadLatestData().catch((e) => {
        console.log(chalk.bgRed(e));
        return;
      });
      var parseResults = await activities.liveMerge(data, hours);
      pilotsArray = await activities.workOutAllFlightPhases(
        Object.values(parseResults)
      );
      // console.log(parseResults);
    }
  }, config.maximumDatafeedAge * 1000);
}
// -----------------------------------------------------------------------------
// Live data setup
// -----------------------------------------------------------------------------
async function liveDataSetup(hours) {
  var [newest, all] = await activities
    .getResultsInAgeRange(dayjs().subtract(hours, "hours"), dayjs())
    .catch(() => {
      throw new Error("No valid past data, continuing with live only");
    });
  if (newest === null) {
    throw new Error("No valid past data, continuing with live only");
  }
  activities.setAirports(await activities.loadAirports());
  // console.log(activities.airports["EGKK"]);
  // console.log(newest, all);
  var parseResults = await activities.initialFileLoad(all);
  // console.log("here");
  pilotsArray = await activities.workOutAllFlightPhases(parseResults.body);
  pilotsObj = parseResults.bodyObj;
  return parseResults;
}
// -----------------------------------------------------------------------------
// Startup for the live server
// -----------------------------------------------------------------------------
async function startLive(hours) {
  expect(hours).to.be.a("number");
  liveDataSetup(hours).catch((err) => console.log(chalk.red(err.message)));
  watchDatafeed(hours);
  runServerStartup();
  return;
}
// -----------------------------------------------------------------------------
// Startup for the live server
// -----------------------------------------------------------------------------
async function startPast(start, end) {
  await pastDataSetup(start, end).catch((err) => {
    // console.log(chalk.red("No valid past data found"));
    return Promise.reject("No valid past data found");
  });
  await runServerStartup();
  return;
}
// -----------------------------------------------------------------------------
// Manages the commands from cli
// -----------------------------------------------------------------------------
var argv = require("yargs/yargs")(process.argv.slice(2))
  .command(
    "past",
    "Run the web server",
    (yargs) => {
      yargs
        .option("start", {
          describe: "Start time/date",
          default: "2021-01-20 16:00:00",
          type: "string",
        })
        .option("end", {
          describe: "Start time/date",
          default: "2021-01-20 23:30:00",
          type: "string",
        });
    },
    (argv) => {
      if (dayjs(argv.start).isValid() !== true) {
        throw new Error(
          "Start time is not a valid date. Make sure you use a valid date format."
        );
      }
      if (dayjs(argv.end).isValid() !== true) {
        throw new Error(
          "End time is not a valid date. Make sure you use a valid date format."
        );
      }
      if (
        dayjs(argv.start).isBefore(dayjs(argv.end)) === false ||
        dayjs(argv.start).isBefore(dayjs()) === false
      ) {
        throw new Error("Start time is not before end time");
      }
      startPast(argv.start, argv.end).catch((err) =>
        console.log(chalk.red(err))
      );
    }
  )
  .command(
    "live",
    "Run the web server in live",
    (yargs) => {
      yargs.option("hours", {
        describe: "Max data age in hours",
        default: 4,
        type: "number",
      });
    },
    (argv) => {
      if (argv.hours > 48 && argv.hours < 1) {
        throw new Error(
          "Defined hours is bad - needs to be a int between 1 and 48"
        );
      }
      startLive(argv.hours).catch((err) => console.log(chalk.red(err)));
    }
  ).argv;
