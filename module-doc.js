'use strict';

var debug    = require('debug')('modDoc');
debug.log    = console.log.bind(console);
var error    = console.error;
var log      = console.log;

var isEmpty  = require('./isEmpty');
var moment   = require('moment');

var AWS  = require('aws-sdk');
var DOC  = require("dynamodb-doc");
var Conf = require('./.Conf-Srv.json').DynamoDB;
var credentials = new AWS.SharedIniFileCredentials(
  {
    filename: process.env.HOME + '/.aws/credentials',
    profile: Conf.profile
  }
);
AWS.config.credentials = credentials;
AWS.config.region = Conf.region;

var dynamodb  = new AWS.DynamoDB();
var docClient = new DOC.DynamoDB(dynamodb);

var modDynamoDB  = require("./module-dynamodb");

var PingAlert    = modDynamoDB.setSchemaPingAlert();
var ServiceAlert = modDynamoDB.setSchemaServiceAlert();

var opt = new Array();
for (var i=0, len = process.argv.length; i < len; i++) {
  opt[i] = process.argv[i];
}

if(opt[1].indexOf('module-doc.js') >= 0 && !isEmpty(opt[2]) ){

  var argv     = require('argv');
  argv.option([
    {
      name: 'query',
      short: 'q',
      type : 'int',
      description :'view dynamoDB query. -q < hours ago num >'
    },
    {
      name: 'table',
      short: 't',
      type : 'string',
      description :'dynamoDB TableName. -t [ ServiceAlert | PingAlert(defualt) ]'
    },
    {
      name: 'verbose',
      short: 'v',
      type : 'boolean',
      description :'query json view. -v'
    }
  ]);

  var args = argv.run();
  var opt  = args.options;
  var TableName = 'PingAlert'; // defualt

  if ( opt["help"] ){
    argv.help();
    process.exit(0);
  }

  if ( typeof opt["query"] !== 'undefiend' ) {
    var hour = isNaN(opt["query"]) ? 1 : opt["query"];
    if( typeof opt["table"] === 'undefined' ) {
      queryTable (hour, 'ServiceAlert');
      queryTable (hour, 'PingAlert');
    } else {
      TableName = opt["table"];
      queryTable (hour, TableName);
    }
  }

  return;

}


function queryTable (hour, TableName) {

  var serialTime = getSerialTime(hour);

  if ( TableName === "ServiceAlert" ) {

    ServiceAlert
      .query('ServiceCheck')
      .where('Time').gte(serialTime)
      .descending('Time')
      .limit(100)
      .exec( responseView );

  } else {

    PingAlert
      .query('platonIPcheck')
      .where('Time').gte(serialTime)
      .descending('Time')
      .limit(100)
      .exec( responseView );
  }


  function responseView(err, res){

    if(err) return error("%s, Res: %s", err, res);

    var json  = JSON.stringify(res.Items);
    var Items = JSON.parse(json);

    if   ( opt["verbose"] ) log("%s: %s", TableName, JsonString(Items));
    else if ( TableName === "ServiceAlert" ) {
      SortView(TableName, Items, ["DateTime", "CheckHost", "Profile", "AlertCount", "System", "Status"] );
    } else {
      SortView(TableName, Items, ["DateTime", "CheckHost", "Profile", "AlertCount", "PublicDnsName", "PublicIp"] );
    }

    // ObjectArraySort(Items, "DateTime", 'desc', function(err, data){
    //   if(err) return error(err);
    //
    //   if(opt["verbose"]) JsonLog({ Items: data });
    //   else SortView(data, ["DateTime", "Status", "System", "Note"] );
    // });

  }

  function getSerialTime (optValue) {

    var date = new Date();
    date.setHours(date.getHours() - parseInt(optValue));
    debug("date %s", date.toString());
    var serialTime = date.getTime();
    debug("date serialTime: %d", serialTime);

    return serialTime;

  }

}
exports.QueryTable = queryTable;

function SortView(TableName, arrData, map){
  var output = "Alert type : " + TableName + "\n";
  arrData.forEach( function( Item ){
    map.forEach ( function(key) {
      if ( typeof  Item[key] !== "undefined" ){
        if(key === 'CheckHost') output += zeroPadding(Item[key], 16) + "  ";
        else if (key === 'AlertCount') output += zeroPadding(Item[key], 3) + "  ";
        else if (key === 'Profile') output += zeroPadding(Item[key], 8) + "  ";
        else if (key === 'System') output += zeroPadding(Item[key], 30) + "\t";
        else if (key === 'PublicDnsName') output += zeroPadding(Item[key], 30) + "\t";
        else output += Item[key] + "\t";
      }
    });
    output += "\n";
  });
  log(output);

  function zeroPadding (n, len) {
    n = '' + n; //string cast
    return len + 1 - n.length > 0 ? n + Array(len + 1 - n.length).join(' ') : n;
  }
}


function putItem(Doc, TableName, callback){
  debug("DynamoDB.Document Table: %s, putItem Doc: %s", TableName, JsonString(Doc));

  try {
    var json = JSON.stringify(Doc);
    json = json.replace(/:\"\"/g, ':"Null"');
    var doc = JSON.parse(json);
  } catch (e) {
    return callback("modDoc putItem func Doc object error.", Doc);
  }

  doc.Time       = (new Date()).getTime();

  var params = {
      TableName : modDynamoDB.getTableName(TableName),
      Item      : doc
  };

  debug("params: %s", JsonString(params));
  modDynamoDB.createTable ( function(err) {
    if (err) {
      error("putItem func createTable");
      callback(err);
    } else {
      docClient.putItem(params, function(err, data) {
        if(!err) debug(data);
        callback(err);
      });
    }
  });
}
exports.PutItem = putItem;

function JsonLog(obj){
  return log(JsonString(obj));
}

function JsonString(obj) {
  return JSON.stringify(obj, null, "    ");
}
