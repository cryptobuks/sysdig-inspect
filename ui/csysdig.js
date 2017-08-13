const MAX_N_ROWS = 100;
const FILTER_TEMPLATE_MAGIC = '@#$f1CA^&;';

//
// Check if we're running inside electron
//
function isElectron() {
    return window && window.process && window.process.type;
}

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
        if(newViewDetails !== undefined && newViewDetails.filter !== undefined && newViewDetails.filter !== '') {
            filter = '(' + filter + ') and (' + newViewDetails.filter + ')'; 
        }

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
    getUrl(fileName, sortingCol, forcedFilter) {
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
        if(forcedFilter !== undefined) {
            flt = forcedFilter;
        } else if(this.userFilter === undefined) {
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

        return {url: '/capture/' + encodedFileName + '/' + drillDownStr + currentStr,
                filter: flt};
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
        oboe(this.urlBase + '/capture/views')
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
        if(data in jdata) {
            jdata.data.sort(function(a, b) {
                return b.d[col] - a.d[col];
            })
        }
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
        var url = this.hierarchyManager.getUrl(this.fileName, 33).url;

        //
        // Render the view content
        //
        var div = document.getElementById('dtable');
        div.innerHTML = '';

        document.getElementById('v_' + this.selectedView).style['background-color'] = '#FFFFFF';
        document.getElementById('v_' + viewNum).style['background-color'] = '#FFFF00';

        this.selectedView = viewNum;

        var encodedQueryArgs = this.encodeQueryData({from: 0, to: MAX_N_ROWS});

        oboe(this.urlBase + url + '?' + encodedQueryArgs)
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
        var title;
        if(isEcho) {
            view = {id: 'echo'};
            title = 'Data buffers for ' + this.curViewData.data[rowNum].k;
        } else {
            view = {id: 'dig'};
            title = 'Sysdig Events for ' + this.curViewData.data[rowNum].k;
        }
        this.hierarchyManager.switch(view);
        var url = this.hierarchyManager.getUrl(this.fileName, 33);

        //
        // Launch the sysdig viewer
        //
        g_oldRenderer = g_renderer;
        g_renderer = new RendererSysdig();
        document.onkeydown = g_renderer.onKeyDown;
        g_renderer.init(this.hierarchyManager, this.fileName, undefined, isEcho, title);

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

    ///////////////////////////////////////////////////////////////////////////////
    // ENTRY POINT
    ///////////////////////////////////////////////////////////////////////////////
    init(viewId, viewFilter, viewSortingCol) {
        this.hierarchyManager = new HierarchyManager(viewFilter);

        if(isElectron()) {
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
