var express = require("express");
var session = require('express-session');
var log4js = require('log4js');
var bodyParser = require('body-parser');
var querystring = require('querystring');
var http = require('http');
var fs = require('fs');
var url = require('url');
var passport = require('passport');
var resController = require('./controllers/resource.js');
var adminController = require('./controllers/admin.js');
const WebAppStrategy = require('bluemix-appid').WebAppStrategy;
const userAttributeManager = require("bluemix-appid").UserAttributeManager;
const helmet = require("helmet");
const express_enforces_ssl = require("express-enforces-ssl");
const cfEnv = require("cfenv");

var	app = express();
var logger = log4js.getLogger("resourcevalApp");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Use the passport package in our application
app.use(passport.initialize());
app.use(passport.session());

// Below URLs will be used for App ID OAuth flows
const GUEST_USER_HINT = "A guest user started using the app. App ID created a new anonymous profile, where the user’s selections can be stored.";
const RETURNING_USER_HINT = "An identified user returned to the app with the same identity. The app accesses his identified profile and the previous selections that he made.";
const NEW_USER_HINT = "An identified user logged in for the first time. Now when he logs in with the same credentials from any device or web client, the app will show his same profile and selections.";

const LOGIN_URL = "/ibm/bluemix/appid/login";
const CALLBACK_URL = "/ibm/bluemix/appid/callback";
const LANDING_PAGE_URL = "/web-app-sample.html";
const LOGOUT_URL = "/ibm/bluemix/appid/logout";

if (cfEnv.getAppEnv().isLocal) {
   console.error('This sample should not work locally, please push the sample to Bluemix.');
   process.exit(1);
}

// Security configuration
app.use(helmet());
app.use(helmet.noCache());
app.enable("trust proxy");
app.use(express_enforces_ssl());

// Setup express application to use express-session middleware
// Must be configured with proper session storage for production
// environments. See https://github.com/expressjs/session for
// additional documentation
app.use(session({
  secret: "123456",
  resave: true,
  saveUninitialized: true,
	proxy: true,
	cookie: {
		httpOnly: true,
		secure: true
	}
}));

// Use static resources from /samples directory
//app.use(express.static("public"));
app.use(express.static(__dirname + '/public'));

passport.use(new WebAppStrategy());

// Initialize the user attribute Manager
userAttributeManager.init();

// Configure passportjs with user serialization/deserialization. This is required
// for authenticated session persistence accross HTTP requests. See passportjs docs
// for additional information http://passportjs.org/docs
passport.serializeUser(function(user, cb) {
  cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
  cb(null, obj);
});

// Explicit login endpoint. Will always redirect browser to login widget due to {forceLogin: true}.
// If forceLogin is set to false redirect to login widget will not occur of already authenticated users.
app.get(LOGIN_URL, passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
  forceLogin: true
}));

// Callback to finish the authorization process. Will retrieve access and identity tokens/
// from AppID service and redirect to either (in below order)
// 1. the original URL of the request that triggered authentication, as persisted in HTTP session under WebAppStrategy.ORIGINAL_URL key.
// 2. successRedirect as specified in passport.authenticate(name, {successRedirect: "...."}) invocation
// 3. application root ("/")
app.get(CALLBACK_URL, passport.authenticate(WebAppStrategy.STRATEGY_NAME, {allowAnonymousLogin: true}));


//Generate the main html page
app.get('/',function(req,res){
	res.sendfile(__dirname + '/public/index.html');
});

// Protected area. If current user is not authenticated - redirect to the login widget will be returned.
// In case user is authenticated - a page with current user information will be returned.
app.get("/protected.html", passport.authenticate(WebAppStrategy.STRATEGY_NAME), function(req, res){
    var accessToken = req.session[WebAppStrategy.AUTH_CONTEXT].accessToken;
    var toggledItem = req.query.foodItem;
    var isGuest = req.user.amr[0] === "appid_anon";


    // get the attributes for the current user:
    userAttributeManager.getAllAttributes(accessToken).then(function (attributes) {
        var foodSelection = attributes.foodSelection ? JSON.parse(attributes.foodSelection) : [];
        var firstLogin = !isGuest && !attributes.points;
        if (toggledItem) {
            var selectedItemIndex = foodSelection.indexOf(toggledItem);
            if (selectedItemIndex >= 0) {
                foodSelection.splice(selectedItemIndex, 1);
            } else {
                foodSelection.push(toggledItem);
            }

            // update the user's selection
            userAttributeManager.setAttribute(accessToken, "foodSelection", JSON.stringify(foodSelection))
                .then(function (attributes) {
                    givePointsAndRenderPage(req, res, foodSelection, isGuest, firstLogin);
                });

        } else {
            givePointsAndRenderPage(req, res, foodSelection, isGuest, firstLogin);
        }
    });


	});

function givePointsAndRenderPage(req, res, foodSelection, isGuest, firstLogin) {
    //return the protected page with user info

    var hintText;
    if (isGuest) {
        hintText = GUEST_USER_HINT;
    } else {
        if (firstLogin) {
            hintText = NEW_USER_HINT;
        } else {
            hintText = RETURNING_USER_HINT;
        }
    }
    var email = req.user.email;
    if(req.user.email !== undefined && req.user.email.indexOf('@') != -1)
           email = req.user.email.substr(0,req.user.email.indexOf('@'));
    var renderOptions = {
        name: req.user.name || email || "Guest",
        picture: req.user.picture || "/images/anonymous.svg",
        foodSelection: JSON.stringify(foodSelection),
        topHintText: isGuest ? "Login to get a gift >" : "You got 150 points go get a pizza",
        topImageVisible : isGuest ? "hidden" : "visible",
        topHintClickAction : isGuest ? ' window.location.href = "/login";' : ";",
        hintText : hintText
    };

    if (firstLogin) {
        userAttributeManager.setAttribute(req.session[WebAppStrategy.AUTH_CONTEXT].accessToken, "points", "150").then(function (attributes) {
            res.render('protected.html', renderOptions);
         });
    } else {
        res.render('protected.html', renderOptions);
    }
}

// Protected area. If current user is not authenticated - an anonymous login process will trigger.
// In case user is authenticated - a page with current user information will be returned.
app.get("/anon_login", passport.authenticate(WebAppStrategy.STRATEGY_NAME, {allowAnonymousLogin: true, successRedirect : '/protected.html', forceLogin: true}));

// Protected area. If current user is not authenticated - redirect to the login widget will be returned.
// In case user is authenticated - a page with current user information will be returned.
app.get("/login", passport.authenticate(WebAppStrategy.STRATEGY_NAME, {successRedirect : '/protected.html', forceLogin: true}));


app.get("/token.html", function(req, res){

	//return the token data
	res.render('token.html',{tokens: JSON.stringify(req.session[WebAppStrategy.AUTH_CONTEXT])});
});

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
  
router.route('/getjobrole')
  .get(adminController.getjobrole);
  
router.route('/getmethodology')
  .get(adminController.getmethodology);
  
router.route('/getindustry')
  .get(adminController.getindustry);
  
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
