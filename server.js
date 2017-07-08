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
	url : "https://593e00b0-15f0-448b-a896-4db1c9594e6f-bluemix:7bee821c0fa16611c47d5abb43a38bd3316d1f5819d6d15361cd8213c6e8345e@593e00b0-15f0-448b-a896-4db1c9594e6f-bluemix.cloudant.com/"
};

var nano = require('nano')(cloudant.url);
var db = nano.db.use('apmmincident');

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
 
app.post('/saveincidents', function(req, res) {
  var applicationname = req.body.applicationname;
  var server = req.body.server;
  var issuedesc = req.body.issuedesc;
  var impact = req.body.impact;
  var status = req.body.status;
  var eta = req.body.eta;
  var raisedby = req.body.raisedby;
  var contact = req.body.contact;
  var respteam = req.body.respteam;
  var personassigned = req.body.personassigned;
  var comments = req.body.comments;
  var refissueid = req.body.refissueid;
  
  var id = req.query._id || req.query.id || req.body._id || req.body.id || "";
  console.log('id = '+id);
  console.log('Fetched ' + applicationname);
	
  var doc = { 'applicationname': applicationname, 'server' : server, 
				'issuedesc': issuedesc, 'impact' : impact, 
				'status': status, 'eta' : eta, 
				'raisedby': raisedby, 'contact' : contact, 
				'respteam': respteam, 'personassigned' : personassigned, 
				'comments': comments, 'date': new Date(),
				'issueid': generateId(), 'refissueid': refissueid};

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
			console.log({err:err});
			res.setHeader('Content-Type', 'text/html');
			return res.redirect('/failure.html');
		}
		//res.json({doc:doc,data:data});
		res.setHeader('Content-Type', 'text/html');
		return res.redirect('/success.html');

		});
  }
});

function update(req, res) {
	var applicationname = req.body.applicationname;
	var server = req.body.server;
	var issuedesc = req.body.issuedesc;
	var impact = req.body.impact;
	var status = req.body.status;
	var eta = req.body.eta;
	var raisedby = req.body.raisedby;
	var contact = req.body.contact;
	var respteam = req.body.respteam;
	var personassigned = req.body.personassigned;
	var comments = req.body.comments;
	var refissueid = req.body.refissueid;
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
			doc.applicationname = applicationname;
			doc.server = server;
			doc.issuedesc = issuedesc;
			doc.impact = impact;
			doc.status = status;
			doc.eta = eta;
			doc.raisedby = raisedby;
			doc.contact = contact;
			doc.personassigned = personassigned;
			doc.respteam = respteam;
			doc.comments = comments;
			doc.refissueid = refissueid;
			doc.date = new Date();
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