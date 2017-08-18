var url = require('url');
var cfenv = require("cfenv");
var admindb;
var cloudant;
var dbCredentials = {
    dbName: 'resourceadmindb'
};
var fs = require('fs');
var path = require('path');

function getDBCredentialsUrl(jsonData) {
    var vcapServices = JSON.parse(jsonData);
    for (var vcapService in vcapServices) {
        if (vcapService.match(/cloudant/i)) {
            return vcapServices[vcapService][0].credentials.url;
        }
    }
}

function initDBConnection() {
    if (process.env.VCAP_SERVICES) {
        dbCredentials.url = getDBCredentialsUrl(process.env.VCAP_SERVICES);
    } else {
        dbCredentials.url = getDBCredentialsUrl(fs.readFileSync("./config/vcaplocal.json", "utf-8"));
    }

    cloudant = require('cloudant')(dbCredentials.url);
    cloudant.db.create(dbCredentials.dbName, function(err, res) {
        if (err) {
            console.log('Could not create new db: ' + dbCredentials.dbName + ', it might already exist.');
        }
    });
    admindb = cloudant.use(dbCredentials.dbName);
}

initDBConnection();

//app.get('/getskills', function(req, res) {
exports.getskills = function(req, res) {
	var query = 'datatype:skills';
	admindb.search('attributes', 'by_name_value', {include_docs:true, q:query}, function(err, result) {
	  if (err) {
		res.json({err:err});
	  }
	  res.send(JSON.stringify(result));
	});
};

//app.get('/getRatings', function(req, res) {
exports.getRatings = function(req, res) {
	var query = 'datatype:rating';
	admindb.search('attributes', 'by_name_value', {include_docs:true, q:query}, function(err, result) {
	  if (err) {
		res.json({err:err});
	  }
	  res.send(JSON.stringify(result));
	});
};

//app.get('/getEvaluators', function(req, res) {
exports.getEvaluators = function(req, res) {
	var query = 'datatype:evaluator';
	admindb.search('attributes', 'by_name_value', {include_docs:true, q:query}, function(err, result) {
	  if (err) {
		res.json({err:err});
	  }
	  res.send(JSON.stringify(result));
	});
};

//app.post('/saveadmin', function(req, res) {
exports.saveadmin = function(req, res) {
  var string = JSON.stringify(req.body);
  var doc = JSON.parse(string);
  var id = req.query._id || req.query.id || req.body._id || req.body.id || "";
  if (id) {
		doc._id = id;
		updateAdmin(req, res);
  } else {
		for (var key in req.body) {
			if (key === "_id" || key === "id") continue;
			doc[key] = req.body[key]
		}
		for (var key in req.query) {
			if (key === "_id" || key === "id") continue;
			doc[key] = req.query[key]
		}
		
		admindb.insert(doc, function(err, data) {
			if (err) {
				console.log({err:err});
				res.end('{\"msg\": \"ERROR\"}');
			}
			res.end('{\"msg\": \"OK\"}');
		});
  }
};

function updateAdmin(req, res) {
	var id = req.query._id || req.query.id || req.body._id || req.body.id || "";
	var isNew = false;
	if (id != "") {
		admindb.get(id, function(err, data) {
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
			admindb.insert(doc, function(err, data) {
				if (err) {
					console.log({err:err});
					res.end('{\"msg\": \"ERROR\"}');
				}
				res.end('{\"msg\": \"OK\"}');
			});
		});
	} else {
		console.log({err:err});
		res.end('{\"msg\": \"ERROR\"}');
	}
};