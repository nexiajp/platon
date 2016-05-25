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
var async    = require('async');
var isEmpty  = require('./isEmpty');
var isObject = require('./isObject');
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
    name: 'list',
    short: '',
    type : 'boolean',
    description :'View IPs List.',
    example: "'"+scriptname+" --list'"
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

var PingList = [];
var Exclude  = {};
var count    = 1;

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
    if (err) callback("Main func pingAliveChcek " + Gdns + ", err: " + err);
    else {

      JsonGet(Conf.IPsURL, function(err, res, body){
        if(err) callback(err);

        if(isEmpty(body.PingList)) PingList = [];
        else PingList = extend([], body.PingList);
        // debug("PingList: %s", JsonString(PingList));

        if(isEmpty(body.Exclude)) Exclude = {};
        else Exclude = extend({}, body.Exclude);
        // debug("Exclude: %s", JsonString(Exclude));

        PingListParse(function(err){});
      });


    }
  });

}

function PingListParse(callback) {

  var Exclude_Profile  = null;
  var Exclude_PublicIp = null;
  if( typeof Exclude.Profile  !== 'undefined' ) Exclude_Profile  = Exclude.Profile;
  if( typeof Exclude.PublicIp !== 'undefined' ) Exclude_PublicIp = Exclude.PublicIp;

  async.each(PingList, function(List, next) {
    if( Exclude_Profile.indexOf(List.Profile) >= 0 ) return next();

    async.each(List.EIPs, function(eip, done) {
      // debug("%s: %s", List.Profile, eip.PublicIp);
      if( Exclude_PublicIp.indexOf(eip.PublicIp) >= 0 ) return done();
      debug("pingAliveChcek Profile: %s, PublicIp: %s", List.Profile, eip.PublicIp)
      pingAliveChcek(eip.PublicIp, function(err, msg){
        if(!err) {
          debug("done PublicIp: %s", eip.PublicIp);
          done();
        } else {
          error(msg);
          // error("PingListParse pingAliveChcek err: %s", err);
          var AlertObj = {
            DateTime: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
            CheckHost: os.hostname(),
            Profile: List.Profile,
            FunctionName: List.FunctionName,
            PublicIp: eip.PublicIp,
            PublicDnsName: eip.PublicDnsName
          };
          AlertSend(AlertObj, function(err, res){
            if(err) error("PingListParse AlertSend err: %s", err);
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

  var ping = require("net-ping");
  var msg  = "Alive";

  // ping Default options
  var PingOptions = {
      networkProtocol: ping.NetworkProtocol.IPv4,
      packetSize: ( 64 + 12 ),
      retries: 3,
      sessionId: ( randomIntInc(2049, 6553) ),
      timeout: 2000,
      ttl: 128
  };

  var session = ping.createSession (PingOptions);

  session.pingHost (target, function (err, target) {
      if (err){
        if (err instanceof ping.RequestTimedOutError){
          msg = "Not alive. " + err.toString() + ", targert: " + target;
        }else{
          msg = err.toString() + ", target: " + target;
        }
        // error(msg);
      }
      session.close();
      callback(err, msg)
  });


  function randomIntInc (low, high) {
      return Math.floor(Math.random() * (high - low + 1) + low);
  }

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
