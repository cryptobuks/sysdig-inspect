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

    loadJSON(url, callback, method = 'GET', payload) {
        var xobj = new XMLHttpRequest();
        xobj.overrideMimeType("application/json");
        xobj.open(method, url, true);
        xobj.onreadystatechange = function () {
            if (xobj.readyState == 4 && xobj.status == "200") {
                callback(xobj.responseText);
            }
        };

        if (payload) {
            xobj.send(payload);
        }
        else {
            xobj.send(null);
        }
    }

    //
    // ENTRY POINT
    //
    init() {
        if (this.isElecton()) {
            this.initElectron();
        } else {
            this.port = location.port;
        }

        loadJSON('report', function (response) {
            // Parse JSON string into object
            data = JSON.parse(response)
            render_aggregations();
        });

    }
}

var renderer = new Renderer();

function init() {
    renderer.init();
}
