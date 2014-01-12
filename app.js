var Tracker = require('./lib/tracker'),
    config = require('./config');

var t = new Tracker(config);
t.start();
console.log("Eutracker is now listening on", config.bind + ':' + config.port);
