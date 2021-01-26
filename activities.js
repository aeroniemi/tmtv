const https = require("https");
const fs = require("fs");
const chalk = require("chalk");
const expect = require("chai").expect;
const randomColor = require("randomcolor");
const apiUrl = "https://data.vatsim.net/v3/vatsim-data.json";
const turf = require("@turf/turf");
const dayjs = require("dayjs");
const CONSTS = require("./consts.js");
// const momentDate = require("moment");
const { group } = require("console");
var pilotData = {};
// -----------------------------------------------------------------------------
// Download related
// -----------------------------------------------------------------------------
function downloadLatestData() {
  return new Promise(function (resolve, reject) {
    https
      .get(apiUrl, function (res) {
        var body = "";
        res.on("data", function (chunk) {
          body += chunk;
        });
        res.on("end", function () {
          try {
            var data = JSON.parse(body);
          } catch (e) {
            reject(e);
            return;
          }
          try {
            var date = dayjs(data.general.update_timestamp).unix();
            // var date = Math.trunc(
            //   new Date(data.general.update_timestamp).getTime() / 1000
          } catch (e) {
            reject(e);
            return;
          }

          var fileName = date + ".json";
          fs.mkdir("./datafeed/", { recursive: true }, (err) => {
            if (err) throw err;
          });
          try {
            fs.writeFile(
              "./datafeed/" + fileName,
              JSON.stringify(data),
              "utf8",
              function (err) {
                if (err) {
                  console.error(err);
                  reject(err);
                }
                resolve(data);
              }
            );
          } catch (e) {
            reject(e);
            return;
          }
        });
      })
      .on("error", function (e) {
        console.error("Got an error: ", e);
        reject(e);
      });
  });
}
function getResultsInAgeRange(start, end) {
  return new Promise(function (resolve, reject) {
    if (start === undefined) {
      var newest = 0;
      fs.readdir("./datafeed/", (err, files) => {
        // if (err) reject(err);
        if (files === undefined || files.length == 0) {
          resolve(1);
          return;
        }
        newest = Math.max(
          ...files.map(function (file) {
            return parseInt(file.substring(0, file.length - 5));
          })
        );
        resolve(newest);
        return;
      });
    } else {
      fs.readdir("./datafeed/", (err, files) => {
        // if (err) reject(err);
        if (files === undefined || files.length == 0) {
          reject("No Files");
          return;
        }

        inRange = files
          .map(function (file) {
            var time = parseInt(file.substring(0, file.length - 5));
            if (dayjs.unix(time).isBetween(dayjs(start), dayjs(end), null)) {
              return time;
            } else {
              return null;
            }
          })
          .filter(function (el) {
            return el != null;
          });
        if (inRange.length === 0) {
          resolve([null, inRange]);
          return;
        }
        console.log(inRange);
        newest = Math.max(...inRange);
        resolve([newest, inRange]);
        return;
      });
    }
  });
}
exports.downloadLatestData = downloadLatestData;
exports.getNewest = getResultsInAgeRange;
exports.getResultsInAgeRange = getResultsInAgeRange;
// -----------------------------------------------------------------------------
// Parse-related
// -----------------------------------------------------------------------------

const verbose = false;
function report(text) {
  if (verbose) console.log(text);
}
function returnUniqueCid(table, flight) {
  var newCid = flight.cid;
  while (true) {
    if (newCid in table) {
      var old = table[newCid];
      if (old.logon_time == flight.logon_time) {
        return [newCid, CONSTS.ID.ALREADY_ASSIGNED];
      } else {
        var condition =
          ((flight.flightplan &&
            old.flightplan &&
            flight.flightplan == old.flightplan) ||
            flight.flightplan == null) &&
          flight.callsign == old.callsign;
        // if (flight.log[0].groundspeed > 50 && condition == false) {
        //     console.log(chalk.cyan(`Would previously have matched the flight for ${old.callsign} & ${flight.callsign}, but it doesn't meet new standards`))
        // }
        if (condition == true) {
          // assumed to just be dropped data in the middle, fill out as normal
          // if (flight.groundspeed > 50) { // assumed to just be dropped data in the middle, fill out as normal
          report(
            `Pilot is mid flight - resuming their last flight (last id: ${newCid})`
          );
          return [newCid, CONSTS.ID.RESUME_FLIGHT];
        } else {
          if (newCid == flight.cid) {
            newCid = flight.cid * 10;
          } else {
            newCid += 1;
          }
        }
      }
    } else {
      var timeSinceStart = (new Date() - new Date(flight.logon_time)) / 1000;
      report(
        `Assigned new id to ${flight.cid}: ${newCid}. Flight started ${timeSinceStart} seconds ago`
      );
      return [newCid, CONSTS.ID.NEW_FLIGHT];
    }
  }
}
function validReadings(oldest, newest) {
  return new Promise(function (resolve, reject) {
    var output = [];
    var oldestUnix = Math.trunc(dayjs(oldest).unix());
    var newestUnix = Math.trunc(dayjs(newest).unix());
    // console.log(oldestUnix, newestUnix);
    fs.readdir("./datafeed/", (err, files) => {
      if (err) throw err;
      if (files === undefined || files.length == 0) {
        reject("no valid files");
      }
      var images = files.map(function (file) {
        return parseInt(file.substring(0, file.length - 5));
      });
      images.forEach((image) => {
        if (image > oldestUnix && image < newestUnix) {
          output.push(image);
        }
      });

      resolve(output);
    });
  });
}

