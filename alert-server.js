var log  = console.log;
var http = require('http');

http.createServer(function (req, res) {
  if (req.url === '/platon/alert' && req.method=='POST') {
    //log(req.headers);
    var body = '';
    req.on('data', function (dat) {
      body +=dat;
    });
    req.on('end',function(){
      try {
        var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        if ( body.toString().match( /^{.*}$/ ) ) {
          var obj = JSON.parse(body);
        } else {
          log("content-type : Not Json");
          var data = require('url').parse( '/?' + body.toString() , true );
          //log(data);
          var obj = data.query;
        }
        if (! obj.Alert) {
          log("%s - Error Not Implemented. %s", (new Date()), ip);
          res.writeHead(501, {'Content-Type':'application/json; charset=utf-8'});
          res.end('{"result":"Error Not Implemented"}\n');
        } else {
          log("%s - Platon Alert Request POST. %s", (new Date()), ip);
          text = JSON.stringify(obj, null, "    ");
          log(text);
          //res.writeHead(200, {'Content-Type': 'text/plain'});
          res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
          res.end('{"result":"Alert POST OK"}\n');
        }
      } catch (e) {
        console.log(e);
        log("%s - 406 Not Acceptable. %s", (new Date()), ip);
        log(body);
        res.writeHead(406, {'Content-Type':'application/json; charset=utf-8'});
        res.end('{"result":"406 Not Acceptable."}\n');
      }
    });
  }else{
    res.writeHead(403, {'Content-Type': 'text/plain'});
    res.end('403 Forbidden\n');
  }
}).listen(9090);

/*
 **** test command *****
 $ curl -H "Accept: application/json" -H "Content-type: application/json" -X POST -d "sender=curl" -d "Alert=aaaa"  http://localhost:9090/platon/alert
 $ curl -H "Accept: application/json" -H "Content-type: application/json" -X POST -d "sender=curl" -d "alert=aaaa"  http://localhost:9090/platon/alert
 $ curl -H "Accept: application/json" -H "Content-type: application/json" -X POST -d "@/tmp/alert.json"  http://localhost:9090/platon/alert
 $ curl -H "Accept: application/json" -H "Content-type: application/json" -X POST -d "@/tmp/test.json"  http://localhost:9090/platon/alert
 *****
 */
