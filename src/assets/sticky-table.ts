enum WrapperMode {
    Outer = 1,
    Inner
}
enum ScrollDataType {
    Left = 1,
    Top
}
class ScrollData {
    max: number;
    position: number;
    percent: number;

    constructor(max: number, position: number, percent: number) {
        this.max = max;
        this.position = position;
        this.percent = percent;
    }
}

export class ScrollParentFinder {
    regex = /(auto|scroll)/;

    private parents(node, ps) {
        if (node.parentNode === null) {
            return ps;
        }

        return this.parents(node.parentNode, ps.concat([node]));
    };

    private style(node, prop) {
        return getComputedStyle(node, null).getPropertyValue(prop);
    };

    private overflow(node) {
        return this.style(node, "overflow") + this.style(node, "overflow-y") + this.style(node, "overflow-x");
    };

    private scroll(node) {
        return this.regex.test(this.overflow(node));
    };

    public find(node) {
        if (!(node instanceof HTMLElement || node instanceof SVGElement)) {
            return;
        }

        let ps = this.parents(node.parentNode, []);

        for (let i = 0; i < ps.length; i += 1) {
            if (this.scroll(ps[i])) {
                return ps[i];
            }
        }

        return document.body;
    };
}
export class StickyTable {
    scrollParentFinder = new ScrollParentFinder();
    constructor() {
    }


    private wrapInDivInternal(elm: Element, className: string, mode: string) {
        let wrapper = document.createElement("div");
        wrapper.className = className;
        if (mode === "innerHTML") {
            let childNodes = [];
            for (let i = 0; i < elm.childNodes.length; i++) {
                childNodes.push(elm.childNodes[i]);
            }
            for (let i = 0; i < childNodes.length; i++) {
                let child = childNodes[i];
                child.parentNode.removeChild(child);
                wrapper.appendChild(child);
            }
            elm.appendChild(wrapper);
        } else {
            let parent = elm.parentNode;
            parent.insertBefore(wrapper, elm);
            elm.parentNode.removeChild(elm);
            wrapper.appendChild(elm);
        }
        return elm;
    }
    private wrapContentsInDiv(elm: Element, className: string) {
        return this.wrapInDivInternal(elm, className, "innerHTML").children[0];
    }
    private wrapInDiv(elm: Element, className: string) {
        return this.wrapInDivInternal(elm, className, "outerHTML").parentElement;
    }
    private listen(element: Element, event: string, handler: EventListenerOrEventListenerObject) {
        if (element.addEventListener) {
            element.addEventListener(event, handler, false);
        }
        else if (element["attachEvent"]) {
            element["attachEvent"]('on' + event, handler);
        }
    }

    private getScrollData(elm: HTMLElement, type: ScrollDataType): ScrollData {
        let maxScrollName = "scrollHeight";
        let maxName = "height";
        let positionName = "scrollTop";
        if (type === ScrollDataType.Left) {
            maxScrollName = "scrollWidth";
            maxName = "width";
            positionName = "scrollLeft";
        }
        let scrollMax = parseFloat(elm[maxScrollName]);
        let size = parseFloat(elm.style[maxName]);
        let max = scrollMax - size;
        let position = parseFloat(elm[positionName]);
        let percent = (1.0 / max) * position;
        return new ScrollData(
            max,
            position,
            percent
        );

    }

