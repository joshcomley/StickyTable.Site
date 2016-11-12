window.readyHandlers = [];
window.ready = function ready(handler) {
    window.readyHandlers.push(handler);
    handleState();
};

window.handleState = function handleState() {
    if (['interactive', 'complete'].indexOf(document.readyState) > -1) {
        while (window.readyHandlers.length > 0) {
            (window.readyHandlers.shift())();
        }
    }
};

document.onreadystatechange = window.handleState;
// self executing function here
ready(function () {
    var scollParent = (function () {
        var regex = /(auto|scroll)/;

        var parents = function (node, ps) {
            if (node.parentNode === null) {
                return ps;
            }

            return parents(node.parentNode, ps.concat([node]));
        };

        var style = function (node, prop) {
            return getComputedStyle(node, null).getPropertyValue(prop);
        };

        var overflow = function (node) {
            return style(node, "overflow") + style(node, "overflow-y") + style(node, "overflow-x");
        };

        var scroll = function (node) {
            return regex.test(overflow(node));
        };

        var scrollParent = function (node) {
            if (!(node instanceof HTMLElement || node instanceof SVGElement)) {
                return;
            }

            var ps = parents(node.parentNode, []);

            for (var i = 0; i < ps.length; i += 1) {
                if (scroll(ps[i])) {
                    return ps[i];
                }
            }

            return document.body;
        };

        return scrollParent;
    })();
    var wrapInDivInternal = function (elm, className, mode, reresolveElement) {
        var wrapper = document.createElement("div");
        wrapper.className = className;
        if (mode === "innerHTML") {
            var childNodes = [];
            for (var i = 0; i < elm.childNodes.length; i++) {
                childNodes.push(elm.childNodes[i]);
            }
            for (var i = 0; i < childNodes.length; i++) {
                var child = childNodes[i];
                child.parentNode.removeChild(child);
                wrapper.appendChild(child);
            }
            elm.appendChild(wrapper);
        } else {
            var parent = elm.parentNode;
            parent.insertBefore(wrapper, elm);
            elm.parentNode.removeChild(elm);
            wrapper.appendChild(elm);
        }
        return elm;
    }
    var wrapContentsInDiv = function (elm, className, reresolveElement) {
        return wrapInDivInternal(elm, className, "innerHTML", reresolveElement).children[0];
    }
    var wrapInDiv = function (elm, className, reresolveElement) {
        return wrapInDivInternal(elm, className, "outerHTML", reresolveElement).parentElement;
    }
    var listen = function (element, event, handler) {
        if (element.addEventListener) {
            element.addEventListener(event, handler, false);
        }
        else if (el.attachEvent) {
            element.attachEvent('on' + event, handler);
        }
    }
    var table = document.getElementById("table");
    var fixed = wrapInDiv(table, "sticky-table-fixed");
    var content = wrapInDiv(fixed, "sticky-table-content");
    var scrollable = wrapInDiv(content, "sticky-table-scrollable");

    var getRow = function (row) {
        return table.children[0].children[row];
    }
    var getCell = function (row, column) {
        return getRow(row).children[column];
    }
    var wrapCell = function (row, column, className) {
        var resolve = function () {
            return getCell(row, column);
        };
        var cell = resolve();
        cell.className += " " + className + " content-container";
        var content = wrapContentsInDiv(cell, "content", resolve);
        return {
            cell: cell,
            content: content
        };
    };
    var corner = wrapCell(0, 0, "corner");
    var header = wrapCell(0, 1, "header");
    var columns = wrapCell(1, 0, "columns");
    var data = wrapCell(1, 1, "data");
    var row1 = getRow(0);
    row1.className += " row1";
    var row2 = getRow(1);
    row2.className += " row2";
    //  $("#wrapper").scroll(function(event) {
    //    event.preventDefault();
    //    event.returnValue = false;
    //  });
    // Disable horizontal scrolling "back button" effect
    // in Chrome, and also scrolling the parent scrollable
    // element when scrolling our content (usually the body)
    var scrollLimiter = function (event) {
        // We don't want to scroll below zero or above the width and height 
        var maxX = this.scrollWidth - this.offsetWidth;
        var maxY = this.scrollHeight - this.offsetHeight;

        // If this event looks like it will scroll beyond the bounds of the element, prevent it and set the scroll to the boundary manually 
        event.preventDefault();
        if (this.scrollLeft + event.deltaX < 0 ||
            this.scrollLeft + event.deltaX > maxX ||
            this.scrollTop + event.deltaY < 0 ||
            this.scrollTop + event.deltaY > maxY) {
            // Manually set the scroll to the boundary
            this.scrollLeft = Math.max(0, Math.min(maxX, this.scrollLeft + event.deltaX));
            this.scrollTop = Math.max(0, Math.min(maxY, this.scrollTop + event.deltaY));
        }
        //    }
    };
    listen(scrollable, 'mousewheel', scrollLimiter);
    listen(scrollable, 'wheel', scrollLimiter);
    //  $(".sticky-table-scrollable").scroll(function() {
    //    $("#wrapper").scrollTop($(".sticky-table-scrollable").scrollTop());
    //    $("#wrapper").scrollLeft($(".sticky-table-scrollable").scrollLeft());
    //  });


    var scrollData = function (elm, type) {
        var maxScrollName = "scrollHeight";
        var maxName = "height";
        if (type === "scrollLeft") {
            maxScrollName = "scrollWidth";
            maxName = "width";
        }
        var scrollMax = parseFloat(elm[maxScrollName]);
        var size = parseFloat(elm.style[maxName]);
        var max = scrollMax - size;
        var position = parseFloat(elm[type]);
        var percent = (1.0 / max) * position;
        return {
            max: max,
            position: position,
            percent: percent
        };
    }

    var syncScroll = function (method, syncFrom, syncTo) {
        var fromScroll = scrollData(syncFrom, method);
        var toScroll = scrollData(syncTo, method);
        var toPosition = toScroll.max * fromScroll.percent;
        syncTo[method] = toPosition;
    };

    listen(scrollable, "scroll", function () {
        syncScroll("scrollTop", scrollable, data.cell);
        syncScroll("scrollTop", scrollable, columns.cell);
        syncScroll("scrollLeft", scrollable, data.cell);
        syncScroll("scrollLeft", scrollable, header.cell);
    });

    var setStyle = function (elm, style, value) {
        elm.style[style] = parseFloat(value) + "px";
    }

    var resize = function (width, height) {
        var fullContentWidth = columnsWidth + dataWidth;
        var fullContentHeight = headerHeight + dataHeight;
        setStyle(columns.cell, "width", columnsWidth);
        setStyle(columns.cell, "height", dataHeight);
        setStyle(columns.content, "width", columnsWidth);
        setStyle(columns.content, "height", dataHeight);

        setStyle(row1, "height", headerHeight);
        setStyle(row2, "height", dataHeight);

        setStyle(corner.cell, "width", columnsWidth);
        setStyle(corner.cell, "height", headerHeight);
        setStyle(corner.content, "width", columnsWidth);
        setStyle(corner.content, "height", headerHeight);

        setStyle(data.cell, "marginLeft", columnsWidth);
        setStyle(header.cell, "marginLeft", columnsWidth);
        setStyle(data.content, "width", dataWidth);
        setStyle(data.content, "height", dataHeight);

        setStyle(header.content, "width", dataWidth);
        setStyle(header.content, "height", headerHeight);

        setStyle(content, "width", fullContentWidth);
        setStyle(content, "height", fullContentHeight);

        setStyle(scrollable, "width", width);
        setStyle(scrollable, "height", height);

        setStyle(fixed, "width", scrollable.clientWidth);
        setStyle(fixed, "height", scrollable.clientHeight);
        var visibleDataWidth = scrollable.clientWidth - columnsWidth;
        var visibleDataHeight = scrollable.clientHeight - headerHeight;
        setStyle(data.cell, "width", visibleDataWidth);
        setStyle(data.cell, "height", visibleDataHeight);
        setStyle(header.cell, "width", visibleDataWidth);
    };

    var onWheel = function (event) {
        var elm = scrollable;
        var eo = event.wheelDelta ? event :
            (event.originalEvent ? event.originalEvent : event);
        var xy = eo.wheelDelta || -eo.detail; //shortest possible code
        var x = -eo.wheelDeltaX || eo.deltaX || (eo.axis == 1 ? xy : 0);
        var y = -eo.wheelDeltaY || eo.deltaY || (eo.axis == 2 ? xy : 0); // () necessary!
        var maxX = elm.scrollWidth - elm.clientWidth;
        var maxY = elm.scrollHeight - elm.clientHeight;
        if (x !== undefined) {
            var newScrollLeft = elm.scrollLeft + x;
            var newScrollTop = elm.scrollTop + y;
            var propogate = false;
            if (newScrollLeft < 0) {
                propogate = true;
                newScrollLeft = 0;
            }
            if (newScrollLeft > maxX) {
                propogate = true;
                newScrollLeft = maxX;
            }
            if (newScrollTop < 0) {
                propogate = true;
                newScrollTop = 0;
            }
            if (newScrollTop > maxY) {
                propogate = true;
                newScrollTop = maxY;
            }
            elm.scrollLeft = newScrollLeft;
            elm.scrollTop = newScrollTop;
            return propogate;
        }
        return true;
    };
    listen(scrollable, "DOMMouseScroll", onWheel);
    listen(scrollable, "mousewheel", onWheel);
    listen(scrollable, "wheel", onWheel);

    // Resolve the scrollable parent for scrolling the parent
    // once we've scrolled on an extreme X or Y
    var parentWithScrollEvents = scollParent(scrollable);
    var parentWithScrollBar = parentWithScrollEvents;
    if (parentWithScrollEvents === document.body) {
        parentWithScrollEvents = window;
    }
    var syncDocumentScrollPosition = function () {
        setStyle(fixed, "marginTop", -parentWithScrollBar.scrollTop);
        setStyle(fixed, "marginLeft", -parentWithScrollBar.scrollLeft);
    };
    // Sync with scrollable parent
    listen(parentWithScrollEvents, "scroll", function () {
        syncDocumentScrollPosition();
    });
    syncDocumentScrollPosition();
    // Just to be sure
    setTimeout(syncDocumentScrollPosition, 500);

    // Resolve these from a hidden, rendered version of the table
    var columnsWidth = 60;
    var dataWidth = 640;
    var headerHeight = 20;
    var dataHeight = 680;

    // Whatever we want
    resize(250, 250);
    resize(200, 200);
});