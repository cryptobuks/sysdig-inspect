var g_defaultFileName = 'lo.scap';
const MAX_N_ROWS = 30;
const FILTER_TEMPLATE_MAGIC = '@#$f1CA^&;';
const g_palette = ['steelblue', 'MediumSeaGreen', 'BlueViolet', 'Crimson', 'DarkTurquoise', 'DodgerBlue', 'Chocolate', 'Green', 'Red'];
var g_lastPalettePick = 0;

var g_views = [
    {name : 'Directories', id: 'directories', 'drilldownTarget': 'files'},
    {name : 'Files', id: 'files', 'drilldownTarget': 'procs'},
    {name : 'Processes', id: 'procs', 'drilldownTarget': 'directories'},
];

class HierarchyManager {
    constructor(userFilter) {
        this.current = {'drillDownInfo': {rowNum: 0}};
        this.list = [];
        this.userFilter = userFilter;
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
    drillDown(newViewDetails, rowNum, filterTemplate, rowKey, sortingCol) {
        this.current.drillDownInfo.rowNum = rowNum;
        this.current.drillDownInfo.sortingCol = sortingCol;
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
    getUrl(fileName, sortingCol) {
        var view = this.current;
        var encodedFileName = encodeURIComponent(fileName);
        
        var drillDownStr = '';
        for(var j = 0; j < this.list.length; j++) {
            var ddview = this.list[j].details;
            var drillDownInfo = this.list[j].drillDownInfo;

            drillDownStr += encodeURIComponent(JSON.stringify({id: ddview.id, 
                filter: drillDownInfo.filter, 
                rowNum: drillDownInfo.rowNum,
                sortingCol: drillDownInfo.sortingCol}));
            drillDownStr += '/';
        }

        var flt;
        if(this.userFilter === undefined) {
            flt = view.drillDownInfo.filter;
        } else {
            if(view.drillDownInfo.filter == undefined) {
                flt = this.userFilter;
            } else {
                flt = '(' + this.userFilter + ') and (' + view.drillDownInfo.filter + ')';
            }
        }

        var currentStr = encodeURIComponent(JSON.stringify({'id': view.details.id,
            'filter': flt, 'sortingCol': sortingCol}));

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
                '<a href="#" onclick="g_renderer.drillUp(' + j + ')">' + 
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
class RendererDrillDown {
    constructor() {
        this.urlBase = '';
        this.port = 0;
        this.selectedView = 0;
        this.selectedRow = 0;
        this.nRows = 0;
        this.fileName = g_defaultFileName;
        this.views = undefined;
        this.hierarchyManager = null;
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
                ('<div id="v_' + j + '"><a href="#" onclick="g_renderer.loadView(' + j + ')">' + view.name + '</a></div');

            //
            // While we're here, select the root view
            //
            // if(view.isRoot) {
            //     g_renderer.selectedView = j;
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
            var tcol = 'BBBBBB';
            if(j === jdata.info.sortingCol - 1) {
                tcol = '88EEEE';
            }

            row += '<th style="background-color: #' + tcol + ';">';
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
            var row = '<tr id="r_' + r + '" onclick="g_renderer.drillDown(' + r + ');">';
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

    sortData(jdata, col) {
        jdata.data.sort(function(a, b) {
            return b.d[col] - a.d[col];
        })
    }

    loadView(viewNum, viewSortingCol) {
        var view = this.views[viewNum];

        //
        // Make sure to make the dig window disappear
        //
        document.getElementById('dig').innerHTML= '';
        
        //
        // Reset the row selection
        //
        this.selectedRow = 0;
        
        //
        // Update the hierarcy and get the URL to use from the hierarchy manager
        //
        this.hierarchyManager.switch(view);
        this.hierarchyManager.render();
        var url = this.hierarchyManager.getUrl(this.fileName, 33);

        //
        // Render the view content
        //
        var div = document.getElementById('dtable');
        div.innerHTML = '';

        document.getElementById('v_' + this.selectedView).style['background-color'] = '#FFFFFF';
        document.getElementById('v_' + viewNum).style['background-color'] = '#FFFF00';

        this.selectedView = viewNum;

        var encodedQueryArgs = this.encodeQueryData({from: 0, to: MAX_N_ROWS});

        oboe(url + '?' + encodedQueryArgs)
            .node('slices.*', (jdata) => {
                    var el = document.getElementById('status');
                    var prstr = 'done';
                    if(jdata.progress < 100) {
                        el.innerHTML = '<b>Progress: </b>' + jdata.progress;
                    } else {
                        el.innerHTML = '<b>Progress: </b>done';
                        if(viewSortingCol !== undefined) {
                            jdata.info.sortingCol = viewSortingCol;
                        }
                        this.sortData(jdata, jdata.info.sortingCol - 1);
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

    dig(rowNum, isEcho) {
        var dbody = '<h1 id="dtitle">Sysdig Events</h1>';
        dbody += '<code>';
        dbody += '<div><textarea id="digdata" readonly="true" style="width:100%;height:100px"></textarea></div>';
        dbody += '</code>';
        var div = document.getElementById('dig');
        div.innerHTML = dbody;

        //
        // Simulate a drill down to get the required URL from the hierarchy
        // manager
        //
        this.hierarchyManager.drillDown(undefined,
            rowNum,
            this.curViewData.info.filterTemplate,
            this.curViewData.data[rowNum].k,
            this.curViewData.info.sortingCol);

        //
        // Update the hierarcy and get the URL to use from the hierarchy manager
        //
        var view;
        if(isEcho) {
            view = {id: 'echo'};
        } else {
            view = {id: 'dig'};
        }
        this.hierarchyManager.switch(view);
        var url = this.hierarchyManager.getUrl(this.fileName, 33);

        //
        // Load the data
        //
        //var encodedQueryArgs = this.encodeQueryData({from: 0, to: MAX_N_ROWS});

        oboe(url /*+ '?' + encodedQueryArgs*/)
            .node('slices.*', (jdata) => {
                var el = document.getElementById('status');
                var ddiv = document.getElementById('digdata');
                var hlines = ddiv.innerHTML;

                var prstr = 'done';
                if(jdata.progress < 100) {
                    el.innerHTML = '<b>Progress: </b>' + jdata.progress;
                } else {
                    el.innerHTML = '<b>Progress: </b>done';
                }

                var lines = jdata.data;
                if(view.id === 'dig') {
                    for(var j = 0; j <lines.length; j++) {
                        hlines += lines[j];
                        hlines += '\n';
                    }
                } else {
                    for(var j = 0; j <lines.length; j++) {
                        var line = lines[j];
                        var hline;
                        if(line.d === '<') {
                            hline = 'Read ';
                        } else {
                            hline = 'Write ';                            
                        }

                        hline += line.l + 'B, ';
                        hline += 'FD=' + line.f + '\n';
                        hline += line.v;
                        hline += '\n\n';
                        
                        hlines += hline;
                    }
                }

                ddiv.innerHTML = hlines;
            })
            .fail(function(errorReport) {
                if(errorReport.statusCode !== undefined) {
                    // poor man's error handling
                    alert(errorReport.jsonBody.reason);
                }
        });

        //
        // Data loaded. Drill up to restore the hierachy manager state.
        //
        var newLevel = this.hierarchyManager.getHierarchyDepth();
        var newView = this.hierarchyManager.drillUp(newLevel - 1);
    }

    drillDown(rowNum) {
        var cView = this.views[this.selectedView];
        var jnextViewNum = this.getViewNumById(cView.drilldownTarget);

        this.hierarchyManager.drillDown(this.views[jnextViewNum],
            rowNum,
            this.curViewData.info.filterTemplate,
            this.curViewData.data[rowNum].k,
            this.curViewData.info.sortingCol);

        this.loadView(jnextViewNum);
    }

    drillUp(level) {
        var newView = this.hierarchyManager.drillUp(level);
        var jnextViewNum = this.getViewNumById(newView.details.id);

        this.loadView(jnextViewNum, newView.drillDownInfo.sortingCol);
        this.selectedRow = newView.drillDownInfo.rowNum;
    }

    drillUpOne() {
        var newLevel = this.hierarchyManager.getHierarchyDepth();
        if(newLevel <= 0) {
            return;
        }

        this.drillUp(newLevel - 1);
    }

    ///////////////////////////////////////////////////////////////////////////////
    // Keyboard handler
    ///////////////////////////////////////////////////////////////////////////////
    onKeyDown(evt) {
        evt = evt || window.event;
        if(evt.key == 'q')
        {
            var newView = g_renderer.selectedView;
            if(newView > 0)
            {
                newView--;
            }
        
            g_renderer.loadView(newView);
        } else if(evt.key == 'a') {
            var newView = g_renderer.selectedView;
            if(newView < g_renderer.views.length - 1)
            {
                newView++;
            }
            g_renderer.loadView(newView);
        } if(evt.key == 'ArrowUp') {
            var newRow = g_renderer.selectedRow;
            if(newRow > 0)
            {
                newRow--;
            }
        
            if(g_renderer.views.length > 1) {
                document.getElementById('r_' + g_renderer.selectedRow).style['background-color'] = '#FFFFFF';
            }
            document.getElementById('r_' + newRow).style['background-color'] = '#FFFF00';
            g_renderer.selectedRow = newRow;
        } else if(evt.key == 'ArrowDown') {
            
            var newRow = g_renderer.selectedRow;
            if(newRow < g_renderer.nRows - 1)
            {
                newRow++;
            }

            if(g_renderer.views.length > 1) {
                document.getElementById('r_' + g_renderer.selectedRow).style['background-color'] = '#FFFFFF';
            }
            document.getElementById('r_' + newRow).style['background-color'] = '#FFFF00';
            g_renderer.selectedRow = newRow;
        } else if(evt.key == 'Enter') {
            evt.preventDefault();
            g_renderer.drillDown(g_renderer.selectedRow);
        } else if(evt.key == 'd') {
            g_renderer.dig(g_renderer.selectedRow, false);
        } else if(evt.key == 'e') {
            g_renderer.dig(g_renderer.selectedRow, true);
        } else if(evt.key == 'Backspace') {
            g_renderer.drillUpOne();
        }
    }

    //
    // ENTRY POINT
    //
    init(viewId, viewFilter, viewSortingCol) {
        this.hierarchyManager = new HierarchyManager(viewFilter);

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
        pbody += '        <b>q/a</b>: change view <b>up/down</b>: change line selection <b>Enter</b>: drill down <b>Delete</b>: drill up <b>e</b>: echo <b>d</b>: dig&nbsp;&nbsp;&nbsp;';
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
        pbody += '        <div id="dig">';
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
            if(viewId === undefined) {
                this.selectedView = this.getViewNumById('procs');
            } else {
                this.selectedView = this.getViewNumById(viewId);
            }

            this.loadView(this.selectedView, viewSortingCol);
        });
    }
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
// Renderer of the overview page
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
class RendererOverview {
    constructor() {
        this.urlBase = '';
        this.port = 0;
        this.fileName = g_defaultFileName;
        this.tilesPerRow = 4;
        this.timelineSelectStart = -1;
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
                'onmouseover="g_renderer.onMouseOverTile(' + (j + k) + ')" ' +
                'onmouseout="g_renderer.onMouseOutTile(' + (j + k) + ')" ' +
                'onclick="g_renderer.onClickTile(' + (j + k) + ')" ' +
                'ondblclick="g_renderer.onDblclickTile(' + (j + k) + ')" ' +                
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
        'display:inline-block;vertical-align:top;"' +
        'ondblclick="g_renderer.onDblclickTile(' + num + ')"' + 
        'onmousedown="g_renderer.onMouseDownTimeline(event, ' + num + ')"' + 
        'onmousemove="g_renderer.onMouseMoveTimeline(event, ' + num + ')"' + 
        'onmouseup="g_renderer.onMouseUpTimeline(event, ' + num + ')"' + 
        'onmouseout="g_renderer.onMouseOutTimeline(event, ' + num + ')"' + 
        '></div>';

        pdiv.innerHTML += pbody;

        var timeline = data.timeLine;

        var x = d3.scale.linear()
            .domain([0, data.max])
            .range([0, 99]);

        var j = 0;

        d3.select('#viz' + num)
            .selectAll('div')
            .data(timeline)
            .enter().append('div')
            .style('width', function(d) { 
                d.n = j++;
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
    onClickCtextMenu(num) {
        var targetView;
        var targetViewFilter;
        var targetViewSortingCol;

        if(num === 1) {
            targetView = 'processes';
        } else if(num === 2) {
            targetView = 'files';
            //targetViewFilter = null;
            //targetViewSortingCol;
        } else if(num === 3) {
            targetView = 'directories';
            //targetViewFilter = null;
            //targetViewSortingCol;
        } else if(num === 4) {
            targetView = 'sports';
            //targetViewFilter = null;
            //targetViewSortingCol;
        } else if(num === 5) {
            targetView = 'connections';
            //targetViewFilter = null;
            //targetViewSortingCol;
        } else if(num === 6) {
            targetView = 'spy_users';
            //targetViewFilter = null;
            //targetViewSortingCol;
        }

        var flt = this.selectStartTs - this.firstTs;
        if(targetViewFilter !== undefined) {
            var a = 0;
        } else {
            targetViewFilter = 'evt.rawtime>=' + this.selectStartTs + ' and evt.rawtime<=' + this.selectEndTs;
        }

        g_oldRenderer = g_renderer;
        g_renderer = new RendererDrillDown();
        document.onkeydown = g_renderer.onKeyDown;
        g_renderer.init(targetView, targetViewFilter, targetViewSortingCol + 1);
    }

    onMouseDownTimeline(event, num) {
        this.timelineSelectStart = event.offsetY;
    }

    onMouseUpTimeline(event, num) {
        if(this.timelineSelectStart != -1) {
            var cmel = document.getElementById('cmenu');
            cmel.style.top = event.clientY + 'px';
            cmel.style.left = event.clientX + 'px';
            cmel.style.display = 'inline-block';
            cmel.innerHTML = '<b>&nbsp;Selection Drill Down Options&nbsp;</b><br>';
            cmel.innerHTML += '<a href="#" onclick="g_renderer.onClickCtextMenu(1)">&nbsp;Processes</a><br>';
            cmel.innerHTML += '<a href="#" onclick="g_renderer.onClickCtextMenu(2)">&nbsp;Files</a><br>';
            cmel.innerHTML += '<a href="#" onclick="g_renderer.onClickCtextMenu(3)">&nbsp;Directories</a><br>';
            cmel.innerHTML += '<a href="#" onclick="g_renderer.onClickCtextMenu(4)">&nbsp;Network Traffic</a><br>';
            //cmel.innerHTML += '<hr>';
            cmel.innerHTML += '<a href="#" onclick="g_renderer.onClickCtextMenu(5)">&nbsp;Network Connections</a><br>';
            cmel.innerHTML += '<a href="#" onclick="g_renderer.onClickCtextMenu(6)">&nbsp;Spy Users</a><br>';
        }

        this.timelineSelectStart = -1;
    }

    onMouseMoveTimeline(event, num) {
        document.body.style.cursor = 'crosshair';
        var el = document.getElementById('timestr');
        el.style.display = 'block';
        var startY = Math.trunc(this.timelineSelectStart / 2);
        var curY = Math.trunc(event.offsetY / 2);
        this.firstTs = +this.data[num].data.timeLine[0].t;
        this.selectEndTs = +this.data[num].data.timeLine[curY].t;
        var curVal = +this.data[num].data.timeLine[curY].v;

        var deltaCur = this.selectEndTs - this.firstTs;

        if(this.timelineSelectStart == -1) {
            el.innerHTML = '<b>Time</b>: ' + (Math.floor(deltaCur / 10000000) / 100) + 's ' +
            '<b>val<b>: ' + curVal;
            return;
        }

        this.selectStartTs = +this.data[num].data.timeLine[startY].t;
        var deltaSelectStart = this.selectStartTs - this.firstTs;

        el.innerHTML = '<b>Time</b>: from ' + (Math.floor(deltaSelectStart / 10000000) / 100) + 's to ' +
            (Math.floor(deltaCur / 10000000) / 100) + 's';
        
        for(var j = 0; j < this.data.length; j++) {
            var col = this.data[j].data.col;
            var elmt = document.getElementById('timestr');
            var k = 0;

            d3.select('#viz' + j)
                .selectAll('div')
                .style('background-color', function(d) {
                    if(k >= startY && k <= curY) {
                        k++;
                        return '#DDDD00';
                    } else {
                        k++;
                        return col;
                    }
                });
        }
    }

    onMouseOutTimeline(event, num) {
        document.body.style.cursor = 'auto';
        var el = document.getElementById('timestr');
        //el.style.display = 'none';
    }

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

    onDblclickTile(num) {
        var tile = document.getElementById('sc' + num);
        var targetView = this.data[num].targetView;
        var targetViewFilter = this.data[num].targetViewFilter;
        var targetViewSortingCol = this.data[num].targetViewSortingCol;

        g_oldRenderer = g_renderer;
        g_renderer = new RendererDrillDown();
        document.onkeydown = g_renderer.onKeyDown;
        g_renderer.init(targetView, targetViewFilter, targetViewSortingCol + 1);
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
        pbody += '<font face="arial" size="3.5">';
        pbody += '    <div id="status" style="padding: 10px;">';
        pbody += '    <b>Progress: </b>';
        pbody += '    </div>';
        pbody += '    <div id="timestr" style="position:fixed;top:25px;right:10px;display:none;">';
        pbody += '        <b>Time</b>: 0 ';
        pbody += '    </div>';
        pbody += '    <div id="cmenu" style="position:fixed;top:300px;left:100px;background:#cccccc;display:none;border:1px solid black;"></div>';
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
//var g_renderer = new RendererDrillDown();
var g_renderer = new RendererOverview();
var g_oldRenderer = 0;

function init() {
    document.onkeydown = g_renderer.onKeyDown;    
    g_renderer.init();
}
