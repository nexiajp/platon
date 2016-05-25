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

function queryTable (query) {

  if(query === 'true'){
    var Index = null;
    var Query = 'platonIPcheck';
  } else {
    var Index = 'ProfileIndex';
    var Query = query;
  }

  PingAlert
    .query(Query)
    .usingIndex(Index)
    .ascending('Time')
    // .descending('Time')
    .loadAll()
    // .limit(opt['limit'])
    .exec(function(err, res){
    if(err) return error("Error: %s", err);

    var json  = JSON.stringify(res.Items);
    var Items = JSON.parse(json);

    log("PingAlert Items: %s", JsonString(Items));
  });

}
exports.QueryTable = queryTable;

function getItem (email) {

  PingAlert
    .scan()
    .where('Email').equals(email)
    .loadAll()
    .exec(function(err, res){
    if(err) return error("Error: %s", err);

    var json  = JSON.stringify(res.Items);
    var Items = JSON.parse(json);

    log("PingAlert Items: %s", JsonString(Items));
  });

}
exports.GetItem = getItem;

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
