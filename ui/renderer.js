var g_defaultFileName = 'lo.scap';
const MAX_N_ROWS = 30;
const FILTER_TEMPLATE_MAGIC = '@#$f1CA^&;';
const g_palette = ['steelblue', 'Gold', 'MediumSeaGreen', 'BlueViolet', 'Crimson', 'DarkTurquoise', 'DodgerBlue', 'Chocolate', 'Green'];
var g_lastPalettePick = 0;

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

///////////////////////////////////////////////////////////////////////////////
// Renderer of the csysdig like UI page
///////////////////////////////////////////////////////////////////////////////
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
        oboe('/capture/views')
            .done((jdata) => {
                this.renderViewsList(jdata);
                callback();
            })
            .fail((errorReport) => {
                // poor man's error handling
                if(errorReport.statusCode !== undefined) {
                    alert(errorReport.jsonBody.reason);
                }
        });
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

        // this.loadJSON(url + '?' + encodedQueryArgs, (response) => {
        //     // Parse JSON string into object
        //     var jdata = JSON.parse(response);
        //     this.renderView(jdata[0]);
        // });

        oboe(url + '?' + encodedQueryArgs)
            .node('slices.*', (jdata) => {
                    var el = document.getElementById('status');
                    var prstr = 'done';
                    if(jdata.progress < 100) {
                        el.innerHTML = '<b>Progress: </b>' + jdata.progress;
                    } else {
                        el.innerHTML = '<b>Progress: </b>done';
                        this.renderView(jdata);
                    }
            })
            .fail(function(errorReport) {
                if(errorReport.statusCode !== undefined) {
                    // poor man's error handling
                    alert(errorReport.jsonBody.reason);
                }
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

        //
        // Populate the page html
        //
        var pbody = '';
        pbody += '<font face="arial" size="1.5">';
        pbody += '    <div id="status" style="padding: 10px;">';
        pbody += '    <b>Progress: </b>';
        pbody += '    </div>';
        pbody += '    <div>';
        pbody += '        <p id="hierarchy" style="padding: 10px;"></p>';
        pbody += '    </div>';
        pbody += '    <div style="position:absolute;top:5px;right:0;">';
        pbody += '        <b>q/a</b>: change view <b>up/down</b>: change line selection <b>Enter</b>: drill down <b>Delete (or breadcrumb)</b>: drill up';
        pbody += '    </div>';
        pbody += '    <div style="float: left;width: 100%;">';
        pbody += '    <div style="float: left;width: 10%;">';
        pbody += '        <h1>Views</h1>';
        pbody += '        <p id="views" style="padding: 10px;"></p>';
        pbody += '    </div>';
        pbody += '    <div style="float: left;width: 80%;">';
        pbody += '        <h1 id="dtitle">Data</h1>';
        pbody += '        <div id="data">';
        pbody += '        <table id="dtable" style="width:100%;text-align: left;"></table>';
        pbody += '        </div>';
        pbody += '    </div>';
        pbody += '    </div>';
        pbody += '</font>';
        
        var div = document.getElementById('page');
        div.innerHTML = pbody;

        //
        // Load the data and start the visualization
        //
        this.loadViewsList(() => {
            this.selectedView = this.getViewNumById('procs');
            this.loadView(this.selectedView);
        });
    }
}

