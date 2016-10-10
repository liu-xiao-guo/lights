var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

// Get the parts for light control
var fs = require("fs");
var ZHA = require("./zha.js");
var dataUtils = require("./data-utils.js");
var Host = ZHA.host;
var Light = ZHA.light;
var host = null;

// get the serial port module
var fs = require("fs");
var SerialPort = require("serialport");

var portName = 'USB';
SerialPort.list(function (err, ports) {
    var portCount = 0;
    ports.forEach(function(port) {
        if(portCount > 1)
            return;
        if(port.comName.indexOf(portName) > 0) {
            console.log("At least one port has been found!")
            portCount++;
            onPortFound(port);
            return;
        }
    });
    if( portCount == 0 ) {
        console.log('serial port not found');
        // process.exit(1);
    }
});

function onPortFound(port) {
    hostPort = new SerialPort(port.comName, {
        baudRate: 115200
    }, onPortOpen);
}

function onPortOpen(error) {
    if( error != null ) {
        console.log('open serial port failed: ' + error);
        // process.exit(1);
        return;
    } else {
        console.log('serial port opened!');
        hostPort.on('data', onPortReceive);
        initHost();

        setInterval(function(){
            // client.publish('lightdata', 'nice')
            // Trying to get the light status
            host.onUserCommand("light.getPower",  '{"id":"Light1"}')
        }, 5 * 1000);
    }
}

function onPortReceive(data) {
    if(host) {
        host.onReceive(data);
    }
}

//host application

var dataPath = process.env.SNAP;
if(dataPath == null) {
    dataPath = "data/"
}
else if(dataPath.slice(-1) != "/")
    dataPath += "/"

console.log("dataPath: " + dataPath)

var epid = "";

function initHost() {
    host = new Host(hostPort);

    // if(initCommandPath)
    // 	host.onUserCommand(initCommandPath, initCommandParam);
    // else {
    // }
    host.on("versionUpdated", function(version) {
        console.log("version updated: " + JSON.stringify(version));
    });
    host.on("epidUpdated", function(epidValue) {
        console.log("epid updated: " + epidValue);
        epid = epidValue;
    });
    host.on("lightPowerUpdated", function(light) {
        console.log("light power updated: " + JSON.stringify({
                "id": light.id,
                "power": light.power
            }));
        // We need to publish the data so all of the terminals can update the status
        client.publish('lightdata', JSON.stringify(light))
    });
    host.on("foundNewLight", function(light) {
        console.log("found new light: " + JSON.stringify({
                "id": light.id,
                "uid": light.uid
            }));
        saveDevices();
    });
    host.on("deviceDetached", function(light) {
        console.log("device detached: " + JSON.stringify({
                "id": light.id,
                "uid": light.uid
            }));
        saveDevices();
    });
    host.onInit();

    // The following is only for testing purpose
    // host.loadDevices([
    // 	{id: 'Light1', uid: '8357FE0001881700'},
    // 	{id: 'Light2', uid: '8B5DF90001881700'},
    // 	{id: 'Light3', uid: '285EF90001881700'}
    // ]);
    // saveDevices()

    fs.readFile(dataPath+"devices.json",
        {encoding: "utf8", flag: "r"}, function(err, data) {
        if( err ) {
            console.log("failed to open devices file due to error: " + err);
        } else {
            var devices = JSON.parse(data);
            host.loadDevices(devices);
        }
    });
}

function saveDevices() {
    if(host.lights == null)
        return;
    var devices = new Array();
    for(var light of host.lights) {
        var device = new Object();
        device.id = light.id;
        device.uid = light.uid;
        devices.push(device);
    }
    fs.writeFile(dataPath+"devices.json", JSON.stringify(devices),
        { encoding:"utf8", flag:"w" }, function(err) {
        if(err) {
            console.log("failed to write devices file due to error: " + err);
        }
    })
}

var DEFAULT_HOST = 'localhost'
var DEFAULT_PORT = 1883
var mqtt = require('mqtt')
var client = mqtt.connect({ port: DEFAULT_PORT, host: DEFAULT_HOST, keepalive: 10000});

// client.end()

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

var router = express.Router();

// middleware to use for all requests
router.use(function(req, res, next) {
  // do logging
  console.log('Something is happening.');
  next(); // make sure we go to the next routes and don't stop here
});

String.prototype.format = function() {
    var formatted = this;
    for (var i = 0; i < arguments.length; i++) {
        var regexp = new RegExp('\\{'+i+'\\}', 'gi');
        formatted = formatted.replace(regexp, arguments[i]);
    }
    return formatted;
};

// Get all of the status of the lights
router.route('/lights')
    .get(function(req, res) {
        // var light = {};
        // light.id = "light1";
        // light.uid = "8357FE0001881700";
        // res.status(200).json(light)
        var devices = new Array();
        for(var light of host.lights) {
            var device = new Object();
            device.id = light.id;
            device.uid = light.uid;
            device.power = light.power
            devices.push(device);
        }
        res.status(200).json(devices);
      });

// Get the status for each light
router.route('/lights/:light_id')
    .get(function(req, res) {
        console.log("going to get the status for a specific light status")
        console.log("light_id: " + req.params.light_id)
        // We send a command to get the light status
        host.onUserCommand("light.getPower",  '{"id":"Light1"}')
        res.status(200).json({message: "got the status"})
    })
    .put(function(req, res) {
        console.log("it comes to put")
        console.log("uid: " + req.body.uid)
        console.log("light_id: " + req.params.light_id)
        res.status(200).json({message: "put the status"})
    });

router.route('/light/:light_id/:status')
    .get(function(req, res) {
        var light_id = req.params.light_id
        var status = (req.params.status == 1 ? "on" : "off")
        console.log("light_id: " + req.params.light_id)
        console.log("status: " + req.params.status)
        var data = '{"id":"{0}","operation":"{1}"}'.format(light_id, status)
        console.log("data: "　+ data);
        host.onUserCommand("light.power", data)
        res.status(200).json( { message: "setting the lights on/off"})
     });

router.route('/epid')
    .get(function(req, res) {
        res.status(200).json({epid: epid})
    });

router.route('/colors')
    .get(function(req, res) {
        console.log("it comes get here");
        // console.log("hue: " + req.param('hue'))
        // console.log("saturation: " + req.param('saturation'))
        // console.log("brightness: " + req.param('brightness'))
        // dataUtils.dumpProperties(req.params.hue)
        res.status(200).json( {message: "OK"})
    })
    .post(function(req, res) {
        console.log("it comes to the post")
        // dataUtils.dumpProperties(req.body)
        console.log("hue: " + req.body.hue)
        console.log("saturation： " + req.body.saturation)
        console.log("brightness: " + req.body.brightness)
        res.status(200).json( { message: "OK"})
    });



app.use('/api', router);

// app.use('/', routes);
app.use('/users', users);

app.use('/', function(req, res) {
  console.log("this is really cool")
  res.json({ message: 'hooray! welcome to use our light control APIs!' });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
