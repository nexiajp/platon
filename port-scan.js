'use strict';

var log   = console.log;
var error = console.error;

var portscanner = require('portscanner')

portscanner.checkPortStatus(995, 'bizmo.jp', function(err, status) {
  if(err) error(err);
  // Status is 'open' if currently in use or 'closed' if available
  log("status: %s", status);
});
