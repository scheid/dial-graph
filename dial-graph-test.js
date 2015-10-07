/*************************************************************************
 * Created by Todd M. Eischeid
 * 16 Jul 2015
 *
 *************************************************************************/


function init() {


    var dg = new DialGraph({ dataUrl:"data/dial-graph-data-1.json", width: 250, dialRadius: 40, containerSelector:"#dial-graph-container"} );
    dg.render();

    var dg2 = new DialGraph({ dataUrl:"data/dial-graph-data-2-short.json", width: 250, dialRadius: 40, containerSelector:"#dial-graph-container2"} );
    dg2.render();

    var dg3 = new DialGraph({ dataUrl:"data/dial-graph-data-1-short.json", dialMode:"binary", width: 250, dialRadius: 40, containerSelector:"#dial-graph-container3"} );
    dg3.render();

    var dg4 = new DialGraph({ dataUrl:"data/dial-graph-data-2-short.json", dialMode:"binary", width: 250, dialRadius: 40, containerSelector:"#dial-graph-container4"} );
    dg4.render();
}