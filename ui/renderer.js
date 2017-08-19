var g_defaultFileName = 'lo.scap';
const g_palette = ['steelblue', 'MediumSeaGreen', 'BlueViolet', 'Crimson', 'DarkTurquoise', 'DodgerBlue', 'Chocolate', 'Green', 'Red'];
const g_catPalette = {general: '#EBF5FB', file: '#EAFAF1', network: '#FEF9E7', security: '#FBEEE6', performance: '#F4ECF7', logs: '#D6EAF8'};
var g_lastPalettePick = 0;

if(isElectron()) {
    d3 = require('./deps/d3.v3.min.js');
}

///////////////////////////////////////////////////////////////////////////////
// Renderer of the overview page
///////////////////////////////////////////////////////////////////////////////
class RendererOverview {
    constructor() {
        this.urlBase = '';
        this.port = 0;
        this.fileName = g_defaultFileName;
        this.tilesPerRow = 6;
        this.timelineSelectStart = -1;
        this.isContainerSelectorPopulated = false;
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
    numToReadableStr(n) {
        if(n > (1024 * 1024 * 1024)) {
            return (Math.floor((n / (1024 * 1024 * 1024)) * 10) / 10) + 'G';
        } else if(n > (1024 * 1024)) {
            return (Math.floor((n / (1024 * 1024)) * 10) / 10) + 'M';
        } else if(n > 1024) {
            return (Math.floor((n / 1024) * 10) / 10) + 'K';
        }
        return n;
    }

    renderContainerSelector(cdata) {
        if(!this.isContainerSelectorPopulated) {
            var el = document.getElementById('cselector');
            var selstr = '<option value="all">All Containers + Host</option>';
            selstr += '<option value="host">Host Only</option>';

            for(var k in cdata) {
                selstr = selstr + '<option value="' + k + '">' + cdata[k] + ' (' + k + ')</option>';
            }

            el.innerHTML = selstr;

            this.isContainerSelectorPopulated = true;
        }
    }

    renderGrid(data) {
        var tb = document.getElementById('dtable');

        var tbody = '';

        for(var j = 0; j < data.length; j+=this.tilesPerRow) {
            tbody += '<tr>';
            for(var k = 0; (k < this.tilesPerRow) && (j + k < data.length); k++) {
                var col = g_catPalette[data[j+k].category];

                tbody += 
                '<td id="sc' + (j + k) + '" ' +
                'onmouseover="g_renderer.onMouseOverTile(' + (j + k) + ')" ' +
                'onmouseout="g_renderer.onMouseOutTile(' + (j + k) + ')" ' +
                'onclick="g_renderer.onClickTile(' + (j + k) + ')" ' +
                'ondblclick="g_renderer.onDblclickTile(' + (j + k) + ')" ' +
                'style="border: 1px solid black;width:' + (100 / this.tilesPerRow) + '%;height:75px;text-align:center;background-color:' + col + '"><font face="arial" size="3">' + 
                data[j+k].name +
                '</font><br><br><font face="arial" size="6">' +
                this.numToReadableStr(data[j+k].data.tot) +
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
    composeFilterWithContainer(filter) {
        if(this.containerFilter !== undefined) {
            if(filter !== undefined) {
                filter = '(' + this.containerFilter + ') and (' + filter + ')';
            } else {
                filter = this.containerFilter;
            }
        }

        return filter;
    }

    dig(filter, isEcho, forcedTitle) {
        var view;
        var title;

        filter = this.composeFilterWithContainer(filter);

        if(isEcho) {
            view = {id: 'echo'};
            title = 'Data buffers for time selection';
        } else {
            view = {id: 'dig'};
            title = 'Sysdig Events for time selection';
        }
        
        if(forcedTitle !== undefined) {
            title = forcedTitle;
        }

        this.hierarchyManager = new HierarchyManager(filter);
        this.hierarchyManager.switch(view);
        var url = this.hierarchyManager.getUrl(this.fileName, 33);

        //
        // Launch the sysdig viewer
        //
        g_oldRenderer = g_renderer;
        g_renderer = new RendererSysdig();
        document.onkeydown = g_renderer.onKeyDown;
        g_renderer.init(this.hierarchyManager, this.fileName, undefined, isEcho, title);
    }

    csysdig(targetView, filter, sortingCol) {
        filter = this.composeFilterWithContainer(filter);

        g_oldRenderer = g_renderer;
        g_renderer = new RendererDrillDown();
        document.onkeydown = g_renderer.onKeyDown;
        g_renderer.init(targetView, filter, sortingCol + 1);
    }

    onClickCtextMenu(num) {
        var targetView;
        var targetViewFilter;
        var targetViewSortingCol;

        if(num === 1) {
            targetView = 'procs';
        } else if(num === 2) {
            targetView = 'files';
            //targetViewFilter = null;
            targetViewSortingCol = 2;
        } else if(num === 3) {
            targetView = 'directories';
            //targetViewFilter = null;
            targetViewSortingCol = 2;
        } else if(num === 4) {
            targetView = 'sports';
            //targetViewFilter = null;
            targetViewSortingCol = 4;
        } else if(num === 5) {
            targetView = 'connections';
            //targetViewFilter = null;
            targetViewSortingCol = 8;
        } else if(num === 6) {
            targetView = 'spy_users';
        }

        var flt = this.selectStartTs - this.firstTs;
        if(targetViewFilter !== undefined) {
            targetViewFilter = '(evt.type != switch and evt.rawtime>=' + this.selectStartTs + ' and evt.rawtime<=' + this.selectEndTs + ') and (' + targetViewFilter + ')';
        } else {
            targetViewFilter = 'evt.type != switch and evt.rawtime>=' + this.selectStartTs + ' and evt.rawtime<=' + this.selectEndTs;
        }

        if(num === 7 || num === 8) {
            this.dig(targetViewFilter, num === 8);
            return;
        }

        if(targetViewSortingCol === undefined) {
            targetViewSortingCol = 0;
        }

        this.csysdig(targetView, targetViewFilter, targetViewSortingCol);
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
            cmel.innerHTML += '<a href="#" onclick="g_renderer.onClickCtextMenu(5)">&nbsp;Network Connections</a><br>';
            cmel.innerHTML += '<a href="#" onclick="g_renderer.onClickCtextMenu(6)">&nbsp;Executed Commands</a><br>';
            cmel.innerHTML += '<hr>';
            cmel.innerHTML += '<a href="#" onclick="g_renderer.onClickCtextMenu(7)">&nbsp;Dig</a><br>';
            cmel.innerHTML += '<a href="#" onclick="g_renderer.onClickCtextMenu(8)">&nbsp;Echo</a><br>';
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
        var targetViewTitle = this.data[num].targetViewTitle;

        if(targetView === 'dig') {
            this.dig(targetViewFilter, false, targetViewTitle);
        } else if(targetView === 'echo') {
            this.dig(targetViewFilter, true, targetViewTitle);
        } else {
            this.csysdig(targetView, targetViewFilter, targetViewSortingCol);
        }
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
            var col = g_catPalette[this.data[num].category];
            tile.style.backgroundColor = col;
        }
    }

    onCSelectorChange(newval) {
        if(newval === 'all') {
            this.loadData();
        } else if(newval === 'host') {
            var flt = 'container.id=host';
            this.containerFilter = flt;
            this.loadData(flt);
        } else {
            var flt = 'container.id=' + newval;
            this.containerFilter = flt;
            this.loadData(flt);
        }
    }

    ///////////////////////////////////////////////////////////////////////////
    // Bakend interaction functions
    ///////////////////////////////////////////////////////////////////////////
    loadData(filter) {
        if(filter !== undefined) {
            var currentStr = '?' + 'filter=' + encodeURIComponent(filter);
            var a = 0;
        } else {
            currentStr = '';
        }

        var url = this.urlBase + '/capture/' + encodeURIComponent(this.fileName) + '/summary' + currentStr;

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
                        this.data = jdata.data.metrics;
                        this.renderContainerSelector(jdata.data.info.containers);
                        this.renderGrid(this.data);
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
    // Keyboard hooks
    ///////////////////////////////////////////////////////////////////////////////
    onKeyDown(evt) {
        evt = evt || window.event;
        if(evt.key == 'q')
        {
            var a = 0;
        }
    }

    ///////////////////////////////////////////////////////////////////////////////
    // ENTRY POINT
    ///////////////////////////////////////////////////////////////////////////////
    init() {
        if (isElectron()) {
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
        pbody += '    <b>Container Filter</b>:';
        pbody += '    <select id="cselector" onchange="g_renderer.onCSelectorChange(this.value)">';
        pbody += '    </select>';
        pbody += '    <div id="status" style="padding: 10px;">';
        pbody += '    <b>Progress: </b>';
        pbody += '    </div>';
        pbody += '    <div id="timestr" style="position:fixed;top:25px;right:10px;display:none;">';
        pbody += '        <b>Time</b>: 0 ';
        pbody += '    </div>';
        pbody += '    <div id="cmenu" style="position:fixed;top:300px;left:100px;background:#cccccc;display:none;border:1px solid black;"></div>';
        pbody += '    <div style="width: 100%;text-align:left;">';
        pbody += '        <div id="data" style="width:70%;display:inline-block;vertical-align:top;">';
        pbody += '          <table id="dtable" style="width:100%;text-align:left;"></table>';
        pbody += '        </div>';
        pbody += '        <div id="vizs" style="width:29%;display:inline-block;vertical-align:top;">';
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
var g_renderer = new RendererOverview();
//var g_renderer = new RendererDrillDown();
//var g_renderer = new RendererSysdig();

var g_oldRenderer = 0;

function init() {
    document.onkeydown = g_renderer.onKeyDown;    
    g_renderer.init();
}
