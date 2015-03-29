var Q = require('q');
var fs = require('fs');
var readline = require('readline');
var colors = require('colors');
var OAuth2Client = require('googleapis').auth.OAuth2;
var config = require('./config');
var auth = {}; // Persisted client credentials

// Fail if a command line argument was passed in
var path = process.argv[2];
if (!path) return console.log('Credentials path not found. Please input a path to your downloaded JSON credentials and try again.'.red);

// Main run block
getCredentialsFromFile(path)
.then(authenticateWithGoogle)
.then(saveAuthenticationConfig)
.then(shutdownSafely)
.catch(logError);

function getCredentialsFromFile(path) {
  var deferred = Q.defer();
  fs.readFile(path, function(err, res) {
    if (err) deferred.reject('Could not read path to credentials file. Please check your path and try again');
    if (!res) deferred.reject('Credentials not found. Please check your path and try again');

    var credentials = JSON.parse(res);
    if (!credentials.web) deferred.reject('Path did not include correct credentials. Please check that you downloaded the right JSON credentials.');

    // Add important auth information to persist
    auth.client_id = credentials.web.client_id;
    auth.client_secret = credentials.web.client_secret;

    return deferred.resolve(credentials.web);
  });
  return deferred.promise;
}

function authenticateWithGoogle(credentials) {
  var deferred = Q.defer();
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  var oauth2Client = new OAuth2Client(credentials.client_id, credentials.client_secret, credentials.redirect_uris[0]);
  var url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Required to receive a refresh token
    scope: config.GOOGLE_AUTH_SCOPE 
  });

  console.log('\nPlease visit the following url in your browser (you\'ll only have to do this once):'.cyan, url.green);
  console.log('\nLook in the url for ?code=XXXXXXXXX and copy everything after the \'=\''.yellow)
  rl.question('Enter the code here: ', getAccessToken);

  function getAccessToken(code) {
    oauth2Client.getToken(code, function(err, tokens) {
      if (err) deferred.reject('Error while trying to retrieve access token', err);
      auth.refresh_token = tokens.refresh_token;
      deferred.resolve();
    });
  };
  return deferred.promise;
}

function saveAuthenticationConfig() {
  var deferred = Q.defer();
  fs.writeFile(config.STORAGE_FILE, JSON.stringify(auth, "", 2), function(err, res) {
    if (err) return deferred.reject('Could not store authentication config. Please try again.');
    console.log('Authorization successful! Ready to sync.'.green);
    deferred.resolve();
  })
  return deferred.promise;
}

function shutdownSafely(){
  process.stdin.destroy();
  process.exit(0);
}

function logError(err) {
  console.log(err.red);
  process.stdin.destroy();
  process.exit(0);
}

