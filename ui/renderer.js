class Renderer {
    constructor() {
        this.port = 0;
    }

    //
    // Check if we're running inside electron
    //
    isElecton() {
        return window && window.process && window.process.type;
    }

    //
    // This function is called only when we're running in electron.
    // This is the place where electron specific inits go. 
    //
    initElectron() {
        //
        // Get the port where the backend is listening from the main process
        //
        const remote = require('electron').remote;
        this.port = remote.getGlobal('port');
    }

    init() {
        if(this.isElecton()) {
            this.initElectron();
        } else {
            this.port = location.port;
        }
    }
}

var renderer = new Renderer();

function init() {
    renderer.init();
}
