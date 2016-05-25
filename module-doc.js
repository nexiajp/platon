'use strict';

var debug    = require('debug')('modDoc');
debug.log    = console.log.bind(console);
var error    = console.error;
var log      = console.log;

var isEmpty  = require('./isEmpty');
var moment   = require('moment');

var AWS = require('aws-sdk');
var DOC = require("dynamodb-doc");
var credentials = new AWS.SharedIniFileCredentials(
  {
    filename: process.env.HOME + '/.aws/credentials',
    profile: 'nexia-dynamodb'
  }
);
AWS.config.credentials = credentials;
AWS.config.region = "us-west-2"; //Oregon

var dynamodb  = new AWS.DynamoDB();
var docClient = new DOC.DynamoDB(dynamodb);

var modDynamoDB  = require("./module-dynamodb");

var Name      = 'IPcheck';
var IPcheck   = modDynamoDB.setSchemaIPcheck();
var TableName = modDynamoDB.getTableName( Name );

function queryTable (query) {

  if(query === 'true'){
    var Index = null;
    var Query = 'platonIPcheck';
  } else {
    var Index = 'ProfileIndex';
    var Query = query;
  }

  IPcheck
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

    log("%s Items: %s", Name, JsonString(Items));
  });

}
exports.QueryTable = queryTable;

function getItem (email) {

  MapDoc
    .scan()
    .where('Email').equals(email)
    .loadAll()
    .exec(function(err, res){
    if(err) return error("Error: %s", err);

    var json  = JSON.stringify(res.Items);
    var Items = JSON.parse(json);

    log("%s Items: %s", Name, JsonString(Items));
  });

}
exports.GetItem = getItem;

function putItem(Doc, callback){
  debug("DynamoDB.Document: putItem Doc: %s", JsonString(Doc));

  try {
    var json = JSON.stringify(Doc);
    json = json.replace(/:\"\"/g, ':"Null"');
    var doc = JSON.parse(json);
  } catch (e) {
    return callback("modDoc putItem func Doc object error.", Doc);
  }

  doc.Time       = (new Date()).getTime();

  var params = {
      TableName : TableName,
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
