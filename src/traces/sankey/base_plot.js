/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var overrideAll = require('../../plot_api/edit_types').overrideAll;
var getModuleCalcData = require('../../plots/get_data').getModuleCalcData;
var plot = require('./plot');
var fxAttrs = require('../../components/fx/layout_attributes');

var setCursor = require('../../lib/setcursor');
var dragElement = require('../../components/dragelement');
var prepSelect = require('../../plots/cartesian/select').prepSelect;
var Lib = require('../../lib');
var Registry = require('../../registry');

var SANKEY = 'sankey';

exports.name = SANKEY;

exports.baseLayoutAttrOverrides = overrideAll({
    hoverlabel: fxAttrs.hoverlabel
}, 'plot', 'nested');

exports.plot = function(gd) {
    var calcData = getModuleCalcData(gd.calcdata, SANKEY)[0];
    plot(gd, calcData);
};

exports.clean = function(newFullData, newFullLayout, oldFullData, oldFullLayout) {
    var hadPlot = (oldFullLayout._has && oldFullLayout._has(SANKEY));
    var hasPlot = (newFullLayout._has && newFullLayout._has(SANKEY));

    if(hadPlot && !hasPlot) {
        oldFullLayout._paperdiv.selectAll('.sankey').remove();
    }
};

exports.updateFx = function(gd) {
    var fullLayout = gd._fullLayout;

    for(var i = 0; i < gd._fullData.length; i++) {
        subplotUpdateFx(gd, i, fullLayout);
    }
};

var oldDragOptions = [];
var dragOptions = [];
function subplotUpdateFx(gd, i, fullLayout) {
    var dragMode = fullLayout.dragmode;
    var cursor = fullLayout.dragmode === 'pan' ? 'move' : 'crosshair';
    var bgRect = gd._fullData[i]._bgRect;

    setCursor(bgRect, cursor);

    var xaxis = {
        _id: 'x',
        c2p: function(v) { return v; },
        _offset: bgRect.node().getAttribute('x'),
        _length: bgRect.node().getAttribute('width')
    };
    var yaxis = {
        _id: 'y',
        c2p: function(v) { return v; },
        _offset: bgRect.node().getAttribute('y'),
        _length: bgRect.node().getAttribute('height')
    };

    var fillRangeItems;
    if(dragMode === 'select') {
        fillRangeItems = makeFillRangeItems(gd, i);
    } else if(dragMode === 'lasso') {
        Lib.warn('Lasso mode is not yet supported.');
    }

    // Note: dragOptions is needed to be declared for all dragmodes because
    // it's the object that holds persistent selection state.
    oldDragOptions[i] = dragOptions[i] || {};
    dragOptions[i] = Lib.extendDeep(oldDragOptions[i], {
        gd: gd,
        element: bgRect.node(),
        plotinfo: {
            id: i,
            xaxis: xaxis,
            yaxis: yaxis,
            fillRangeItems: fillRangeItems
        },
        subplot: i,
        // create mock x/y axes for hover routine
        xaxes: [xaxis],
        yaxes: [yaxis]
    });

    var fn = dragOptions[i];

    dragOptions[i].prepFn = function(e, startX, startY) {
        prepSelect(e, startX, startY, fn, dragMode);
    };

    dragElement.init(dragOptions[i]);
}

function makeFillRangeItems(gd, i) {
    return function(eventData, poly) {
        var fullData = gd._fullData[i];
        var oldGroups = fullData.node.groups.slice();
        var nodes = fullData._sankey.graph.nodes;
        for(var j = 0; j < nodes.length; j++) {
            var node = nodes[j];
            if(node.partOfGroup) continue; // Those are invisible

            // Take into account the orientation
            var compare;
            if(fullData.orientation === 'v') {
                compare = {
                    xmin: poly.ymin,
                    xmax: poly.ymax,
                    ymin: poly.xmin,
                    ymax: poly.xmax
                };
            } else {
                compare = poly;
            }

            var doNotOverlap = compare.xmin > node.x1 || compare.xmax < node.x0 || compare.ymin > node.y1 || compare.ymax < node.y0;
            if(!doNotOverlap) {
                // If the node represents a group
                if(node.group) {
                    // Add all its children to the current selection
                    for(var k = 0; k < node.childrenNodes.length; k++) {
                        eventData.points.push(node.childrenNodes[k].pointNumber);
                    }
                    // Flag group for removal from existing list of groups
                    oldGroups[node.pointNumber - fullData.node._count] = false;
                } else {
                    eventData.points.push(node.pointNumber);
                }
            }
        }
        var newGroups = oldGroups.filter(function(g) { return g; }).concat([eventData.points]);
        return Registry.call('_guiRestyle', gd, {
            'node.groups': [ newGroups ]
        }).catch(function() {}); // TODO will this ever fail?
    };
}
