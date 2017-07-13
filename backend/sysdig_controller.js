var spawn = require('child_process').spawn;
const electron = require('electron');

var g_sysdigExe;
var g_sysdigDir;

if(process.platform === 'win32') {
//    g_sysdigExe = __dirname + '\\..\\sysdig\\csysdig.exe';
//    g_sysdigDir = __dirname + '\\..\\sysdig\\';
    g_sysdigExe = 'c:\\windump\\GitHub\\sysdig\\build\\Debug\\csysdig.exe';
    g_sysdigDir = 'c:\\windump\\GitHub\\sysdig\\build\\Debug\\';
} else if(process.platform === 'darwin') {
    if(__dirname.includes('sysdig.app')) {
//        g_sysdigExe = __dirname + '/../../sysdig/csysdig';
//        g_sysdigDir = __dirname + '/../../sysdig/';
        g_sysdigExe = '/Applications/wsysdig.app/Contents/Resources/sysdig/csysdig';
        g_sysdigDir = '/Applications/wsysdig.app/Contents/Resources/sysdig/';
    } else {
        g_sysdigExe = __dirname + '/../sysdig/csysdig';
        g_sysdigDir = __dirname + '/../sysdig/';
    }
}

class SysdigController {
    sendError(message, response) {
        var resBody = {reason: message};

        response.status(500);
        response.send(JSON.stringify(resBody));
    }

    //
    // This is the API entry point. It works by running csysdig and piping its
    // output to the connection. 
    //
    run(args, response) {
        var options = {cwd: g_sysdigDir};

        console.log(`spawning ${g_sysdigExe} with args: ${args}`);
        this.prc = spawn(g_sysdigExe, args, options);

        this.prc.stdout.setEncoding('utf8');
        this.prc.stderr.setEncoding('utf8');
        this.prc.stdin.setEncoding('utf8');

        this.prc.stdout.on('data', (data) => {
            response.write(data);                
        });

        this.prc.stderr.on('data', (data) => {
            this.sendError(data, response);
        });

        this.prc.on('close', (code) => {
            response.end();
            console.log(`sysdig process exited with code ${code}`);
        });

        this.prc.on('error', (err) => {
            cb('Cannot start csysdig. Make sure sysdig is installed correctly.');
        });
    }
}

module.exports = new SysdigController();
