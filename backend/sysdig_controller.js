var spawn = require('child_process').spawn;

var g_sysdigExe;
var g_sysdigDir;

if(process.platform === 'win32') {
    g_sysdigExe = 'c:\\windump\\GitHub\\sysdig\\build\\Debug\\csysdig.exe';
    g_sysdigDir = 'c:\\windump\\GitHub\\sysdig\\build\\Debug\\';
} else if(process.platform === 'darwin') {
    g_sysdigExe = '/Users/loris/git/sysdig/build/userspace/sysdig/csysdig';
    g_sysdigDir = '/Users/loris/git/sysdig/build/userspace/sysdig//';
}


const EOF = 255;

class SysdigController {
    //
    // This callback receives the standard output of csysdig on startup and, 
    // after validating it, starts the application UI
    //
    handleStdoutStartup(data, cb) {
        console.log(`stdout: ${data}`);
        
        var str = String.fromCharCode.apply(null, data);

        if(cb && str.includes('ready')) {
            cb();
        } else {
            cb('error stating csysdig');
        }
    }

    //
    // This callback receives the output from the csysdig stdout and pushes it
    // to the given express response.
    //
    serveRequest(data, response) {
        console.log(`stderr: ${data}`);

        if(data[data.length - 1] == EOF) {
            var sldata = data.slice(0, data.length - 1);
            response.write(sldata);
            response.end();
            this.response = undefined;
        } else {
            response.write(data);                
        }
    }

    sendError(message, response) {
        var resBody = {reason: message};

        response.status(500);
        response.send(JSON.stringify(resBody));
    }

    //
    // Starts csysdig
    // Input: the array of command line arguments to use.
    // Output: the spawned child process.
    //
    start(args, cb) {
        var options = {cwd: g_sysdigDir};
        this.lasterr = '';
        this.cb = cb

        this.prc = spawn(g_sysdigExe, args, options);

        //this.prc.stdout.setEncoding('utf8');
        this.prc.stderr.setEncoding('utf8');
        this.prc.stdin.setEncoding('utf8');

        this.prc.stdout.on('data', (data) => {
            if(this.cb) {
                this.handleStdoutStartup(data, this.cb);
                this.cb = undefined;
            } else {
                this.serveRequest(data, this.response);
            }
        });

        this.prc.stderr.on('data', (data) => {
            if(this.cb) {
                this.cb(data);
                this.cb = undefined;
            } else {
                this.sendError(data, this.response);
            }
        });

        this.prc.on('close', (code) => {
            // XXX decide what to do here. Probably relaunch sysdig?
            console.log(`child process exited with code ${code}`);
        });

        this.prc.on('error', (err) => {
            cb('Cannot start csysdig. Make sure sysdig is installed correctly.');
        });
    }

    //
    // This is the API entry point. It works by sending the command to the 
    // csysdig stdin and configuring the express response that will be completed
    // by the serveRequest() callback. 
    //
    run(command, response) {
        if(this.response) {
            this.sendError("request already in progress", response);
        }

        this.response = response;
        this.prc.stdin.write(command);
    }
}

module.exports = new SysdigController();
