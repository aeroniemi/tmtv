#!/usr/bin/env node
let activities = require("./activities.js");
const chalk = require("chalk");
var argv = require("yargs/yargs")(process.argv.slice(2)).command(
  "watch",
  "download datafeed every [seconds]",
  (yargs) => {
    yargs
      .option("maxAge", {
        describe: "maximum age of last feed",
        default: 1000 * 60 * 1,
        type: "number",
      })
      .option("verbose", {
        alias: "v",
        type: "boolean",
        description: "Run with verbose logging",
        default: true,
      });
  },
  (argv) => {
    if (argv.verbose)
      console.info(
        `Watching the datafeed. Will download every ${argv.maxAge} seconds.`
      );
    watch(argv.maxAge, argv.verbose);
  }
).argv;
function watch(maxAge, verbose) {
  setInterval(
    () =>
      activities.getNewest().then(
        function (newest) {
          let lastUpdated = new Date(newest * 1000);
          let age = Date.now() - lastUpdated;
          if (age > maxAge) {
            if (verbose)
              console.info(
                `Local datafeed was last updated ${Math.round(
                  age / (1000 * 60)
                )} minutes ago, downloading a new version`
              );
            activities.downloadLatestData().catch((e) => {
              console.log(chalk.bgRed(e));
              return;
            });
          } else {
            if (verbose)
              console.info(
                `Local datafeed was last updated ${Math.round(
                  age / 1000
                )} seconds ago - no need for a new one`
              );
          }
        },
        function (error) {
          console.log(error);
        }
      ),
    maxAge
  );
}
