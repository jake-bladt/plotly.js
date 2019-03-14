/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var Registry = require('../../registry');

module.exports = function selectPoints(searchInfo, selectionTester) {
    var cd = searchInfo.cd;
    var selection = [];
    var fullData = cd[0].trace;

    var oldGroups = fullData.node.groups.slice();
    var nodes = fullData._sankey.graph.nodes;

    for(var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var pos = [node.x0, node.y0];
        if(fullData.orientation === 'v') pos.reverse();

        if(selectionTester.contains(pos, false, i, searchInfo)) {
            // If the node represents a group
            if(node.group) {
                // Add all its children to the current selection
                for(var k = 0; k < node.childrenNodes.length; k++) {
                    selection.push(node.childrenNodes[k]);
                }
                // Flag group for removal from existing list of groups
                oldGroups[node.pointNumber - fullData.node._count] = false;
            } else {
                selection.push(node);
            }
        }
    }

    var newGroups = oldGroups.filter(function(g) { return g; })
      .concat([selection.map(function(g) { return g.pointNumber;})]);

    Registry.call('_guiRestyle', gd, {
        'node.groups': [ newGroups ]
    }).catch(function() {}); // TODO will this ever fail?

    return selection;
};
