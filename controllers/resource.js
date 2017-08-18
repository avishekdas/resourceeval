var url = require('url');
var cfenv = require("cfenv");
var db;
var cloudant;
var dbCredentials = {
    dbName: 'resourceevaldb'
};
var fs = require('fs');
var path = require('path');

function getDBCredentialsUrl(jsonData) {
	var vcapServices = JSON.parse(jsonData);
	// Pattern match to find the first instance of a Cloudant service in
    // VCAP_SERVICES. If you know your service key, you can access the
    // service credentials directly by using the vcapServices object.
    for (var vcapService in vcapServices) {
		if (vcapService.match(/cloudant/i)) {
            return vcapServices[vcapService][0].credentials.url;
        }
    }
}

function initDBConnection() {
    //When running on Bluemix, this variable will be set to a json object
    //containing all the service credentials of all the bound services
    if (process.env.VCAP_SERVICES) {
        dbCredentials.url = getDBCredentialsUrl(process.env.VCAP_SERVICES);
    } else { //When running locally, the VCAP_SERVICES will not be set

        // When running this app locally you can get your Cloudant credentials
        // from Bluemix (VCAP_SERVICES in "cf env" output or the Environment
        // Variables section for an app in the Bluemix console dashboard).
        // Once you have the credentials, paste them into a file called vcap-local.json.
        // Alternately you could point to a local database here instead of a
        // Bluemix service.
        // url will be in this format: https://username:password@xxxxxxxxx-bluemix.cloudant.com
        dbCredentials.url = getDBCredentialsUrl(fs.readFileSync("./config/vcaplocal.json", "utf-8"));
    }

	cloudant = require('cloudant')(dbCredentials.url);

    // check if DB exists if not create
    cloudant.db.create(dbCredentials.dbName, function(err, res) {
        if (err) {
            console.log('Could not create new db: ' + dbCredentials.dbName + ', it might already exist.');
        }
    });

    db = cloudant.use(dbCredentials.dbName);
}

initDBConnection();

//app.get('/searchbyresourcename', function(req, res) {
exports.searchbyresourcename = function(req, res) {
	var query = url.parse(req.url,true).query;
	var string = JSON.stringify(query);
    var objectValue = JSON.parse(string);
	var searchresourcename = 'resourcename:'+objectValue['resourcename']+'*';
	db.search('searchbyresource', 'resourceview_index', {include_docs:true, q:searchresourcename}, function(err, result) {
	  if (err) {
		res.json({err:err});
	  }
	  res.send(JSON.stringify(result));
	});
};

//app.get('/getresourcedlts', function(req, res) {
exports.getresourcedlts = function(req, res) {
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
};

//app.get('/getresources', function(req, res) {
exports.getresources = function(req, res) {
	db.view('resourceview', 'resourceview_index', function(err, body) {
	  if (!err) {
		var resources = [];
		  body.rows.forEach(function(doc) {
			resources.push(doc.value);           
		  });
		  res.send(JSON.stringify(resources));
		} else {
		  res.json({err:err});
		}
	  });
};

//app.post('/savedata', function(req, res) {
exports.savedata = function(req, res) {
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
				console.log({err:err});
				res.end('{\"msg\": \"ERROR\"}');
			}
			res.end('{\"msg\": \"OK\"}');
		});
  }
};

function update(req, res) {
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
			
			// use insert to modify existing doc by id, if there's any,
			// otherwise it'll create new doc
			db.insert(doc, function(err, data) {
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

