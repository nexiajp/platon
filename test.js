var log     = console.log;
var errlog  = console.error;
var fs      = require('fs');
var request = require('request');

var Conf = JSON.parse( fs.readFileSync( __dirname + '/.Config.json', 'UTF-8' ) );

request(Conf.Ping[0].JsonURL, function (err, res, body) {
  if (err || res.statusCode != 200) {
  	errlog("Error: " + err);
  	errlog("Status: %d", res.statusCode);
  }else{
  	log(body);
  }
});
  
//log(JSON.stringify(Conf, null, "    "));
