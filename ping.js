'use strict';

var Conf  = require('./.Conf-Srv.json');
var Gdns  = '8.8.8.8';

var debug = require('debug')('PING');
debug.log = console.log.bind(console);
var error = console.error;
var log   = console.log;

var extend   = require('util')._extend;
var fs       = require('fs');
var request  = require('request');
var isEmpty  = require('./isEmpty');
var isObject = require('./isObject');
var ping     = require("net-ping");
var argv     = require('argv');
var os       = require("os");
var moment   = require('moment');

var scriptname = ( process.argv[ 1 ] || '' ).split( '/' ).pop();


var Conf = JSON.parse( fs.readFileSync( __dirname + '/.Conf-Ping.json', 'UTF-8' ) );
if(!isObject(Conf)) return;

argv.option([
  {
    name: 'view',
    short: 'v',
    type : 'boolean',
    description :'Confing Json View.',
    example: "'"+scriptname+" -v'"
  },
  {
    name: 'profile',
    short: 'p',
    type : 'string',
    description :'Ping List Filter as Profile Name.',
    example: "'"+scriptname+" --profile=value' or '"+scriptname+" -p value'"
  },
  {
    name: 'loop',
    short: 'l',
    type : 'int',
    description :'loop on . 0 is loop,  not loop count.',
    example: "'"+scriptname+" --loop=0' or '"+scriptname+" -l 3'"
  },
  {
    name: 'time',
    short: 't',
    type : 'int',
    description :'check Loop Time Wate Minute.',
    example: "'"+scriptname+" --time=10' or '"+scriptname+" -t 10'"
  }
]);

var args = argv.run();
var opt  = args.options;

if (Object.keys(opt).length < 1 || opt["help"] ){
  argv.help();
  process.exit(0);
}

if(typeof opt["view"] !== 'undefined') return log("Conf-Ping: %s", JsonString(Conf));
var Profile  = opt["profile"] ? opt["profile"] : null;
var LoopTime = opt["time"] ? opt["time"] : Conf.LoopTime;
var Loop     = opt["loop"] ? opt["loop"] : Conf.Loop;

// ping Default options
var PingOptions = {
    networkProtocol: ping.NetworkProtocol.IPv4,
    packetSize: 16,
    retries: 10,
    sessionId: (process.pid % 65535),
    timeout: 15000,
    ttl: 128
};

var IPsList = {};
var Exclude = {};

(function loop(){
  log("count: %d", count);

  var M = Main(function(err){
    if(err) error("Main err: %s", err);
    if( count++ > 999) count = 1;
  });

  setTimeout(loop, LoopTime);
})();

function Main(callback){


  pingAliveChcek(Gdns, function(err, msg){
    if (err) callback("Main func pingAliveChcek err: " + err);
    else {

      JsonGet(Conf.IPsList, function(err, res, body){
        if(err) callback(err);

        if(isEmpty(body.PingList)) PingList = {};
        else PingList = extend([], body.PingList);

        if(isEmpty(body.Exclude)) Exclude = {};
        else Exclude = extend({}, body.Exclude);

        IPsListParse(function(err){});
      });


    }
  });

}

function IPsListParse(callback) {

  var Exclude-Profile  = null;
  var Exclude-PublicIp = null;
  if( typeof Exclude.Profile  !== 'undefined' ) Exclude-Profile  = Exclude.Profile;
  if( typeof Exclude.PublicIp !== 'undefined' ) Exclude-PublicIp = Exclude.PublicIp;

  async.each(PingList, function(List, next) {
    if( Exclude-Profile.indexOf(List.Profile) < 0 ) return next();

    async.each(List.EIPs, function(eip, done) {
      debug("%s: %s", List.Profile, eip.PublicIp);
      if( Exclude-PublicIp.indexOf(eip.PublicIp) < 0 ) return done();
      pingAliveChcek(eip.PublicIp, function(err, msg){
        if(!err) done();
        else {
          error("IPsListParse pingAliveChcek err: %s", err);
          error("msg: %s", msg);
          var AlertObj = {
            DateTime: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
            CheckHost: os.hostname(),
            Profile: List.Profile,
            FunctionName: List.FunctionName,
            PublicIp: eip.PublicIp,
            PublicDnsName: eip.PublicDnsName
          };
          AlertSend(AlertObj, function(err, res){
            if(err) error("IPsListParse AlertSend err: %s", err);
            done();
          });
        }
      });

    },
    function(err){
      next();
    });

  },
  function(err){
    callback();
  });


}

function pingAliveChcek (target, callback){

  var msg  = null;

  var session = ping.createSession (PingOptions);

  session.pingHost (target, function (err, target) {
      if (err){
        if (err instanceof ping.RequestTimedOutError){
          msg = "Not alive. " + err.toString() + ", targert: " + target;
        }else{
          msg = err.toString() + ", target: " + target;
        }
        error(msg);
      } else {
        msg = "Alive";
      }
      callback(err, msg)
  });

}

function JsonGet (url, cb) {
  var headers, get;
  headers = {
    'User-Agent': 'curl'
  };
  get = request.get({
    url: url,
    headers: headers,
    json: true
  }, function(err, res, body) {
    if(err) cb(err, res, "JsonGet func error.");
    else if (res.statusCode !== 200) cb('Error Respons statusCode.', res, body);
    else cb(err, res, body);
  });
}

//
// function JsonGet(url, cb){
//   var options = {
//     url: url,
//     headers: { 'User-Agent': 'curl' }
//   };
//   request(options, function (err, res, body) {
//     if (err || res.statusCode != 200) {
//       error(": %s" + err);
//       error("Status: %d", res.statusCode);
//       return cb(err,body);
//     }
//     return cb(null, body);
//   });
// }

function AlertSend(AlertObj, cb){
  var Params = {
    uri:  Conf.AlertURL,
    form: AlertObj,
    json: true
  };
  request.post(Params, function(err, res, body){
    if (!err && res.statusCode == 200) {
      cb(null, body);
    } else {
      cb(err,'Error: '+ res.statusCode + ".\n" + body);
    }
  });
}

function JsonString(obj) {
  return JSON.stringify(obj, null, "    ");
}
