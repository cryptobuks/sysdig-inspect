var g_views = [
    {name : 'Processes', id: 'procs'},
    {name : 'Files', id: 'files'},
    {name : 'Directories', id: 'directories'}
];

class Renderer {
    constructor() {
        this.urlBase = '';
        this.port = 0;
        this.selectedView = 0;
        this.selectedRow = 0;
        this.nRows = 0;
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
        this.urlBase = 'http://localhost:' + this.port;
    }

    //
    // Data request helper
    //
    loadJSON(url, callback, method = 'GET', payload) {
        var xobj = new XMLHttpRequest();
        xobj.overrideMimeType("application/json");
        xobj.open(method, this.urlBase + url, true);
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
    renderViewsList() {
        var div = document.getElementById('views');

        div.innerHTML = '';

        for(var j = 0; j < g_views.length; j++) {
            var view = g_views[j];

            div.innerHTML = div.innerHTML + 
                ('<div id="v_' + j + '"><a href="#" onclick="renderer.loadView(' + j + ')">' + view.name + '</a></div');
        }
    }

    renderView(jdata) {
        var div = document.getElementById('dtable');
        var alist = [];
        var legend = jdata.info.legend;
        var ncols = legend.length;
        var rows = jdata.data;
        this.nRows = rows.length;

        div.innerHTML = '';

        //
        // Render the column headers
        //
        var row = '<tr style="background-color: #BBBBBB;">';
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

        document.getElementById('r_' + this.selectedRow).style['background-color'] = '#FFFF00';
    }

    //
    // Bakend interaction functions
    //
    loadView(viewNum) {
        var div = document.getElementById('dtable');
        div.innerHTML = '';

        document.getElementById('v_' + renderer.selectedView).style['background-color'] = '#FFFFFF';
        document.getElementById('v_' + viewNum).style['background-color'] = '#FFFF00';

        var view = g_views[viewNum];

        renderer.selectedView = viewNum;

        this.loadJSON('/capture/lo.scap/' + view.id, (response) => {
            // Parse JSON string into object
            var jdata = JSON.parse(response)
            this.renderView(jdata);
        });
    }

    drillDown(rowNum) {
        var a = 0;
    }

    ///////////////////////////////////////////////////////////////////////////////
    // Keyboard handler
    ///////////////////////////////////////////////////////////////////////////////
    onKeyDown(evt) {
        evt = evt || window.event;
        if(evt.key == 'q')
        {
            var newView = renderer.selectedView;
            if(newView > 0)
            {
                newView--;
            }
        
            renderer.loadView(newView);
        } else if(evt.key == 'a') {
            var newView = renderer.selectedView;
            if(newView < g_views.length - 1)
            {
                newView++;
            }
            renderer.loadView(newView);
        } if(evt.key == 'p') {
            var newRow = renderer.selectedRow;
            if(newRow > 0)
            {
                newRow--;
            }
        
            document.getElementById('r_' + renderer.selectedRow).style['background-color'] = '#FFFFFF';
            document.getElementById('r_' + newRow).style['background-color'] = '#FFFF00';
            renderer.selectedRow = newRow;
        } else if(evt.key == 'l') {
            var newRow = renderer.selectedRow;
            if(newRow < renderer.nRows - 1)
            {
                newRow++;
            }

            document.getElementById('r_' + renderer.selectedRow).style['background-color'] = '#FFFFFF';
            document.getElementById('r_' + newRow).style['background-color'] = '#FFFF00';
            renderer.selectedRow = newRow;
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
            this.urlBase = '';
        }

        this.renderViewsList();
        this.loadView(this.selectedView);
    }
}

var renderer = new Renderer();

function init() {
    document.onkeydown = renderer.onKeyDown;    
    renderer.init();
}
