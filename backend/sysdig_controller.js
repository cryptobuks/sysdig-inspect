var spawn = require('child_process').spawn;
const electron = require('electron');

var g_csysdigExe;
var g_sysdigExe;
var g_sysdigDir;

if(process.platform === 'win32') {
//    g_csysdigExe = __dirname + '\\..\\sysdig\\csysdig.exe';
//    g_sysdigDir = __dirname + '\\..\\sysdig\\';
    g_sysdigDir = 'c:\\windump\\GitHub\\sysdig\\build\\Debug\\';
    g_csysdigExe = g_sysdigDir + 'csysdig.exe';
    g_sysdigExe = g_sysdigDir + 'sysdig.exe';
} else if(process.platform === 'darwin') {
    if(__dirname.includes('sysdig.app')) {
        g_sysdigDir = '/Applications/wsysdig.app/Contents/Resources/sysdig/';
    } else {
        g_sysdigDir = '/Users/loris/git/sysdig/build/userspace/sysdig/';
//        g_sysdigDir = __dirname + '/../sysdig/';
    }

    g_csysdigExe = g_sysdigDir + 'csysdig';
    g_sysdigExe = g_sysdigDir + 'sysdig';
} else {
    g_csysdigExe = 'csysdig';
    g_sysdigExe = 'sysdig';
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
    _run(exe, args, response) {
        var options = {cwd: g_sysdigDir};

        console.log(`spawning ${exe} with args: ${args}`);
        this.prc = spawn(exe, args, options);

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

    runCsysdig(args, response) {
        return this._run(g_csysdigExe, args, response);
    }
    
    runSysdig(args, response) {
        return this._run(g_sysdigExe, args, response);
    }
    
}

module.exports = new SysdigController();
