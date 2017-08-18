var express = require("express");
var	app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var querystring = require('querystring');
var http = require('http');
var fs = require('fs');
var url = require('url');
var passport = require('passport');
var resController = require('./controllers/resource.js');
var adminController = require('./controllers/admin.js');

app.use(express.static(__dirname + '/public'));

// Use the passport package in our application
app.use(passport.initialize());

// Create our Express router
var router = express.Router();

// Create endpoint handlers for resources
router.route('/searchbyresourcename')
  .get(resController.searchbyresourcename);
  
router.route('/getresourcedlts')
  .get(resController.getresourcedlts);
  
router.route('/getresources')
  .get(resController.getresources);
  
router.route('/getskills')
  .get(adminController.getskills);
  
router.route('/getRatings')
  .get(adminController.getRatings);
  
router.route('/getEvaluators')
  .get(adminController.getEvaluators);
  
router.route('/saveadmin')
  .post(adminController.saveadmin);
  
router.route('/savedata')
  .post(resController.savedata);

// Register all our routes with /
app.use('/', router);

var port = (process.env.VCAP_APP_PORT || 8080);
var host = (process.env.VCAP_APP_HOST || 'localhost');
app.listen(port);
console.log("Listening on port ", port);
