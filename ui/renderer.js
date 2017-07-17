var g_defaultFileName = 'lo.scap';
const MAX_N_ROWS = 30;
const FILTER_TEMPLATE_MAGIC = '@#$f1CA^&;';

var g_views = [
    {name : 'Directories', id: 'directories', 'drilldownTarget': 'files'},
    {name : 'Files', id: 'files', 'drilldownTarget': 'procs'},
    {name : 'Processes', id: 'procs', 'drilldownTarget': 'directories'},
];

class HierarchyManager {
    constructor() {
        this.current = {'drillDownInfo': {rowNum: 0}};
        this.list = [];
    }

    getHierarchyDepth() {
        return this.list.length;
    }

    //
    // Switches view but stays at the same drilldown level
    //
    switch(newViewDetails) {
        var drillDownInfo = this.current.drillDownInfo;
        this.current = {details: newViewDetails, 'drillDownInfo': drillDownInfo};
    }

    //
    // Drills down one level
    //
    drillDown(newViewDetails, rowNum, filterTemplate, rowKey) {
        this.current.drillDownInfo.rowNum = rowNum;
        this.list.push(this.current);

        var filter = filterTemplate.replace(FILTER_TEMPLATE_MAGIC, rowKey);

        this.current = {
            details: newViewDetails, 
            drillDownInfo : {'filter': filter, 'rowNum': 0}
        };
    }

    //
    // Drills up to the specified level
    //
    drillUp(level) {
        if(level >= this.list.length) {
            return undefined;
        }

        this.current = this.list[level];
        this.list = this.list.slice(0, level);
        return this.current;
    }

    //
    // Creates the URL to send to the server
    //
    getUrl(fileName) {
        var view = this.current;
        var encodedFileName = encodeURIComponent(fileName);
        
        var drillDownStr = '';
        for(var j = 0; j < this.list.length; j++) {
            var ddview = this.list[j].details;
            var drillDownInfo = this.list[j].drillDownInfo;

            drillDownStr += encodeURIComponent(JSON.stringify({id: ddview.id, 
                filter: drillDownInfo.filter, 
                rowNum: drillDownInfo.rowNum}));
            drillDownStr += '/';
        }

        var currentStr = encodeURIComponent(JSON.stringify({id: view.details.id, 
            filter: view.drillDownInfo.filter}));

        return '/capture/' + encodedFileName + '/' + drillDownStr + currentStr;
    }

    //
    // Renders the hierarchy breadcrumb.
    // This is specific to the current crappy UI.
    //
    render() {
        var el = document.getElementById('hierarchy');
        el.innerHTML = '';

        for(var j = 0; j < this.list.length; j++) {
            var ddview = this.list[j].details;

            el.innerHTML += 
                '<a href="#" onclick="renderer.drillUp(' + j + ')">' + 
                ddview.name +
                '</a>' + ' / ';
        }

        var view = this.current;
        el.innerHTML += view.details.name;
    }
}

class Renderer {
    constructor() {
        this.urlBase = '';
        this.port = 0;
        this.selectedView = 0;
        this.selectedRow = 0;
        this.nRows = 0;
        this.fileName = g_defaultFileName;
        this.views = undefined;
        this.hierarchyManager = new HierarchyManager();
        this.curViewData = undefined;
    }

