'use strict';

var log   = console.log;
var error = console.error;

var portscanner = require('portscanner');

var port = 25;

var options = {
  host: "bizmo.jp",
  timeout: 5000
};

portscanner.checkPortStatus(port, options, function(err, status) {
  if(err) error(err);
  // Status is 'open' if currently in use or 'closed' if available
  log("status: %s", status);
});
