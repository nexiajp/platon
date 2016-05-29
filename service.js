'use strict';

// sudo setcap cap_net_raw+ep $(which node)
// sudo getcap $(which node)

var Conf  = require('./.Conf-Service.json');
var Gdns  = '8.8.8.8';

var debug = require('debug')('on');
debug.log = console.log.bind(console);
var error = console.error;
var log   = console.log;

var extend   = require('util')._extend;
var fs       = require('fs');
var dns      = require('dns');
var request  = require('request');
var async    = require('async');
var isEmpty  = require('./isEmpty');
var isObject = require('./isObject');
var argv     = require('argv');
var os       = require("os");
var moment   = require('moment');
var evilscan = require('evilscan');

var scriptname = ( process.argv[ 1 ] || '' ).split( '/' ).pop();

// var Conf = JSON.parse( fs.readFileSync( __dirname + '/.Conf-Service.json', 'UTF-8' ) );
if(!isObject(Conf)) return;

argv.option([
  {
    name: 'view',
    short: 'v',
    type : 'boolean',
    description :'Checking IPs Json View.',
    example: "'"+scriptname+" -v'"
  },
  {
    name: 'json',
    short: 'j',
    type : 'boolean',
    description :'View IPs Json List.',
    example: "'"+scriptname+" --json' or '"+scriptname+" -j'"
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
    description :'check Loop Time Waite second. ( 120 = 2min )',
    example: "'"+scriptname+" --time=60' or '"+scriptname+" -t 60'"
  }
]);

var args = argv.run();
var opt  = args.options;

if (Object.keys(opt).length < 1 || opt["help"] ){
  argv.help();
  process.exit(0);
}

if(typeof opt["view"] !== 'undefined') return log("Conf-Service: %s", JsonString(Conf));
var Profile  = opt["profile"] ? opt["profile"] : null;
var LoopTime = opt["time"] ? ( opt["time"] * 1000 ) : Conf.LoopTime;
var Loop     = isNaN(opt["loop"]) ? Conf.LoopCount : opt["loop"];

var ServiceList = [];
var Exclude  = {};
var count    = 0;

(function loop(){
  count++;
  // debug("count: %d, LoopTime: %d", count, LoopTime);

  var M = Main(function(err){
    if(err) error("Main err: %s", err);
    debug("Main Func end. count: %d", count);
    if( Loop > 0 && Loop <= count ) process.exit(0);
    if( count > 999) count = 1;
    if ( global.gc ) global.gc();
  });

  setTimeout(loop, LoopTime);
})();

function Main(callback){

  pingAliveChcek(Gdns, function(err, msg){
    if (err) callback("Main func pingAliveChcek " + Gdns + ", err: " + err);
    else {

      JsonGet(Conf.ListURL, function(err, res, body){

        if(err) return callback(err);

        if(isEmpty(body.ServiceList)) ServiceList = [];
        else ServiceList = extend([], body.ServiceList);

        if(isEmpty(body.Exclude)) Exclude = {};
        else Exclude = extend({}, body.Exclude);

        if ( typeof opt["json"] !== 'undefined' ) {
          viewCheckingJson(function(err){
            process.exit(0);
          });
        } else {
          ServiceListParse(function(err){
            callback(err);
          });
        }

      });


    }
  });

}

function viewCheckingJson(callback){
  if ( Profile ) {
    async.map(ServiceList, function(List, done) {
      if(List.Profile === Profile) log("PingList: %s", JsonString(List));
      done();
    }, function(err, results) {
      callback(null);
    });
  } else {
    log("PingList: %s", JsonString(ServiceList));
    log("Exclude: %s", JsonString(Exclude));
    callback(null);
  }
}

function ServiceListParse(callback) {

  var Exclude_Profile  = null;
  if( typeof Exclude.Profile  !== 'undefined' ) Exclude_Profile = Exclude.Profile;

  async.each(ServiceList, function(List, next) {
    if( Exclude_Profile.indexOf(List.Profile) >= 0 ) return next();

    if (Profile) {
      if( Profile !== List.Profile) return next();
    }


    async.series([
      function(done){
        if( typeof List.WEB !== 'undefined' ) {
          webCheck(List, function(err) {
            done();
          });
        }
        else done();
      },
      function(done){
        if( typeof List.Other !== 'undefined' ) {
          portCheck(List, function(err) {
            done();
          });
        }
        else done();
      }
    ], function(err, results) {
      next();
    });

  },
  function(err){
    callback();
  });


}

