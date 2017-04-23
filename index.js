var path = require('path')
var tessel = require('tessel')
var climateLib = require('climate-si7005')
var ambientlib = require('ambient-attx4')
var admin = require("firebase-admin")

// admin private key downloaded from Firebase console
var serviceAccount = require(path.join(__dirname, "./firebase-admin-config.json"))

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://sizzling-torch-6298.firebaseio.com",
    databaseAuthVariableOverride: {
        // must use this user id or will not have write access to data
        uid: "tessel-user"
    }
})

var db = admin.database()
var ref = db.ref("/restricted")
ref.once("value", function(snapshot) {
    console.log(snapshot.val())
})


return



var ambient = ambientlib.use(tessel.port['B']);
var climate = climateLib.use(tessel.port['A']);

var climateReady = false
var ambientReady = false

var testing = false

if (!testing) {
    var init = firebase.initializeApp(firebaseConfig)
}

// reset LEDs
tessel.led[0].off()
tessel.led[2].off()
tessel.led[3].off()

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
                            var intervalTime = testing ? 5*1000 : 15*60*1000
                            setTimeout(loop, intervalTime)
                        });
                    });
                })
            })
        })
    })
}

function report (c, f, humid, light, sound) {
    var now = new Date()
    var key = '/tessel/environment/' + now.getTime()
    var data = {
        tempC: c,
        tempF: f,
        humid: humid,
        light: light,
        sound: sound,
        date: now
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
