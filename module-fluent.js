'use strict';

var debug   = require('debug')('modFluent');
debug.log   = console.log.bind(console);
var error   = console.error;
var log     = console.log;

var fluent  = require('fluent-logger');
var TopTag  = 'platon';

var logger  = fluent.createFluentSender( TopTag, {
   host: 'localhost',
   port: 24224,
   timeout: 3.0,
   reconnectInterval: 600000 // 10 minutes
});

function emitFluent (label, item) {
  debug("Fluent logger emit label: %s, item: %s", label, JsonString(item));
  logger.emit(label, item);
}
exports.EmitFluent = emitFluent;

function JsonString(obj){
  return JSON.stringify(obj, null, "    ");
}
