/*********************************************************************
 *
 * Created by Todd Eischeid, June 2015
 * A health score dial graph, based on normalized scores of raw metrics.
 *
 **********************************************************************/

function DialGraph(config) {

    this.cfg = {
        dialRadius: 20,
        dialSpacing: 15,
        dialMode:"continuous", //either 'binary' or 'continuous';  binary will only have 2 positions for the dial, either vertical (for good) or angled (for bad); continuous will directly correlate the angle of the dial with the normalized score, from 0 to 90 degrees.  In 'binary' neither the wedges nor trend indiators will be shown.
        arrangement: "nested", // either 'nested' or 'stacked'; nested puts any child items inside the outer dial, and stacked will create a separate line for each item and the children will be placed on that line.  stacked is more appropriate when each item has a lot of children, such as differnet lab tests.
        showChildren: true,
        showWedges: false,
        showTrendIndicators: true,
        dataUrl: "",
        width: 450,  /* note; height will be determined by the height of all of the dials and set dynamically */
        labelPosition: "left",
        containerSelector:"",
        onItemClick:null,
        healthRange: {
            lower : -30,
            upper : 30
        },
        changeRateIndication: false, /* whether to fill the dial with color, saturation correlated with the rate of change.*/
        changeRateMaxChange: 20 /* indicates the amount of change that qualifies for maximum color saturation */
    };

    //assign any config values that are passed in
    for (var fld in config) {
        this.cfg[fld] = config[fld];
    }

}



