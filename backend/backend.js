// content of index.js
const net = require('net')
const express = require('express')
const sysdigController = require('./sysdig_controller.js')
var path = require("path");

var baseport = 3000;

///////////////////////////////////////////////////////////////////////////////
// Helper functions
///////////////////////////////////////////////////////////////////////////////
function findAvailablePort(cb) {
  var port = baseport;
  baseport += 1;

  var server = net.createServer()
  server.listen(port, function (err) {
    server.once('close', function () {
      cb(port);
    })
    server.close();
  })
  server.on('error', function (err) {
    findAvailablePort(cb);
  })
}

///////////////////////////////////////////////////////////////////////////////
// The web server
///////////////////////////////////////////////////////////////////////////////
class Backend {
  constructor() {
    this.port = 0;
  }

  _setupRoutes(app) {
      app.get('/capture/:fileName/:view', (request, response) => {
        var fileName = request.params.fileName;
        var view = request.params.view;
        response.setHeader('Content-Type', 'application/json');
        
        sysdigController.run(['-r', fileName, '-v', view, '-j'], response);
      });
    
      app.get('/*', (request, response) => {
        var url = request.url;

        if(url === '/') {
          url = 'index.html';
        }

        response.sendFile(url, { root: __dirname + '/../ui' });
      });
  }

  start(fileName, cb) {
    findAvailablePort((port) => {
      this.port = port;

      const app = express();

      this._setupRoutes(app);

      app.listen(port, (err) => {  
        if (err) {
          console.log('error starting server: ', err);
          cb(port, 'error starting server: ' + err);
        }

        console.log('server is listening on port ' + port);

        this.fileName = fileName;
        cb(port);
      })
    });
  }
}

module.exports = new Backend();
