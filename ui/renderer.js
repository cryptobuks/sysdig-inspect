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

    //
    // Data request helper
    //
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
    // Page rendering functions
    //
    renderView(jdata) {
        var div = document.getElementById('dtable');
        var alist = [];
        var legend = jdata.info.legend;
        var ncols = legend.length;
        var rows = jdata.data;

        div.innerHTML = '';

        //
        // Render the column headers
        //
        var row = '<tr style="background-color: #FF0000;">';
        for(var j = 0; j < legend.length; j++) {
            row += '<th>';
            row += legend[j].name;
            row += '</th>';
        }
        row += '</tr>';
        
        div.innerHTML += row;

        //
        // Render the rows
        //
        for(var r = 0; r < rows.length; r++) {
            var rowdata = rows[r].d;
            var row = '<tr id="r_' + r + '" onclick="renderer.drillDown(r);">';
            for(var j = 0; j < rowdata.length; j++) {
                row += '<th></b>';
                row += rowdata[j];
                row += '</b></th>';
            }
            row += '</tr>';
            
            div.innerHTML += row;
        }

        document.getElementById('r_2').style['background-color'] = '#FFFF00';
    }

    //
    // Drilldown function
    //
    drillDown(rowNum) {
        var a = 0;
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

        this.loadJSON('/capture/lo.scap/procs', (response) => {
            // Parse JSON string into object
            var jdata = JSON.parse(response)
            this.renderView(jdata);
        });

    }
}

var renderer = new Renderer();

function init() {
    renderer.init();
}