function assembleUsefulSubTable(image) {
  return new Promise(function (resolve, reject) {
    var name = image + ".json";
    fs.readFile("./datafeed/" + name, (err, body) => {
      if (err) reject(err);
      var results = JSON.parse(body);
      resolve(results);
    });
  });
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
      qnh_mb: pilot.qnh_mb,
    };
    var outputPilot = {
      cid: pilot.cid,
      name: pilot.name,
      callsign: pilot.callsign,
      logon_time: pilot.logon_time,
      flightplan: pilot.flight_plan,
      log: [currentLog],
    };
    // console.log(outputPilot)
    resolve(outputPilot);
  });
}
function managePilots(data) {
  return new Promise(function (resolve, reject) {
    var promises = data.pilots.map(function (ele) {
      return managePilot(ele);
    });
    Promise.all(promises).then((results) => {
      resolve(results);
    });
  });
}

function mergeIdentities(table) {
  return new Promise(function (resolve, reject) {
    // console.log(table)
    var promises = table.map(function (ele) {
      return managePilots(ele);
    });
    Promise.all(promises).then((results) => {
      var final = {};
      results.forEach((result) => {
        result.forEach((pilot) => {
          if (final[pilot.cid]) {
            var newCid = pilot.cid;
            if (final[pilot.cid].logon_time != pilot.logon_time) {
              var res = returnUniqueCid(final, pilot);
              newCid = res[0];
              var status = res[1];
              if (status == CONSTS.ID.ALREADY_ASSIGNED) {
                final[newCid].log.push(pilot.log[0]);
              } else if (status == CONSTS.ID.NEW_FLIGHT) {
                pilot.initial_logon_time = pilot.logon_time;
                final[newCid] = pilot;
              } else if (status == CONSTS.ID.RESUME_FLIGHT) {
                // if (pilot.callsign == "THY2323") console.log(pilot.callsign, newCid, pilot.logon_time)
                final[newCid].logon_time = pilot.logon_time;
                final[newCid].log.push(pilot.log[0]);
              }
              if (
                final[newCid].flightplan === null &&
                pilot.flightplan !== null
              ) {
                final[newCid].flightplan = pilot.flightplan;
                // console.log(`Assigning new flightplan to ${pilot.callsign}`);
              }
            } else {
              final[pilot.cid].log.push(pilot.log[0]);
              if (
                final[pilot.cid].flightplan === null &&
                pilot.flightplan !== null
              ) {
                final[pilot.cid].flightplan = pilot.flightplan;
                // console.log(`Assigning new flightplan to ${pilot.callsign}`);
              }
            }
            if (
              final[newCid].flightplan !== null &&
              pilot.flightplan !== null
            ) {
              if (
                final[newCid].flightplan.departure ==
                  pilot.flightplan.departure &&
                final[newCid].flightplan.arrival != pilot.flightplan.arrival
              ) {
                if (final[newCid].diverted === undefined) {
                  // if (final[newCid].flightplan.arrival == "EGKK") {
                  //   console.log(
                  //     `${pilot.callsign} Might have diverted from ${final[newCid].flightplan.arrival} to ${pilot.flightplan.arrival} `
                  //   );
                  // }
                  final[newCid].diverted = pilot.flightplan.arrival;
                }
              }
            }
          } else {
            pilot.initial_logon_time = pilot.logon_time;
            final[pilot.cid] = pilot;
          }
        });
      });
      resolve(final);
    });
  });
}
function assembleUsefulTable(subset) {
  return new Promise(function (resolve, reject) {
    var res = subset.map(function (ele) {
      return assembleUsefulSubTable(ele);
    });
    Promise.all(res).then((results) => resolve(results));
  });
}
exports.assembleUsefulTable = assembleUsefulTable;
exports.mergeIdentities = mergeIdentities;
exports.validReadings = validReadings;