    public applyTo(table: HTMLTableElement) {
        let $this = this;
        let fixed = this.wrapInDiv(table, "sticky-table-fixed");
        let content = this.wrapInDiv(fixed, "sticky-table-content");
        let scrollable = this.wrapInDiv(content, "sticky-table-scrollable");

        let getRow = function (row: number): Element {
            return table.children[0].children[row];
        }
        let getCell = function (row: number, column: number): Element {
            return getRow(row).children[column];
        }
        let wrapCell = function (row, column, className) {
            let cell = getCell(row, column);
            cell.className += " " + className + " content-container";
            let content = $this.wrapContentsInDiv(cell, "content");
            return {
                cell: cell,
                content: content
            };
        };
        let corner = wrapCell(0, 0, "corner");
        let header = wrapCell(0, 1, "header");
        let columns = wrapCell(1, 0, "columns");
        let data = wrapCell(1, 1, "data");
        let row1 = getRow(0);
        row1.className += " row1";
        let row2 = getRow(1);
        row2.className += " row2";

        // Disable horizontal scrolling "back button" effect
        // in Chrome, and also scrolling the parent scrollable
        // element when scrolling our content (usually the body)
        let scrollLimiter = function (event) {
            // We don't want to scroll below zero or above the width and height 
            let maxX = this.scrollWidth - this.offsetWidth;
            let maxY = this.scrollHeight - this.offsetHeight;

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
        };

        this.listen(scrollable, "mousewheel", scrollLimiter);
        this.listen(scrollable, "wheel", scrollLimiter);

        let syncScroll = function (method, syncFrom, syncTo) {
            let fromScroll = $this.getScrollData(syncFrom, method);
            let toScroll = $this.getScrollData(syncTo, method);
            let toPosition = toScroll.max * fromScroll.percent;
            syncTo[method] = toPosition;
        };

        this.listen(scrollable, "scroll", function () {
            syncScroll("scrollTop", scrollable, data.cell);
            syncScroll("scrollTop", scrollable, columns.cell);
            syncScroll("scrollLeft", scrollable, data.cell);
            syncScroll("scrollLeft", scrollable, header.cell);
        });

        let setStyle = function (elm, style, value) {
            elm.style[style] = parseFloat(value) + "px";
        }

        let resize = function (width, height) {
            let fullContentWidth = columnsWidth + dataWidth;
            let fullContentHeight = headerHeight + dataHeight;
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
            let visibleDataWidth = scrollable.clientWidth - columnsWidth;
            let visibleDataHeight = scrollable.clientHeight - headerHeight;
            setStyle(data.cell, "width", visibleDataWidth);
            setStyle(data.cell, "height", visibleDataHeight);
            setStyle(header.cell, "width", visibleDataWidth);
        };

        let onWheel = function (event) {
            let elm = scrollable;
            let eo = event.wheelDelta ? event :
                (event.originalEvent ? event.originalEvent : event);
            let xy = eo.wheelDelta || -eo.detail; //shortest possible code
            let x = -eo.wheelDeltaX || eo.deltaX || (eo.axis == 1 ? xy : 0);
            let y = -eo.wheelDeltaY || eo.deltaY || (eo.axis == 2 ? xy : 0); // () necessary!
            let maxX = elm.scrollWidth - elm.clientWidth;
            let maxY = elm.scrollHeight - elm.clientHeight;
            if (x !== undefined) {
                let newScrollLeft = elm.scrollLeft + x;
                let newScrollTop = elm.scrollTop + y;
                let propogate = false;
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
        $this.listen(scrollable, "DOMMouseScroll", onWheel);
        $this.listen(scrollable, "mousewheel", onWheel);
        $this.listen(scrollable, "wheel", onWheel);

        // Resolve the scrollable parent for scrolling the parent
        // once we've scrolled on an extreme X or Y
        let parentWithScrollEvents = $this.scrollParentFinder.find(scrollable);
        let parentWithScrollBar = parentWithScrollEvents;
        if (parentWithScrollEvents === document.body) {
            parentWithScrollEvents = window;
        }
        let syncDocumentScrollPosition = function () {
            setStyle(fixed, "marginTop", -parentWithScrollBar.scrollTop);
            setStyle(fixed, "marginLeft", -parentWithScrollBar.scrollLeft);
        };
        // Sync with scrollable parent
        $this.listen(parentWithScrollEvents, "scroll", function () {
            syncDocumentScrollPosition();
        });
        syncDocumentScrollPosition();
        // Just to be sure
        setTimeout(syncDocumentScrollPosition, 500);

        // Resolve these from a hidden, rendered version of the table
        let columnsWidth = 60;
        let dataWidth = 640;
        let headerHeight = 20;
        let dataHeight = 680;

        // Whatever we want
        resize(250, 250);
        resize(200, 200);
    }
}
document.addEventListener("DOMContentLoaded", function (event) {
    let sticky = new StickyTable();
    sticky.applyTo(document.getElementById("table") as HTMLTableElement);
});