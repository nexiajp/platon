'use strict';

var DefaultTable = 'trackerbeacons';
var isEmpty = require('./isEmpty');
var debug   = require('debug')('on');
debug.log   = console.log.bind(console);
var log     = console.log;
var error   = console.error;
var argv    = require('argv');
var fs      = require('fs');
var async   = require('async');
var AWS     = require('aws-sdk');

var Conf = require('./.Conf-Srv.json').DynamoDB;
var credentials = new AWS.SharedIniFileCredentials(
  {
    filename: process.env.HOME + '/.aws/credentials',
    profile: Conf.profile
  }
);
AWS.config.credentials = credentials;
AWS.config.update({ region: Conf.region });

var opt = {apiVersion: '2012-08-10'};
var dynamodb = new AWS.DynamoDB(opt);

var modDynamoDB  = require("./module-dynamodb");

var PingAlert    = modDynamoDB.setSchemaPingAlert();
var ServiceAlert = modDynamoDB.setSchemaServiceAlert();

var scriptname = ( process.argv[ 1 ] || '' ).split( '/' ).pop();
argv.option([
  {
   name: 'verbose',
   short: 'v',
   type : 'string',
   example: 'Verbose mode or debug print. '+scriptname+" -v or --verbose'"
  },
  {
    name: 'createTable',
    short: '',
    type : 'string',
    example: "Create Table. "+scriptname+" --createTable='new tableName'"
  },
  {
    name: 'deleteTable',
    short: '',
    type : 'string',
    description : 'Delete Table (Item All Data).',
    example: scriptname+" --deleteTable='tableName'"
  },
  {
    name: 'listTables',
    short: '',
    type : 'boolean',
    example: 'Tables list. '+scriptname+" --listTables"
  },
  {
    name: 'describeTable',
    short: '',
    type : 'string',
    example: 'Table describe. '+scriptname+" --describeTable='tableName'"
  }
]);

var args = argv.run();
if (Object.keys(args.options).length < 1){
  error("option nothing!!");
  argv.help();
  process.exit(1);
}
var tableName = getTableName(args);
if (args.options.help || args.options.verbose) showTableName(tableName);

var op = OptionPase(args.options);

function OptionPase(opt){
  var keys = Object.keys(opt);
  var None = ['verbose', 'table', 'title', 'input', 'file'];
  var params = {};
  for(var i in None){
    var n = None[i];
    params[n] = opt[n];
  }
  (function next(x){
    if(None.indexOf(keys[x]) === -1)
      Main(keys[x], params);
    if(keys.length === ++x) return;
    next(x);
  })(0);
}

function Main(key, params){
  var opt = args.options;
  debug("funcMain: %s", key);

  switch (key){
    case 'createTable':
      if(opt.createTable.toString() === 'true'){
        error("Item filter title not found. --createTable='tableName'");
      }else{
        createTable(opt.createTable);
      }
      break;

    case 'listTables':
      listTables();
      break;

    case 'describeTable':
      describeTable(opt.describeTable);
      break;

    case 'deleteTable': // delete tabel
      if(opt.deleteTable === 'true'){
        error("Delete Table Name is not found.", "--deleteTable='tableName'");
      }else{
        deleteTable(opt.deleteTable);
      }
      break;

  }
}

function createTable(tableName){
  debug("Func: createTable");
  var params = {
    TableName : tableName,
    KeySchema: [
        { AttributeName: "Primary", KeyType: "HASH"},  //Partition key
        { AttributeName: "Time", KeyType: "RANGE" }  //Sort key
    ],
    AttributeDefinitions: [
        { AttributeName: "Time", AttributeType: "N" },
        { AttributeName: "Primary", AttributeType: "S" }
    ],
    ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
    }
  };
  dynamodb.createTable(params, printResult);
}

function getTableName(obj){
  debug("Func: getTableName");
  var tableName;
  if(typeof obj.options.table === 'undefined' ){
    tableName = DefaultTable;
  }else{
    tableName = obj.options.table;
  }
  return tableName;
}

/* delete table function */
function deleteTable(tableName){
  var params = {
    TableName: tableName,
  };
  dynamodb.deleteTable(params, printResult);
}

function ErrMsg(err, text){
  var msg = "Error: " + err;
  if(text) msg += "\n" + text;
  log(msg);
}

function JsonString(obj){
  return JSON.stringify(obj, null, "    ");
}

/*
 * list tabels
 */
function listTables(){
  debug("listTables");
  var TableList = new Array();
  var params = {
    Limit: 20
  };

  var loop = 0;
  async.whilst(
    function () { return loop < 1; },
    function (done) {

      dynamodb.listTables(params, function(err, data){
        // if(err) error(err);
        if( typeof data.TableNames !== 'undefined' && data.TableNames.length > 0 ){
          Array.prototype.push.apply(TableList, data.TableNames);
        }

        if( typeof data.LastEvaluatedTableName === 'undefined' ) loop = 1;
        else params.ExclusiveStartTableName = data.LastEvaluatedTableName;

        done();
      });

    },
    function(err){
      if (err) log(JsonString(err));
      else log(JsonString({ TableNames: TableList }));
    }
  );

}

/*
 * describe Table
 */
function describeTable(tableName){
  var params = {
    TableName: tableName
  };
  dynamodb.describeTable(params, printResult);
}

/*
 * APIの戻り値を表示するためのヘルパー関数
 */
function printResult(err, data) {
  if (err) log(JsonString(err));
  else log(JsonString(data));
}

function scanTable(tableName){
  var params = {
    TableName: tableName,
    Select: "ALL_ATTRIBUTES"
  };
  dynamodb.scan(params, printResult);
}

function DebugPrint(s){
  if (args.options.verbose) return log(s);
}

function dataFileRead(path){
  var text = new String();
  try{
    text = fs.readFileSync( path, 'UTF-8' );
  }catch(e){
    error("DoNot file read. path: %s, e: %s ", path, e);
    text = null;
  }
  return text;
}

function isType(data){
  var type = typeof(data);
  if(type === 'object') return "object";
  if(type === 'undefined') return "undefined";
  if(type === 'string'){
    if(data.match(/^<\?xml/)) return "xml";
    try {
      var obj = JSON.parse(data);
      return "json";
    } catch (e) {
      return "text";
    }
  }else{
    return "unknown"
  }
}

function showTableName(tableName){
  log("tableName: " + tableName);
}
