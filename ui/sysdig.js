///////////////////////////////////////////////////////////////////////////////
// Renderer of the csysdig like UI page
///////////////////////////////////////////////////////////////////////////////
class RendererSysdig {
    constructor() {
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
    // Data rendering functions
    ///////////////////////////////////////////////////////////////////////////
    run(filter) {
        //
        // Update the hierarcy and get the URL to use from the hierarchy manager
        //
        var view;
        if(this.isEcho) {
            view = {id: 'echo'};
        } else {
            view = {id: 'dig'};
        }
        this.hierarchyManager.switch(view);
        var url = this.hierarchyManager.getUrl(this.fileName, 33, filter);

        if(filter !== undefined && filter !== '') {
            document.getElementById('digfilter').value = filter;
        } else if(url.filter !== undefined && url.filter !== '') {
            document.getElementById('digfilter').value = url.filter;
        } 

        //
        // Load the data
        //
        //var encodedQueryArgs = this.encodeQueryData({from: 0, to: MAX_N_ROWS});

        oboe(url.url /*+ '?' + encodedQueryArgs*/)
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
                        hline += 'PROC=' + line.p + ', ';
                        if('c' in line) {
                            hline += 'CONTAINER=' + line.c + ', ';
                        } else {
                            hline += 'CONTAINER=host, ';                            
                        }
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
    }

    ///////////////////////////////////////////////////////////////////////////
    // User interaction methods
    ///////////////////////////////////////////////////////////////////////////
    onClickGoBtn() {
        var ddiv = document.getElementById('digdata');
        ddiv.innerHTML = '';

        var flt = document.getElementById('digfilter').value;
        this.run(flt);
    }

    ///////////////////////////////////////////////////////////////////////////////
    // Keyboard handler
    ///////////////////////////////////////////////////////////////////////////////
    onKeyDown(evt) {
        evt = evt || window.event;
        if(evt.key == 'Enter') {
            g_renderer.onClickGoBtn();
        }
    }

    ///////////////////////////////////////////////////////////////////////////////
    // ENTRY POINT
    ///////////////////////////////////////////////////////////////////////////////
    init(hierarchyManager, fileName, filter, isEcho, title) {
        this.hierarchyManager = hierarchyManager;
        this.fileName = fileName;
        this.isEcho = isEcho;

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
        pbody += '<font face="arial" size="3.5">';
        pbody += '    <div id="status" style="padding: 10px;">';
        pbody += '    <b>Progress: </b>';
        pbody += '    </div><br>';
        pbody += '    <div style="float: left;width: 100%;">';
        pbody += '      <div id="title"></div><br>';
        pbody += '      Filter <input id="digfilter" type="text" style="width: 80%;"><button type="button" onclick="g_renderer.onClickGoBtn()">Go</button>';
        pbody += '      <br><br>';
        pbody += '          <div><textarea id="digdata" readonly="true" style="width:80%;height:600px;font-family:courier new;white-space:pre"></textarea></div>';
        pbody += '    </div>';
        pbody += '</font>';
        
        var div = document.getElementById('page');
        div.innerHTML = pbody;

        var el = document.getElementById('title');
        el.innerHTML = '<b>' + title + '</b>';

        //
        // Load the data and start the visualization
        //
        this.run(filter);
    }
}