    ///////////////////////////////////////////////////////////////////////////
    // Initialization support
    ///////////////////////////////////////////////////////////////////////////
    
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
        this.fileName = remote.getGlobal('fileName');
        this.urlBase = 'http://localhost:' + this.port;
    }

    ///////////////////////////////////////////////////////////////////////////
    // Data communication helpers
    ///////////////////////////////////////////////////////////////////////////
    loadJSON(url, callback, method = 'GET', payload) {
        var xobj = new XMLHttpRequest();
        xobj.overrideMimeType("application/json");
        xobj.open(method, this.urlBase + url, true);
        xobj.onreadystatechange = function () {
            if(xobj.readyState == 4) {
                if(xobj.status == "200") {
                    callback(xobj.responseText);
                } else {
                    //
                    // Poor man's error handling
                    //
                    var body = xobj.responseText;
                    if(body && body !== '') {
                        var jbody = JSON.parse(body);
                        alert(jbody.reason);
                    }
                }
            }
        };

        if (payload) {
            xobj.send(payload);
        }
        else {
            xobj.send(null);
        }
    }

    encodeQueryData(data) {
        let ret = [];
        for (let d in data)
            ret.push(encodeURIComponent(d) + '=' + encodeURIComponent(data[d]));
        return ret.join('&');
    }

    ///////////////////////////////////////////////////////////////////////////
    // Page rendering functions
    ///////////////////////////////////////////////////////////////////////////
    renderViewsList(jdata) {
        var div = document.getElementById('views');

        div.innerHTML = '';

        for(var j = 0; j < jdata.length; j++) {
            var view = jdata[j];

            div.innerHTML = div.innerHTML + 
                ('<div id="v_' + j + '"><a href="#" onclick="renderer.loadView(' + j + ')">' + view.name + '</a></div');

            //
            // While we're here, select the root view
            //
            // if(view.isRoot) {
            //     renderer.selectedView = j;
            // }
        }

        this.views = jdata;
    }

    renderView(jdata) {
        var div = document.getElementById('dtable');
        var alist = [];
        this.curViewData = jdata;
        var legend = jdata.info.legend;
        var ncols = legend.length;
        var rows = jdata.data;

        if(!('data' in jdata)) {
            div.innerHTML = 'No data for this view';
            return;
        }

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
            var row = '<tr id="r_' + r + '" onclick="renderer.drillDown(' + r + ');">';
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

    ///////////////////////////////////////////////////////////////////////////
    // Bakend interaction functions
    ///////////////////////////////////////////////////////////////////////////
    loadViewsList(callback) {
        this.loadJSON('/capture/views', (response) => {
            var jdata = JSON.parse(response);
            this.renderViewsList(jdata);
            callback();
        });
//        this.renderViewsList(g_views);
//        callback();
    }

    loadView(viewNum) {
        var view = this.views[viewNum];

        this.selectedRow = 0;
        
        //
        // Update the hierarcy and get the URL to use from the hierarchy manager
        //
        this.hierarchyManager.switch(view);
        this.hierarchyManager.render();
        var url = this.hierarchyManager.getUrl(this.fileName);

        //
        // Render the view content
        //
        var div = document.getElementById('dtable');
        div.innerHTML = '';

        document.getElementById('v_' + this.selectedView).style['background-color'] = '#FFFFFF';
        document.getElementById('v_' + viewNum).style['background-color'] = '#FFFF00';

        this.selectedView = viewNum;

        var encodedQueryArgs = this.encodeQueryData({from: 0, to: MAX_N_ROWS});

        this.loadJSON(url + '?' + encodedQueryArgs, (response) => {
            // Parse JSON string into object
            var jdata = JSON.parse(response);
            this.renderView(jdata[0]);
        });
    }

    getViewNumById(id) {
        for(var j = 0; j < this.views.length; j++) {
            if(this.views[j].id == id) {
                return j;
            }
        }

        return undefined;
    }

    drillDown(rowNum) {
        var cView = this.views[this.selectedView];
        var jnextViewNum = this.getViewNumById(cView.drilldownTarget);

        this.hierarchyManager.drillDown(this.views[jnextViewNum],
            rowNum,
            this.curViewData.info.filterTemplate,
            this.curViewData.data[rowNum].k);

        this.loadView(jnextViewNum);
    }

    drillUp(level) {
        var newView = this.hierarchyManager.drillUp(level);
        var jnextViewNum = this.getViewNumById(newView.details.id);

        this.loadView(jnextViewNum);
        this.selectedRow = newView.drillDownInfo.rowNum;
    }

    drillUpOne() {
        var newLevel = this.hierarchyManager.getHierarchyDepth();
        this.drillUp(newLevel - 1);
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
            if(newView < renderer.views.length - 1)
            {
                newView++;
            }
            renderer.loadView(newView);
        } if(evt.key == 'ArrowUp') {
            var newRow = renderer.selectedRow;
            if(newRow > 0)
            {
                newRow--;
            }
        
            if(renderer.views.length > 1) {
                document.getElementById('r_' + renderer.selectedRow).style['background-color'] = '#FFFFFF';
            }
            document.getElementById('r_' + newRow).style['background-color'] = '#FFFF00';
            renderer.selectedRow = newRow;
        } else if(evt.key == 'ArrowDown') {
            
            var newRow = renderer.selectedRow;
            if(newRow < renderer.nRows - 1)
            {
                newRow++;
            }

            if(renderer.views.length > 1) {
                document.getElementById('r_' + renderer.selectedRow).style['background-color'] = '#FFFFFF';
            }
            document.getElementById('r_' + newRow).style['background-color'] = '#FFFF00';
            renderer.selectedRow = newRow;
        } else if(evt.key == 'Enter') {
            evt.preventDefault();
            renderer.drillDown(renderer.selectedRow);
        } else if(evt.key == 'Backspace') {
            renderer.drillUpOne();
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

        this.loadViewsList(() => {
            this.selectedView = this.getViewNumById('procs');
            this.loadView(this.selectedView);
        });
    }
}

var renderer = new Renderer();

function init() {
    document.onkeydown = renderer.onKeyDown;    
    renderer.init();
}
