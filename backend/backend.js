// content of index.js
const net = require('net')
const express = require('express')
const sysdigController = require('./sysdig_controller.js')
var path = require("path");
var fs = require("fs");

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

  _listViews(request, response) {
      response.setHeader('Content-Type', 'application/json');
      var args = ['--list-views', '-j'];
      sysdigController.runCsysdig(args, response);
  }

  _getView(request, response) {
      var fileName = request.params.fileName;
      var viewInfo = JSON.parse(request.params.view);
      response.setHeader('Content-Type', 'application/json');
      
      var args = ['-r', fileName, '-v', viewInfo.id, '-j', '-pc'];
      if('from' in request.query) {
        args.push('--from');
        args.push(request.query.from);
      }

      if('to' in request.query) {
        args.push('--to');
        args.push(request.query.to);
      }

      if('filter' in viewInfo) {
        args.push(viewInfo.filter);        
      }

      if('viewAs' in request.query) {
        if(request.query.viewAs == "Hex") {
          args.push('-X');
        } else if(request.query.viewAs != "dottedAscii") {
          args.push('-A');
        }
      } else {
        args.push('-A');        
      }

      sysdigController.runCsysdig(args, response);
  }

  _getSummary(request, response) {
      var fileName = request.params.fileName;
      var filter = request.query.filter;
      var sampleCount = 0;

      response.setHeader('Content-Type', 'application/json');
      
      var args = ['-r', fileName, '-c', 'wsysdig_summary'];

      if(request.query.sampleCount !== undefined) {
        sampleCount = request.query.sampleCount;
      }
      args.push(sampleCount);
      
      if(filter !== undefined) {
        args.push(filter);
      }      

      sysdigController.runSysdig(args, response);
  }

  _setupRoutes(app) {
      app.get('/capture/views', (request, response) => {
        this._listViews(request, response)
      });

      app.get('/capture/:fileName/summary', (request, response) => {
        this._getSummary(request, response)
      });

      app.get('/capture/:fileName/:view', (request, response) => {
        this._getView(request, response)
      });

      app.get('/capture/:fileName/*/:view', (request, response) => {
        this._getView(request, response)
      });

      app.get('/*', (request, response) => {
        var url = request.url;

        if(url === '/') {
          url = '/index.html';
        }

        var absPath = path.resolve(__dirname, '../ui', url.substring(1));
        fs.exists(absPath, function(exists) { 
          if (exists) { 
            response.sendFile(url, { root: __dirname + '/../ui' });
          } else {
            var resBody = {reason: 'not found'};

            response.status(404);
            response.send(JSON.stringify(resBody));
            response.end();
          }
        }); 
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