DialGraph.prototype.render = function() {

    var connectorLine;
    var me = this;
    var scoreData = [];
    var dialLineStrokeWidth = 2;


    var trendIndicatorInset = 10;

    var circleCenterX =  (me.cfg.labelPosition == "right") ? me.cfg.dialRadius + 1 : me.cfg.width - (me.cfg.dialRadius  * 2 + 2) ;


    var svg;

    var angleScale = d3.scale.linear()
        .domain([-100, 100])
        .range([-90, 90]);

    var radiansScale = d3.scale.linear()
        .domain([-100, 100])
        .range([-1 * Math.PI / 2, Math.PI / 2]);

    var deviationArc = d3.svg.arc()
        .innerRadius(0)
        .outerRadius( me.cfg.dialRadius)
        .startAngle(0)
        .endAngle(function(d, i) { return radiansScale(d.score); });

    var childDeviationArc = d3.svg.arc()
        .innerRadius(0)
        .outerRadius( function(d, i) {
            return  me.cfg.dialRadius / d3.select(this.parentNode.parentNode).datum().details.length;
        })
        .startAngle(0)
        .endAngle(function(d, i) { return radiansScale(d.score); });


    var metricGroups;
    var needles;
    var children;
    var textLabels;


    var doDataChange = function(data) {

        var changeOption = "angles";


        //in order for exit().remove() to work on the selection, the variable much be defined only with selectAll and data.
        //the function in the data() call is the key function that indicates what to use for the unique key.
        metricGroups = svg
            .selectAll(".metric-group")
            .data(data, function(d) { return d.label; } );

        metricGroups.exit().remove();

        metricGroups
            .enter()
            .append("g")
            .classed("metric-group", true)
            .on("click", function(d, i) {

                var selElement = this;
                var slideHoriz = 400;

                //deemphasize all of the other nodes except for the selected one.
                svg.selectAll(".metric-group")

                    .transition()
                    .duration(400)
                    .attr("transform", function(d, i) {

                        if (this != selElement) {
                            //console.log(i);
                            return "translate(" + (me.cfg.dialRadius + 1 + slideHoriz) + ", " + (((me.cfg.dialRadius * 2) + me.cfg.dialSpacing ) * (i + 1)) + ")";

                        } else {
                            return "scale(4.5)translate(-157,40)";
                        }

                    })
                    .style("opacity", 0.0);

                //TODO: seems like a kluge to have to use setTimeout. I need a way to call a single function once, after the transition.
                   setTimeout(function() {doDataChange(d.details); }, 500);


            })
            .attr("transform", function(d, i) { return "translate(" + (me.cfg.dialRadius + 1) + ", " + (((me.cfg.dialRadius * 2) + me.cfg.dialSpacing ) * (i + 1)) + ")"; });


        metricGroups
            .append("circle")
            .attr("r", me.cfg.dialRadius)
            .attr("cx", circleCenterX)
            .attr("cy", 0)
            .classed("outer-dial", true);


        //these are the needles that are rotated based on the deviation from the ideal.
        needles = metricGroups
            .append("line")
            .attr("class", function (d, i) {

                if (d.details) {
                    return "needle none";
                } else {
                    //TODO: this assumes symetric health range; need to chang to use both upper and lower.
                    return (Math.abs(d.score) > Math.abs(me.cfg.healthRange.upper)) ? "needle bad" : "needle good";
                }
            })
            .attr("x1", circleCenterX)
            .attr("y1", -1 * me.cfg.dialRadius)
            .attr("x2", circleCenterX)
            .attr("y2", 1 * me.cfg.dialRadius)

            .attr("transform", function (d, i) {

                if (me.cfg.dialMode == "binary") {

                    if (Math.abs(d.score) > Math.abs(me.cfg.healthRange.upper)) {
                        return "rotate(90 " + circleCenterX + " 0)";
                    } else {
                        return "rotate(0 " + circleCenterX + " 0)";
                    }


                } else {

                    return "rotate(" + angleScale(d.score) + " " + circleCenterX + " 0)";
                }


            });




        if (changeOption == "lines") {

            //************  Change rate indication ****************
            var changeIndicators = metricGroups
                .selectAll(".change-indicators")
                .data(function (d, i) {

                    var result = [];
                    var multiplier = Math.min(1, (Math.abs(d.score - d.previousScore) / me.cfg.changeRateMaxChange));

                    if (multiplier > 0.1) {
                        result = [{lineIdx: 1}];
                    }
                    if (multiplier > 0.25) {
                        result = [{lineIdx: 1}, {lineIdx: 2}];
                    }
                    if (multiplier > 0.5) {
                        result = [{lineIdx: 1}, {lineIdx: 2}, {lineIdx: 3}];
                    }
                    if (multiplier > 0.75) {
                        result = [{lineIdx: 1}, {lineIdx: 2}, {lineIdx: 3}, {lineIdx: 4}];
                    }

                    var i = 0;
                    //TODO: for now, I'm just assigning score vals to each element, to use them in the fuctions below; but not the best solution.
                    for (i = 0; i < result.length; i++) {
                        result[i].score = d.score;
                        result[i].previousScore = d.previousScore;
                    }

                    return result;

                })
                .enter()
                .append("line")
                .classed("needle", true)
                .classed("default", true)
                .style("stroke-width", "1px")
                .style("stroke", function (d, i) {
                    var fadeRate = 0.2;
                    return "rgba(100, 100, 100, " + (1 - (d.lineIdx * fadeRate)) + ")";
                })
                .style("stroke-linecap", "round")
                .attr("x1", function (d, i) {
                    return circleCenterX + (i * 5);
                })
                .attr("y1", -trendIndicatorInset)
                .attr("x2", function (d, i) {
                    return circleCenterX + (i * 5);
                })
                .attr("y2", -1 * me.cfg.dialRadius + trendIndicatorInset)
                .attr("transform", function (d, i) {

                    console.log("d");
                    console.log(d);

                    var dir = (d.score < d.previousScore) ? 1 : -1;

                    if (me.cfg.dialMode == "binary") {

                        //TODO: for binary mode, I think we'll just have straight non angling parallel lines indicating the change.
                        /**
                         if (Math.abs(d.score) > Math.abs(me.cfg.healthRange.upper)) {
                        return "rotate(90 " + circleCenterX + " 0)";
                    } else {
                        return "rotate(0 " + circleCenterX + " 0)";
                    }
                         **/


                    } else {

                        // return "rotate(" + (angleScale(d.score) + ( dir * (d.lineIdx * 16))) + " " + circleCenterX + " 0)";
                        return "rotate(" + angleScale(d.score) + " " + circleCenterX + " 0)";
                    }


                });

        }

        if (changeOption == "angles") {


            //************  Change rate indication ****************
            var changeIndicators = metricGroups
                .selectAll(".change-indicators")
                .data(function (d, i) {

                    var result = [];
                    var multiplier = Math.min(1, (Math.abs(d.score - d.previousScore) / me.cfg.changeRateMaxChange));

                    if (multiplier > 0.1) {
                        result = [{lineIdx: 1}];
                    }
                    if (multiplier > 0.25) {
                        result = [{lineIdx: 1}, {lineIdx: 2}];
                    }
                    if (multiplier > 0.5) {
                        result = [{lineIdx: 1}, {lineIdx: 2}, {lineIdx: 3}];
                    }
                    if (multiplier > 0.75) {
                        result = [{lineIdx: 1}, {lineIdx: 2}, {lineIdx: 3}, {lineIdx: 4}];
                    }

                    var i = 0;
                    //TODO: for now, I'm just assigning score vals to each element, to use them in the functions below; but not the best solution.
                    for (i = 0; i < result.length; i++) {
                        result[i].score = d.score;
                        result[i].previousScore = d.previousScore;
                        result[i].details = d.details;
                    }

                    return result;

                })
                .enter()
                .append("polyline")
                .classed("needle", true)
                .classed("default", true)
                .style("stroke-width", "1px")
                    .style("fill", "none")
                .style("stroke", function (d, i) {
                    var fadeRate = 0.2;
                    return "rgba(100, 100, 100, " + (1 - (d.lineIdx * fadeRate)) + ")";
                })
                .style("stroke-linecap", "round")

                .attr("points", function(d, i) {

                        var dir = (d.score < d.previousScore) ? 1 : -1;

                        if (d.details)
                        {
                            return "0,0";
                        } else {

                            return (circleCenterX + ((i + 1) * 5) + 3) + "," + (-1 * trendIndicatorInset) + " " +
                                (circleCenterX + ((i + 1) * 5)) + "," + ((-1 * (me.cfg.dialRadius) + trendIndicatorInset - trendIndicatorInset) / 2) + " " +
                                (circleCenterX + ((i + 1) * 5) + 3) + "," + (-1 * me.cfg.dialRadius + trendIndicatorInset) + " ";

                        }


                })

                .attr("transform", function (d, i) {

                    console.log("d");
                    console.log(d);

                    var dir = (d.score < d.previousScore) ? 1 : -1;

                    if (me.cfg.dialMode == "binary") {

                        //TODO: for binary mode, I think we'll just have straight non angling parallel lines indicating the change.
                        /**
                         if (Math.abs(d.score) > Math.abs(me.cfg.healthRange.upper)) {
                        return "rotate(90 " + circleCenterX + " 0)";
                    } else {
                        return "rotate(0 " + circleCenterX + " 0)";
                    }
                         **/


                    } else {

                        // return "rotate(" + (angleScale(d.score) + ( dir * (d.lineIdx * 16))) + " " + circleCenterX + " 0)";
                        return "rotate(" + angleScale(d.score) + " " + circleCenterX + " 0)";
                    }


                })
                ;



        }

        /*
        * var multiplier = Math.min(1, (Math.abs(d.score - d.previousScore) / me.cfg.changeRateMaxChange));

         //TODO: this assumes symetric health range; need to chang to use both upper and lower.
         var color = (Math.abs(d.score) > Math.abs(me.cfg.healthRange.upper)) ? "203,0,0" : "122,184,0";

         if (!me.cfg.changeRateIndication) {
         color = "255, 255, 255";
         multiplier = 1.0;
         }

         //console.log("mult " + d.label + " " + Math.min(1, (Math.abs(d.score - d.previousScore) / me.cfg.changeRateMaxChange)));

         //return "rgba(" + colorSat + "," + colorSat + "," + colorSat + ", 0.5)";
         return "rgba("+ color + "," + multiplier + " )";
        * */


        //the wedges within the circles
        if (me.cfg.showWedges && (!(me.cfg.dialMode == "binary"))) {

            metricGroups
                /*
                 .selectAll(".deviation-arc")
                 .data(data)
                 .enter()
                 */
                .append("path")
                .attr("d", deviationArc)
                .attr("class", function (d, i) {

                    if (d.details) {
                        return "deviation-arc none";
                    } else {
                        return (Math.abs(d.score) > Math.abs(me.cfg.healthRange.upper)) ? "deviation-arc bad" : "deviation-arc good";
                    }
                })
                .attr("transform", function (d, i) {
                    return "translate(" + circleCenterX + ",0)"
                })
            ;

        }

       // var trendPolygonSmall = ["0,0 7,4 0,8", "0,0 6,0 6,6 0,6", "0,0 -7,4 0,8"];

        var trendPolygonMedium = [
            circleCenterX + ",-" + trendIndicatorInset +  " " + circleCenterX + "," + (-me.cfg.dialRadius + trendIndicatorInset) + " " + (circleCenterX - 10) + " ," + -(me.cfg.dialRadius/2),
            "",
            circleCenterX + ",-" + trendIndicatorInset +  " " + circleCenterX + "," + (-me.cfg.dialRadius + trendIndicatorInset) + " " + (circleCenterX + 10) + " ," + (-me.cfg.dialRadius/2)];

        //var trendPolygonLarge = ["0,0 14,10 0,20", "0,0 20,0 20,20 0,20", "0,0 -14,10 0,20"];


        if (me.cfg.showTrendIndicators && (me.cfg.dialMode != "binary")) {

            var trendIndicators = metricGroups
                .append("polygon")
                .attr("points", function (d, i) {
                    return (d.score && d.previousScore) ?  (Math.abs(d.score) > Math.abs(d.previousScore)) ? trendPolygonMedium[0] : (Math.abs(d.score) == Math.abs(d.previousScore)) ? trendPolygonMedium[1] : trendPolygonMedium[2] : "";
                })
                .attr("class", function (d, i) {

                    if (d.score && d.previousScore) {
                        if ((d.details) || (Math.abs(d.score) == Math.abs(d.previousScore) )) {
                            return "pointer none";
                        } else {
                            //TODO: this assumes symetric health range; need to chang to use both upper and lower.
                            return (Math.abs(d.score) >= Math.abs(d.previousScore)) ? "pointer bad" : "pointer good"

                        }
                    } else {

                        return "";
                    }



                })

                .attr("transform", function (d, i) {
                    //return "translate(" + getTrendIndicatorPos(d, i) + ") rotate(" + (angleScale(d.score) + ((d.score < 0) ? 180 : 0)) + " 0 0)";

                    return "rotate(" + angleScale(d.score) + " " + circleCenterX + " 0)";


                });

            //.attr("transform", function(d, i) { return "translate(" + getTrendIndicatorPos(d, i) + ") "  } );
        }

        //whether or not to show the sub items of the top level item.  these will display as circles within the larger circle.
        if (me.cfg.showChildren) {

            children = metricGroups
                .selectAll(".metric-children")
                .data(function (d, i) {
                    //  console.log("in children ");
                    //  console.log(d);
                    return d.details || [];
                });

            children
                .enter()
                .append("g")
                .classed("metric-children", true)
                .attr("transform", "translate(" + circleCenterX + " , 0)");


            children.exit().remove();


            //the inner child dials
            children
                .append("circle")
                .attr("cy", function (d, i) {
                    //here we need to get access to the parent node's data so we know how many child circles will be created, and we can the radius of each circle appropriately.
                    //note that we have to use parentNode.parentNode to successfully back out to the parent.
                    var childRadius = me.cfg.dialRadius / d3.select(this.parentNode.parentNode).datum().details.length;
                    return i * (childRadius * 2) + (childRadius) - me.cfg.dialRadius;
                })
                .attr("r", function (d, i) {
                    var childRadius = me.cfg.dialRadius / d3.select(this.parentNode.parentNode).datum().details.length;
                    return childRadius;

                })
                .classed("outer-dial", true);


            //child labels
            children
                .append("text")
                .style("fill", "#898989")
                .style("font-size", "8pt")
                .text(function(d, i) {  return d.label; })
                .attr("x", me.cfg.dialRadius + 10)
                .attr("y", function (d, i) {

                    var childRadius = me.cfg.dialRadius / d3.select(this.parentNode.parentNode).datum().details.length;
                    return i * (childRadius * 2) + (childRadius) - me.cfg.dialRadius + 3;
                });


            //these are the needles that are rotated based on the deviation from the ideal (vertical).
            var needles = children
                .append("line")
                .classed("needle", true)
                .attr("class", function (d, i) {

                    //TODO: this assumes symetric health range; need to chang to use both upper and lower.
                    return (Math.abs(d.score) > Math.abs(me.cfg.healthRange.upper)) ? "needle bad" : "needle good";
                })
                .attr("x1", 0)
                .attr("y1", function (d, i) {
                    var childRadius = me.cfg.dialRadius / d3.select(this.parentNode.parentNode).datum().details.length;
                    return i * (childRadius * 2) - me.cfg.dialRadius;
                }
            )
                .attr("x2", 0)
                .attr("y2",function (d, i) {
                    var childRadius = me.cfg.dialRadius / d3.select(this.parentNode.parentNode).datum().details.length;
                    return i * (childRadius * 2) - me.cfg.dialRadius + (childRadius * 2);
                })
                .attr("transform", function (d, i) {
                    var childRadius = me.cfg.dialRadius / d3.select(this.parentNode.parentNode).datum().details.length;



                    if (me.cfg.dialMode == "binary") {

                        if (Math.abs(d.score) > Math.abs(me.cfg.healthRange.upper)) {
                            return "rotate(90 0 " +  (i * (childRadius * 2) + (childRadius) - me.cfg.dialRadius)  + ")";
                        } else {
                            return "rotate(0 0 " +  (i * (childRadius * 2) + (childRadius) - me.cfg.dialRadius)  + ")";
                        }


                    } else {

                        return "rotate(" + angleScale(d.score) + " 0 " +  (i * (childRadius * 2) + (childRadius) - me.cfg.dialRadius)  + ")";
                    }



                });




            if (me.cfg.showWedges) {
                //the wedges within the child circles
                children
                    .append("path")
                    .classed("deviation-arc", true)
                    .attr("d", childDeviationArc)
                    .attr("style", function (d, i) {
                        return (Math.abs(d.score) > Math.abs(me.cfg.healthRange.upper)) ? "fill: #cb0000; stroke: none; opacity: 0.2" : "fill: green; stroke: none; opacity: 0.2";
                    })
                    .attr("transform", function (d, i) {
                        var childRadius = me.cfg.dialRadius / d3.select(this.parentNode.parentNode).datum().details.length;
                        return "translate(0," + (i * (childRadius * 2) + (childRadius) - me.cfg.dialRadius) + ")";
                    });
            }
            /*
             var trendIndicators = children
             .append("polygon")
             .attr("points", function (d, i) {
             return (Math.abs(d.score) > Math.abs(d.previousScore)) ? "0,0 7,4 0,8" : (Math.abs(d.score) == Math.abs(d.previousScore)) ? "0,0 6,0 6,6 0,6" : "0,0 -7,4 0,8"
             })
             .style("fill", function (d, i) {
             return (Math.abs(d.score) > Math.abs(d.previousScore)) ? "#cb0000" : (Math.abs(d.score) == Math.abs(d.previousScore)) ? "none" : "green"
             })
             .attr("transform", function (d, i) {
             return "translate(" + getTrendIndicatorPos(d, i) + ") rotate(" + (angleScale(d.score) + ((d.score < 0) ? 180 : 0)) + " 0 0)"
             });
             //.attr("transform", function(d, i) { return "translate(" + getTrendIndicatorPos(d, i) + ") "  } );
             */





        }


        textLabels = metricGroups
            .append("text")
            .classed("normal-label", true)
            .on("touchend", doMetricTap)
            .on("click", doMetricTap)
            .style("text-anchor", me.cfg.labelPosition == "right" ? "start" : "end" )
            .attr("x", me.cfg.labelPosition == "right" ? circleCenterX + me.cfg.dialRadius + 10 :  circleCenterX - me.cfg.dialRadius - 10)
            .attr("y", 0 )//seems that we need this slight vertical adjustment with the radius increases.
            .text(function(d, i) { return d.label; })
            .append("tspan")
            .attr("x", me.cfg.labelPosition == "right" ?  circleCenterX + me.cfg.dialRadius + 10 :   circleCenterX - me.cfg.dialRadius - 10)
            .attr("dy", 12)
            .classed("small-label2", true)
            .text(function(d, i)  { return d.value; })
        ;


    };


    var doMetricTap = function(d, i) {


        if (me.cfg.onItemClick) {

            me.cfg.onItemClick(d, i);
        }
/*
        var selIdx = i;

        console.log("in doMetricTap");
        console.log(d);
        console.log(this);


        svg.selectAll(".metric-group")
            .filter(function(d, i) { return (selIdx != i);  })
            .transition()
           // .attr("transform", function(d, i) { return "translate(-500, " + (i * cfg.itemVerticalSpacing + 40) + ")"; })
            .style("opacity", 0.0)
            .duration(500);


        svg.select(".connector-line")
            .transition()
            .style("opacity", 0.0)
            .duration(500);


        if (tapFn) {  tapFn(d); }
*/
    };


    //TODO: move styles out into classes in app.scss

   //brute force clear out the node for now
   d3.select(me.cfg.containerSelector).selectAll("*").remove();

   // Private utility functions to get the point color
   var getPointColorClass = function(score) {
        return (score > me.cfg.healthRange.lower && score < me.cfg.healthRange.upper) ? 'healthy' : 'unhealthy';
   };

   var calculatedHeight = 0;

   d3.json(me.cfg.dataUrl + "?" + new Date().getTime(), function(error, data) {

       calculatedHeight = data.length * ((me.cfg.dialRadius * 2) + me.cfg.dialSpacing) + (me.cfg.dialRadius * 2);

       svg = d3.select(me.cfg.containerSelector).append("svg")
           .attr("class", "health-dial")
           .attr("width", me.cfg.width + 150)
           .attr("height", data.length * ((me.cfg.dialRadius * 2) + me.cfg.dialSpacing) + (me.cfg.dialRadius * 2) );





       //extension line
       svg.append("line")
           .attr("x1", circleCenterX + (me.cfg.dialRadius + 1))
           .attr("y1", 15 )
           .attr("x2", circleCenterX + (me.cfg.dialRadius + 1) )
           .attr("y2", data.length * ((me.cfg.dialRadius * 2) + me.cfg.dialSpacing ) + (me.cfg.dialRadius * 2))
           .attr("class", "needle good");



       doDataChange(data);





    });  //end d3.json()



};