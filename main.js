/*
Copyright (C) 2017 Draios inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 2 as
published by the Free Software Foundation.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
const electron = require('electron');

const path = require('path');
const url = require('url');
var backend = require('./backend/backend.js');

// Module to control application life.
const app = electron.app;

// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

// Module to generate dialogs
const dialog = electron.dialog;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

var g_fileName;

function createWindow () {
  //
  // Parse the command line arguments
  //
  var argv = require('yargs').argv;

  if(g_fileName === undefined) {
    if(argv.r) {
      g_fileName = argv.r;
    } else {
      var res = dialog.showOpenDialog(mainWindow, {properties: ['openFile'], message: 'Select a Capture File to Open'});
      if(res) {
        g_fileName = res[0];
      } else {
        g_fileName = '';        
      }
    }
  }

  //
  // Start the backend
  //
  backend.start(g_fileName, (port, err) => {
    if(err) {
      dialog.showErrorBox('Unable to start the application', err);
      return;
    }

    global.port = port;
    global.fileName = g_fileName;

    // 
    // Backend up and running. Create the browser window.
    //
    mainWindow = new BrowserWindow({width: 800, height: 600});

    //
    // Open the DevTools.
    //
    // mainWindow.webContents.openDevTools()

    //
    // Emitted when the window is closed.
    //
    mainWindow.on('closed', function () {
      //
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      //
      mainWindow = null
    });

    // and load the index.html of the app.
    mainWindow.loadURL(url.format({
      pathname: path.join(__dirname, 'ui', 'index.html'),
      protocol: 'file:',
      slashes: true
    }));
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function() {
  createWindow();
})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})
