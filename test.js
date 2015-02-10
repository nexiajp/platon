var log     = console.log;
var fs      = require('fs');

var Conf = JSON.parse( fs.readFileSync( __dirname + '/.Config.json', 'UTF-8' ) );

log(JSON.stringify(Conf, null, "    "));
