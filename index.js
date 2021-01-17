let activities = require("./activities.js")
const maxAge = 1000 * 60 * 1
// activities.downloadLatestData.then(
//     function (value) { console.log(value) },
//     function (error) { console.log(error) }

// )

setInterval(() => activities.getNewest().then(
    function (newest) {
        let lastUpdated = new Date(newest * 1000);
        let age = Date.now() - lastUpdated
        if (age > maxAge) {
            console.log(`it's too old: ${Math.round(age / (1000 * 60))} minutes ago`)
            activities.downloadLatestData()
        } else {
            console.log(`last updated ${Math.round(age / (1000))} seconds ago`)
        }
    },
    function (error) { console.log(error) }
), 30 * 1000)
