var express = require("express"),
    app = express();
	
var bodyParser = require('body-parser');
app.use(bodyParser());

var port = process.env.PORT || 8080;

app.use(express.static(__dirname + '/public'));

app.get("/getData", function (request, response) {
  getStatus();
  response.end("");
});

app.listen(port);
console.log("Listening on port ", port);

var querystring = require('querystring');
var http = require('http');
var host = 'localhost';
var port = '8080';
var fs = require('fs');
var url = require('url');

// load the Cloudant library
var cloudant = {
	url : "https://489e7a61-7efa-4fd7-9eaf-b74213875cdb-bluemix:5295133feb3ed95bd58aa7325120a0ff10f1d10c8fef7d5d111e1495ae5109bd@489e7a61-7efa-4fd7-9eaf-b74213875cdb-bluemix.cloudant.com/"
};

var nano = require('nano')(cloudant.url);
var db = nano.db.use('resourceevaldb');

app.get('/searchbyappname', function(req, res) {
	var query = url.parse(req.url,true).query;
	var string = JSON.stringify(query);
    var objectValue = JSON.parse(string);
	var searchappname = 'applicationname:'+objectValue['applicationname'];
	db.search('searchByAppName', 'searchByAppName_index', {q:searchappname}, function(err, result) {
	  if (err) {
		res.json({err:err});
	  }
	  res.send(JSON.stringify(result));
	});
});

app.get('/getincident', function(req, res) {
	var query = url.parse(req.url,true).query;
	var string = JSON.stringify(query);
    var objectValue = JSON.parse(string);
	
	db.get(objectValue['id'], function(err, data) {
		if (!err) {
			res.send(JSON.stringify(data));
		} else {
			res.json({err:err});
		}
	});
});

app.get('/getincidents', function(req, res) {
	db.view('application_name', 'application_name_index', function(err, body) {
	  if (!err) {
		var issues = [];
		  body.rows.forEach(function(doc) {
			issues.push(doc.value);           
		  });
		  res.send(JSON.stringify(issues));
		} else {
		  res.json({err:err});
		}
	  });
});

app.get('/deleteincident', function(req, res) {
	
	var query = url.parse(req.url,true).query;
	var string = JSON.stringify(query);
    var objectValue = JSON.parse(string);
	var id = objectValue['id'] || "";

	if (id != "") {
		db.get(id, function(err, data) {
			if (err) {
				res.json({err:err});
				return;
			}
			
			var doc = data;
			db.destroy(doc._id, doc._rev, function(err, data) {
				if (err) {
					console.log({err:err});
					res.setHeader('Content-Type', 'text/html');
					return res.redirect('/failure.html');
				}
				
				res.setHeader('Content-Type', 'text/html');
				return res.redirect('/success.html');
			});
		});
	} else {
		res.json({err:"Please specify an id or _id to delete a document"});
	}
});
 
app.post('/savedata', function(req, res) {
  var string = JSON.stringify(req.body);
  
  var doc = JSON.parse(string);
  var id = req.query._id || req.query.id || req.body._id || req.body.id || "";
  if (id) {
		doc._id = id;
		update(req, res);
  } else {
		for (var key in req.body) {
			if (key === "_id" || key === "id") continue;
			doc[key] = req.body[key]
		}
		for (var key in req.query) {
			if (key === "_id" || key === "id") continue;
			doc[key] = req.query[key]
		}
		
		db.insert(doc, function(err, data) {
			if (err) {
				res.end('{\"msg\": \"ERROR\"}');
			}
			res.end('{\"msg\": \"OK\"}');
		});
  }
});

function update(req, res) {
	var doc = req.body['data'];
	console.log("body ", doc);
	
	var id = req.query._id || req.query.id || req.body._id || req.body.id || "";
	var isNew = false;
	if (id != "") {
		db.get(id, function(err, data) {
			if (err) {
				if (err.statusCode == 404) {
					isNew == true;
				} else {
					res.json({err:err});
					return;
				}
			}

			var old_doc = {};
			var doc = {};
			if (isNew) {
				doc._id = id;
			} else {
				old_doc = data;
				doc = data;
			}
			
			for (var key in req.body) {
				if (key === "_id" || key === "id") continue;
				doc[key] = req.body[key];
			}
			for (var key in req.query) {
				if (key === "_id" || key === "id") continue;
				doc[key] = req.query[key];
			}
			
			// use insert to modify existing doc by id, if there's any,
			// otherwise it'll create new doc
			db.insert(doc, function(err, data) {
				if (err) {
					res.json({err:err});
					return;
				}
	
				res.setHeader('Content-Type', 'text/html');
				return res.redirect('/success.html');
			});
		});
	} else {
		console.log({err:err});
		res.setHeader('Content-Type', 'text/html');
		return res.redirect('/failure.html');
	}
};

function generateId() {
	return "ID#" + Math.floor(Math.random()*10000);
}


function performRequest(endpoint, method, data, success) {
  var dataString = JSON.stringify(data);
  var headers = {};
  
  if (method == 'GET') {
    endpoint += '?' + querystring.stringify(data);
  }
  else {
    headers = {
      'Content-Type': 'application/json',
      'Content-Length': dataString.length
    };
  }
  var options = {
    host: host,
	port: port,
    path: endpoint,
    method: method,
    headers: headers
  };

  var req = http.request(options, function(res) {
    res.setEncoding('utf-8');

    var responseString = '';

    res.on('data', function(data) {
      responseString += data;
    });

    res.on('end', function() {
      var responseObject = JSON.parse(responseString);
      success(responseObject);
    });
  });

  req.write(dataString);
  req.end();
}

function getStatus() {
  performRequest('/status.json', 'GET', {
    "_items_per_page": 100
  }, function(data) {
    console.log('Fetched ' + data.result);
  });
}