///////////////////////////////////////////////////////////////////////////////
// Renderer of the overview page
///////////////////////////////////////////////////////////////////////////////
class RendererOverview {
    constructor() {
        this.urlBase = '';
        this.port = 0;
        this.fileName = g_defaultFileName;
        this.tilesPerRow = 4;
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
    encodeQueryData(data) {
        let ret = [];
        for (let d in data)
            ret.push(encodeURIComponent(d) + '=' + encodeURIComponent(data[d]));
        return ret.join('&');
    }

    ///////////////////////////////////////////////////////////////////////////
    // Page rendering functions
    ///////////////////////////////////////////////////////////////////////////
    renderGrid(data) {
        var tb = document.getElementById('dtable');

        var tbody = '';

        for(var j = 0; j < data.length; j+=this.tilesPerRow) {
            tbody += '<tr>';
            for(var k = 0; (k < this.tilesPerRow) && (j + k < data.length); k++) {
                tbody += 
                '<td id="sc' + (j + k) + '" ' +
                'onmouseover="renderer.onMouseOverTile(' + (j + k) + ')" ' +
                'onmouseout="renderer.onMouseOutTile(' + (j + k) + ')" ' +
                'onclick="renderer.onClickTile(' + (j + k) + ')" ' +
                'style="border: 1px solid black;width: 20%;height:100px;text-align:center"><font face="arial" size="3">' + 
                data[j+k].name +
                '</font><br><br><font face="arial" size="6">' +
                data[j+k].data.tot +
                '</font></td>';
            }
            tbody += '</tr>';
        }

        tb.innerHTML = tbody;
    }

    renderTimeline(num, data, width) {
        var pdiv = document.getElementById('vizs');

        var pbody = '<div class="chart" id="viz' + num + '"' +
        'style="width:' + width + '%;' + 
        'display:inline-block;vertical-align:top;"></div>';

        pdiv.innerHTML += pbody;

        var timeline = data.timeLine;

        var x = d3.scale.linear()
            .domain([0, data.max])
            .range([0, 99]);

        d3.select('#viz' + num)
            .selectAll('div')
            .data(timeline)
            .enter().append('div')
            .style('width', function(d) { 
                return x(d.v) + '%'; 
            })
            .style('background-color', data.col)
            ;
    }

    renderTimelines() {
        var pdiv = document.getElementById('vizs');
        pdiv.innerHTML = '';
        var width = 25;
        if(this.data.length > 4) {
            width = 100 / this.data.length;
        }
        
        for(var j = 0; j < this.data.length; j++) {
            var data = this.data[j].data;
            if('col' in data) {
                this.renderTimeline(j, data, width);
            }
        }
    }

    ///////////////////////////////////////////////////////////////////////////
    // User interaction methods
    ///////////////////////////////////////////////////////////////////////////
    onClickTile(num) {
        var tile = document.getElementById('sc' + num);
        tile.style.backgroundColor = "#FFFFFF";
        
        var data = this.data[num].data;
        
        // Assign a color to this tile and apply it
        if('col' in data) {
            delete data.col;
        } else {
            data.col = g_palette[g_lastPalettePick];
            g_lastPalettePick++;
            tile.style.backgroundColor = data.col;
        }

        this.renderTimelines(num, data);
    }

    onMouseOverTile(num) {
        var tile = document.getElementById('sc' + num);

        var data = this.data[num].data;
        if('col' in data) {
            tile.style.backgroundColor = data.col;
        } else {
            tile.style.backgroundColor = "#FFFF00";
        }
    }

    onMouseOutTile(num) {
        var tile = document.getElementById('sc' + num);

        var data = this.data[num].data;
        if('col' in data) {
            tile.style.backgroundColor = data.col;
        } else {
            tile.style.backgroundColor = "#FFFFFF";
        }
    }

    ///////////////////////////////////////////////////////////////////////////
    // Bakend interaction functions
    ///////////////////////////////////////////////////////////////////////////
    loadData() {
        var url = '/capture/' + encodeURIComponent(this.fileName) + '/summary';

        //
        // Download the summary
        //
        oboe(url)
            .node('slices.*', (jdata) => {
                var el = document.getElementById('status');
                var prstr = 'done';
                if(jdata.progress < 100) {
                    el.innerHTML = '<b>Progress: </b>' + Math.floor(jdata.progress * 100) / 100;
                } else {
                    el.innerHTML = '<b>Progress: </b>done';
                    if('data' in jdata) {
                        this.data = jdata.data;
                        this.renderGrid(jdata.data);
                    }
                }
            })
            .fail(function(errorReport) {
                if(errorReport.statusCode !== undefined) {
                    // poor man's error handling
                    alert(errorReport.jsonBody.reason);
                }
        });
    }

    ///////////////////////////////////////////////////////////////////////////////
    // Keyboard handler
    ///////////////////////////////////////////////////////////////////////////////
    onKeyDown(evt) {
        evt = evt || window.event;
        if(evt.key == 'q')
        {
            var a = 0;
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

        //
        // Populate the page html
        //
        var pbody = '';
        pbody += '<font face="arial" size="1.5">';
        pbody += '    <div id="status" style="padding: 10px;">';
        pbody += '    <b>Progress: </b>';
        pbody += '    </div>';
        pbody += '    <div style="position:absolute;top:5px;right:0;">';
        pbody += '        <b>q/a</b>: change view <b>up/down</b>: change line selection <b>Enter</b>: drill down <b>Delete (or breadcrumb)</b>: drill up';
        pbody += '    </div>';
        pbody += '    <div style="width: 100%;text-align:left;">';
        pbody += '        <div id="data" style="width:50%;display:inline-block;vertical-align:top;">';
        pbody += '          <table id="dtable" style="width:100%;text-align:left;"></table>';
        pbody += '        </div>';
        pbody += '        <div id="vizs" style="width:49%;display:inline-block;vertical-align:top;">';
        pbody += '        </div>';
        pbody += '    </div>';
        pbody += '</font>';
        
        var div = document.getElementById('page');
        div.innerHTML = pbody;
    
        //
        // Load the data and start the visualization
        //
        this.loadData();
    }
}

///////////////////////////////////////////////////////////////////////////////
// Page initialization
///////////////////////////////////////////////////////////////////////////////
//var renderer = new Renderer();
var renderer = new RendererOverview();

function init() {
    document.onkeydown = renderer.onKeyDown;    
    renderer.init();
}