parseResults = {
  lastUpdated: dayjs("01-01-1970"),
  body: [],
  bodyTable: {},
};
function initialFileLoad(files) {
  return new Promise(function (acc, reject) {
    assembleUsefulTable(files).then((table) => {
      pilotData = table;
      mergeIdentities(table).then((res) => {
        var array = Object.values(res);
        console.log(`Summary Statistics:
        Flights managed: ${array.length}`);
        parseResults = {
          lastUpdated: dayjs(),
          body: array,
          bodyObj: res,
        };
        // console.log("accepted the promise")
        acc(parseResults);
      });
    });
  });
}
exports.initialFileLoad = initialFileLoad;
async function liveMerge(data, hours) {
  var oldest = dayjs().subtract(hours, "hours").subtract(20, "minutes");
  // console.log(pilotData);
  pilotData.forEach((time, key) => {
    if (dayjs(time.general.update_timestamp).isBefore(oldest)) {
      console.log(`${key} is too old - deleting`);
      delete pilotData[key];
    }
  });
  pilotData.push(data);
  var plt = await mergeIdentities(pilotData);
  return plt;
}
exports.liveMerge = liveMerge;
function convertFlightToGeoJson(flight) {
  var log = convertLogToGeoJson(flight.log);
  // console.log(flight)
  var depAirport = "";
  var destAirport = "";
  if (flight.flightplan != null) {
    depAirport = flight.flightplan.departure;
    destAirport = flight.flightplan.destination;
  }
  log.properties = {
    depAirport: depAirport,
    arrAirport: destAirport,
    cid: flight.cid,
    callsign: flight.callsign,
    name: flight.name,
    phases: flight.phases,
    events: flight.events,
  };
  return log;
}
exports.convertFlightToGeoJson = convertFlightToGeoJson;

function convertLogToGeoJson(log, full, colour) {
  var coords = [];
  log.forEach((position) => {
    coords.push([position.longitude, position.latitude]);
  });
  if (full === true) {
    var geo = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [coords],
          },
        },
      ],
    };
    return geo;
  } else {
    var geo = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: coords,
      },
    };
    return geo;
  }
  return;
}
exports.convertLogToGeoJson = convertLogToGeoJson;

function readSectors() {
  return new Promise(function (resolve, reject) {
    fs.readFile("./vatglasses/sectorsObj.json", (err, body) => {
      if (err) reject(err);
      var results = JSON.parse(body);
      for (key in results) {
        var sec = results[key];
        if (sec.isCircle === false) {
          results[key].geoJson = turf.polygon([sec.coordinates], {
            base: sec.base,
            top: sec.top,
            name: sec.name,
          });
        } else {
          results[key].geoJson = turf.point(sec.coordinates, {
            base: sec.base,
            top: sec.top,
            name: sec.name,
            radius: sec.radius,
          });
        }
      }

      resolve(results);
    });
  });
}
function readControllers() {
  return new Promise(function (resolve, reject) {
    fs.readFile("./vatglasses/controllers.json", (err, body) => {
      if (err) reject(err);
      var results = JSON.parse(body);
      resolve(results);
    });
  });
}
function readInheritance() {
  return new Promise(function (resolve, reject) {
    fs.readFile("./vatglasses/inheritance.json", (err, body) => {
      if (err) reject(err);
      var results = JSON.parse(body);
      resolve(results);
    });
  });
}
// function readSectors() {
//     return new Promise(function (resolve, reject) {
//         Promise.all([readSectors2, readControllers, readInheritance]).then((results) => {
//             console.log(results)
//             resolve(results)
//         })
//     })
// }

exports.readSectors = readSectors;
exports.readControllers = readControllers;
exports.readInheritance = readInheritance;

