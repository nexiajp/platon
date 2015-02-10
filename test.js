var log     = console.log;
var errlog  = console.error;
var fs      = require('fs');
var request = require('request');

var Conf = JSON.parse( fs.readFileSync( __dirname + '/.Config.json', 'UTF-8' ) );
var DataObj = {};

request(Conf.Ping[0].JsonURL, function (err, res, body) {
  if (err || res.statusCode != 200) {
  	errlog("Error: " + err);
  	errlog("Status: %d", res.statusCode);
  }else{
  	//log(body);
  	DataObj.ec2IPs = JSON.parse(body).ec2IPs;
  	var obj = {IPs: []};
  	for(var i in DataObj.ec2IPs){
  		for(var j in DataObj.ec2IPs[i].EIPs)
  			obj.IPs.push(DataObj.ec2IPs[i].EIPs[j].PublicIp);
  	}
  	log(JSON.stringify(obj, null, "    "));
  	var ret = IPlistView(obj);
  }
});

function IPlistView(obj){
	for(var i in obj.IPs){
		log(obj.IPs[i]);
	}
	return true;
}