function portCheck(List, callback){

  var Other = List.Other;

  async.each(Other, function(item, done) {
    if( item.Disable === true ) return done();

    var Host = item.Host;

    async.each(item.Port, function(p, next) {

      debug("portListenChcek Profile: %s, Port: %d", List.Profile, p);

      portListenChcek(Host, p, function(err, status, Host, port){
        if ( !err && status === 'open' ) {
          debug("portListenChcek done. status=%s, Host: %s, Port: %d", status, Host, port);
          next();
        } else {
          error("portListenChcek Host: %s, Port: %d, err: %s", Host, port, err);
          var AlertObj = {
            DateTime: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
            CheckHost: os.hostname(),
            Profile: List.Profile,
            FunctionName: List.FunctionName,
            System: item.System + ' ' + item.Host,
            Target: item.Host + ':' + port,
            Status: status
          };
          AlertSend(AlertObj, function(err, res){
            if(err) error("portCheck AlertSend err: %s", err);
            next();
          });
        }
      });

    },
    function(err) {
      done();
    });

  },
  function (err) {
    callback();
  });


}

function webCheck(List, callback){
  var WEB = List.WEB;
  var Exclude_URL = null;
  if( typeof Exclude.URL !== 'undefined' ) Exclude_URL = Exclude.URL;

  async.each(WEB, function(item, done) {
    if( item.Disable === true ) return done();
    if( Exclude_URL.indexOf(item.URL) >= 0 ) return done();

    debug("httpAliveChcek Profile: %s, URL: %s", List.Profile, item.URL);

    httpAliveChcek(item.URL, function(err, res, url){
      if(!err) {
        debug("done URL: %s", url);
        done();
      } else {
        error("err: %s", url);
        error(err);
        var AlertObj = {
          DateTime: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
          CheckHost: os.hostname(),
          Profile: List.Profile,
          FunctionName: List.FunctionName,
          System: item.System,
          Target: url,
          Status: "statusCode: " + res.statusCode
        };
        AlertSend(AlertObj, function(err, res){
          if(err) error("webCheck AlertSend err: %s", err);
          done();
        });
      }
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

function portListenChcek (Host, port, cb) {
  var status = null;

  dns.resolve4(Host, function(err, addr){
    if (err) return cb(err, "portListenChcek dns.resolve4 error", Host, port);

    var options = {
      target  : addr.toString().trim(),
      port    : port.toString(),
      status  : 'TROU', // Timeout, Refused, Open, Unreachable
      timeout : 5000,
      banner  : false,
      geo     : false
    };

    var Err, item;
    var scanner = new evilscan(options);


    scanner.on('result',function (data) {
      item = data;
    });

    scanner.on('error',function (err) {
      if(err) {
        error("portListenChcek port scanner Err: %s", new Error(data.toString()) );
        Err = err;
      }
    });

    scanner.on('done',function () {
      debug("port scanner finished");

      if (Err) {
        error("Err: %s", Err);
      } else if ( typeof item !== "undefined" && typeof item.status !== "undefined" ) {
        debug("item: %s", JsonString(item));
        status = item.status;
      } else {
        status = "undefined";
      }

      cb(Err, status, Host, port);
    });

    scanner.run();

  });

}

function httpAliveChcek (url, cb) {
  var headers;
  headers = {
    'User-Agent': 'curl'
  };
  request.get({
    url: url,
    headers: headers
  }, function(err, res, body) {
    if ( typeof res === 'undefined' || typeof res.statusCode === 'undefined' ) {
      var res = {};
      res.statusCode = 'Response nothing.';
    }
    if (err) cb(err, res, url);
    else if (res.statusCode !== 200) cb('statusCode: ' + res.statusCode, res, url);
    else cb(err, res, url);
  });
}

function JsonGet (url, cb) {
  var headers;
  headers = {
    'User-Agent': 'curl'
  };
  request.get({
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
