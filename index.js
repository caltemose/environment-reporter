// tessel-specific dependencies
var tessel = require('tessel')
var climateLib = require('climate-si7005')
var ambientlib = require('ambient-attx4')

// non-tessel dependencies
var path = require('path')
var moment = require('moment')
var firebase = require("firebase-admin")

//
// Configuration
//

// timing intervals for how often to report are in seconds
var testingInterval = 5
var liveInterval = 15*60

// mode - affects interval timing, false disables firebase
var testing = false


//
// Firebase configuration and initialization
//

// admin private key downloaded from Firebase console
var serviceAccount = require(path.join(__dirname, "./firebase-admin-config.json"))

if (!testing) {
    firebase.initializeApp({
        credential: firebase.credential.cert(serviceAccount),
        databaseURL: "https://sizzling-torch-6298.firebaseio.com",
        databaseAuthVariableOverride: {
            // must use this user id or will not have write access to data
            uid: "tessel-user"
        }
    })
}


//
// Tessel setup
//

var climate = climateLib.use(tessel.port['A'])
var ambient = ambientlib.use(tessel.port['B'])

// used by initialization to determine if modules are ready to report
var climateReady = false
var ambientReady = false

// reset LEDs
tessel.led[0].off()
tessel.led[2].off()
tessel.led[3].off()

// handle climate and ambient module 'ready' and 'error' events

climate.on('ready', function () {
    climateReady = true
    startupCheck()
})

ambient.on('ready', function () {
    ambientReady = true
    startupCheck()
})

climate.on('error', function (err) {
    tessel.led[0].on()
    console.log('the climate sensor errored out', err)
})

ambient.on('error', function (err) {
    tessel.led[0].on()
    console.log('the ambient sensor errored out', err)
})

function startupCheck () {
    if (ambientReady && climateReady) {
        if (testing) console.log('sensors ready')
        initializeReporting()
    }
}

function initializeReporting () {
    tessel.led[0].off()
    setImmediate(function loop () {
        // yes i'm reading both temperature units and
        // yes this is a little callback hell. get over it.
        climate.readTemperature('c', function (err, tempC) {
            climate.readTemperature('f', function (err, tempF) {
                climate.readHumidity(function (err, humid) {
                    ambient.getLightLevel( function(err, lightdata) {
                        ambient.getSoundLevel( function(err, sounddata) {
                            report(
                                tempC.toFixed(4),
                                tempF.toFixed(4),
                                humid.toFixed(4),
                                lightdata.toFixed(8),
                                sounddata.toFixed(8)
                            )
                            var intervalTime = testing ? testingInterval*1000 : liveInterval*1000
                            setTimeout(loop, intervalTime)
                        });
                    });
                })
            })
        })
    })
}

function report (c, f, humid, light, sound) {
    // the date passed to the database is GMT
    // the location of the Tessel is known and any
    // date localization can be handled by the UI
    // using this data
    var now = moment()
    var key = '/environment/data/' + now.unix()
    var data = {
        tempC: c,
        tempF: f,
        humid: humid,
        light: light,
        sound: sound,
        date: now.format()
    }
    var update = {}
    update[key] = data

    if (testing) {
        console.log('testing', update)
    } else {
        console.log('writing to firebase', update)
        var promise = firebase.database().ref().update(update, onComplete)
        tessel.led[0].off()
        tessel.led[3].on()
    }
}


function onComplete (err) {
    if (err) {
        console.log('firebase error', err)
        tessel.led[0].on()
    } else {
        tessel.led[0].off()
        console.log('firebase success')
    }
    tessel.led[3].off()
}
