module.exports = {
  mapboxToken:
    "pk.eyJ1IjoiYWVyb25pZW1pIiwiYSI6ImNpdWJjeHY5djAwMGUyeW80ZTR4ZjgwN3MifQ.PkPF6NIAFU3fOZgDTpCHgA",
  port: 8080,
  maximumDatafeedAge: 60, // maximum datafeed age in seconds
  movingAveragePeriod: 20, // how many datapoints to account for when making moving averages
  useGns430: true,
  gns430Path: "./navdata/Airports.txt",
};
