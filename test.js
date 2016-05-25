var log     = console.log;
var error   = console.error;
var fs      = require('fs');
var request = require('request');
var async   = require('async');

var Conf = JSON.parse( fs.readFileSync( __dirname + '/.Conf-Ping.json', 'UTF-8' ) );
var DataObj = {};

var options = {
  url: Conf.IPsURL,
  headers: { 'User-Agent': 'curl' },
  json: true
};

request(options, function (err, res, body) {
  if (err || res.statusCode != 200) {
  	error("Error: " + err);
  	error("Status: %d", res.statusCode);
  }else{
    // log("IPsList: %s", JsonString(body));
    if( typeof body.PingList !== 'undefined' ){
      async.map(body.PingList, function (item, done) {
        // done(null, item.Profile);
        async.map(item.EIPs, function(eip, next){
          next(null, eip.PublicIp);
        }, function (err, results) {
          var obj = {};
          obj.Profile = item.Profile;
          obj.Eips    = results;
          done(null, obj);
        });
      }, function (err, results) {
        if (err) error(err);
        else log(JsonString(results));
      });
    }
  }
});

function JsonString(obj) {
  return JSON.stringify(obj, null, "    ");
}

function IPlistView(obj){
	for(var i in obj.IPs){
		log(obj.IPs[i]);
	}
	return true;
}