function workOutFlightPhases(flight) {
  return new Promise(function (resolve, reject) {
    if (flight.flightplan === null) {
      (flight.phases = null), (flight.events = null);
      resolve(flight);
    }
    var states = [];
    var events = [];
    var currentState = null;
    var lastTime = null;
    var lastTimeBefore = null;
    function changeState(state, time, data) {
      var middle = dayjs(time).subtract(
        dayjs(time).diff(dayjs(lastTime)) / 2,
        "ms"
      );
      states[states.length - 1].end = time;
      states.push({
        phase: state,
        start: middle,
        end: null,
        ...data,
      });
      currentState = state;
    }
    function defineEvent(event, time) {
      var middle = dayjs(time).subtract(
        dayjs(time).diff(dayjs(lastTime)) / 2,
        "ms"
      );
      events.push({
        type: event,
        time: middle,
      });
    }
    function identPhase(moment) {
      lastTime = lastTimeBefore;
      lastTimeBefore = moment.timestamp;
      if (currentState === null) {
        lastTime = moment.timestamp;
        lastTimeBefore = moment.timestamp;
        // init
        if (moment.groundspeed > 50) {
          currentState = CONSTS.STATE.CRUISE;
          states.push({
            phase: CONSTS.STATE.CRUISE,
            start: moment.timestamp,
            end: null,
          });
        } else {
          currentState = CONSTS.STATE.PREFLIGHT;
          states.push({
            phase: CONSTS.STATE.PREFLIGHT,
            start: moment.timestamp,
            end: null,
          });
        }
      } else {
        // already inited
        // -------------------------------------------------------------------
        // Preflight
        // -------------------------------------------------------------------
        if (currentState == CONSTS.STATE.PREFLIGHT) {
          if (moment.groundspeed < 0) {
            changeState(CONSTS.STATE.PUSH, moment.timestamp);
            return;
          }
          if (moment.groundspeed > 5) {
            defineEvent(CONSTS.EVENT.TAXI, moment.timestamp);
            changeState(CONSTS.STATE.TAXI, moment.timestamp);
            return;
          }
        }
        // -------------------------------------------------------------------
        // Push
        // -------------------------------------------------------------------
        if (currentState == CONSTS.STATE.PUSH) {
          if (moment.groundspeed > 5) {
            defineEvent(CONSTS.EVENT.TAXI, moment.timestamp);
            changeState(CONSTS.STATE.TAXI, moment.timestamp);
            return;
          }
        }
        // -------------------------------------------------------------------
        // Taxi
        // -------------------------------------------------------------------
        if (currentState == CONSTS.STATE.TAXI) {
          if (moment.groundspeed > 50) {
            changeState(CONSTS.STATE.CLIMB, moment.timestamp);
            defineEvent(CONSTS.EVENT.TAKEOFF, moment.timestamp);
            return;
          }
        }
        // -------------------------------------------------------------------
        // Climb
        // -------------------------------------------------------------------
        if (currentState == CONSTS.STATE.CLIMB) {
          if (moment.groundspeed < 50) {
            changeState(CONSTS.STATE.TAXI, moment.timestamp);
            defineEvent(CONSTS.EVENT.ABORTTAKEOFF, moment.timestamp);
            return;
          }
          if (Math.abs(moment.altitude - flight.flightplan.altitude) < 2000) {
            changeState(CONSTS.STATE.CRUISE, moment.timestamp);
            defineEvent(CONSTS.EVENT.TOPOFCLIMB, moment.timestamp);
            return;
          }
        }
        // -------------------------------------------------------------------
        // cruise
        // -------------------------------------------------------------------
        if (currentState == CONSTS.STATE.CRUISE) {
          if (flight.flightplan.altitude - moment.altitude > 4000) {
            changeState(CONSTS.STATE.DESCENT, moment.timestamp);
            defineEvent(CONSTS.EVENT.TOPOFDESCENT, moment.timestamp);
            return;
          }
        }
        // -------------------------------------------------------------------
        // descent
        // -------------------------------------------------------------------
        if (currentState == CONSTS.STATE.DESCENT) {
          if (moment.groundspeed < 50) {
            changeState(CONSTS.STATE.ARRIVAL, moment.timestamp);
            defineEvent(CONSTS.EVENT.LANDING, moment.timestamp);
            return;
          }
        }
        // -------------------------------------------------------------------
        // descent
        // -------------------------------------------------------------------
        if (currentState == CONSTS.STATE.ARRIVAL) {
          if (moment.groundspeed > 50) {
            changeState(CONSTS.STATE.CLIMB, moment.timestamp);
            defineEvent(CONSTS.EVENT.TAKEOFF, moment.timestamp);
            return;
          }
        }
      }
    }
    flight.log.forEach(identPhase);
    flight.phases = states;
    flight.events = events;
    // if (flight.callsign == "LOT2021") {
    //   var sub = flight;
    //   delete flight.log;
    //   console.log(flight);
    // }
    resolve(flight);
  });
}

function workOutAllFlightPhases(flights) {
  return new Promise(function (resolve, reject) {
    var promises = flights.map((flight) => {
      return workOutFlightPhases(flight);
    });
    Promise.all(promises).then((phases) => {
      resolve(phases);
    });
  });
}
exports.workOutAllFlightPhases = workOutAllFlightPhases;

exports.addToFlights = async function (pilots) {};

exports.stringifyCsv = function stringifyCsv(data) {
  var output = ``;
  for (key in data[0]) {
    output += `${key},`;
  }
  output = output.slice(0, -1);
  output += "\r\n";
  data.forEach((row) => {
    for (col in row) {
      var cell = row[col];

      if (cell instanceof dayjs) {
        cell = dayjs(cell).format("DD/MM/YYYY  HH:mm:ss");
      }
      if (cell instanceof Object) {
        var st = ``;
        for (key in cell) {
          st += `${cell[key]},`;
        }
        cell = st;
      }
      output += `${cell},`;
    }
    output = output.slice(0, -1);
    output += "\r\n";
  });
  return output;
};
