class StickyTablesWrappedCell {
    cell: HTMLTableCellElement;
    content: HTMLElement;

    constructor(cell: HTMLTableCellElement, content: HTMLElement) {
        this.cell = cell;
        this.content = content;
    }
}
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

class ElementSize {
    width: number;
    height: number;
    innerHeight: number;
    innerWidth: number;

    constructor(width: number, height: number,
        innerWidth: number, innerHeight: number) {
        this.width = width;
        this.height = height;
        this.innerWidth = innerWidth;
        this.innerHeight = innerHeight;
    }
}

export class StickyTableRegion {
    startColumn = 0;
    endRow = 0;

    constructor(startColumn: number, endRow: number) {
        this.startColumn = startColumn;
        this.endRow = endRow;
    }
}

class StickyTableRegionInternal extends StickyTableRegion {
    endColumn = 0;
    startRow = 0;

    constructor(startColumn: number, endColumn: number, startRow: number, endRow: number) {
        super(startColumn, endRow);
        this.endColumn = endColumn;
        this.startRow = startRow;
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
    table: HTMLTableElement;
    headerRegion: StickyTableRegion;
    setSizeIncrement = 0;
    incrementTimeout: NodeJS.Timer = null;
    fixed: HTMLElement;
    content: HTMLElement;
    scrollable: HTMLElement;
    corner: StickyTablesWrappedCell;
    columns: StickyTablesWrappedCell;
    header: StickyTablesWrappedCell;
    data: StickyTablesWrappedCell;
    tableRows: Array<HTMLTableRowElement>;
    row1: HTMLTableRowElement;
    row2: HTMLTableRowElement;

    constructor(table: HTMLTableElement, headerRegion: StickyTableRegion) {
        this.table = table;
        this.headerRegion = headerRegion;
    }

    private wrapInDivInternal(elm: Element, className: string, mode: string): Element {
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
    private wrapContentsInDiv(elm: Element, className: string): HTMLElement {
        return this.wrapInDivInternal(elm, className, "innerHTML").children[0] as HTMLElement;
    }
    private wrapInDiv(elm: Element, className: string): HTMLElement {
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

    public cloneCell(cellToClone: HTMLTableCellElement): HTMLTableCellElement {
        let clone = document.createElement(cellToClone.nodeName) as HTMLTableCellElement;
        clone.innerHTML = cellToClone.innerHTML;
        for (var i = 0, atts = cellToClone.attributes, n = atts.length, arr = []; i < n; i++) {
            let attr2 = document.createAttribute(atts[i].nodeName);
            attr2.value = atts[i].value;
            clone.attributes.setNamedItem(attr2);
        }
        return clone;
    }

    private setSizeAttr(elem: HTMLElement, attr: string, size: number) {
        let sizeString = size + "px";
        elem.style[attr] = sizeString;
        elem.style["min-" + attr] = sizeString;
        elem.style["max-" + attr] = sizeString;
    }
    private increment() {
        if (this.incrementTimeout !== null) {
            clearTimeout(this.incrementTimeout);
        }
        this.setSizeIncrement++;
    }
    private decrement() {
        this.setSizeIncrement--;
        let $this = this;
        if (this.setSizeIncrement === 0) {
            this.incrementTimeout = setTimeout(function () {
                $this.resize(800, 500);
                console.log("Sticky Table - Sizing complete");
            }, 50);
        }
    }
    private setSizeInner(targetSize: ElementSize, attemptedSize: ElementSize, setWidth, setHeight, elm: HTMLElement) {
        this.increment();
        let widthSet: any = false;
        let heightSet: any = false;
        let targetWidthSet: any = false;
        let targetHeightSet: any = false;
        if (setWidth === true) {
            widthSet = attemptedSize.width;
            targetWidthSet = targetSize.width;
        } else if (setWidth === "inner") {
            widthSet = attemptedSize.innerWidth;
            targetWidthSet = targetSize.innerWidth;
        }
        if (setHeight === true) {
            heightSet = attemptedSize.height;
            targetHeightSet = targetSize.innerHeight;
        } else if (setHeight === "inner") {
            heightSet = attemptedSize.innerHeight;
            targetHeightSet = targetSize.innerHeight;
        }
        let widthAdjustDirection = 0;
        let heightAdjustDirection = 0;
        let anythingSet = false;
        if (widthSet !== false && widthSet >= 0) {
            anythingSet = true;
            this.setSizeAttr(elm, "width", widthSet);
        }
        if (heightSet !== false && heightSet >= 0) {
            anythingSet = true;
            this.setSizeAttr(elm, "height", heightSet);
        }
        if (anythingSet && (widthSet !== false || heightSet !== false)) {
            let newSize = this.getSize(elm);
            if (widthSet !== false) {
                if (newSize.innerWidth - targetWidthSet > 0.1 ||
                    newSize.innerWidth - targetWidthSet < -0.1) {
                    widthAdjustDirection = -(newSize.innerWidth - targetWidthSet);
                }
            }
            if (heightSet !== false) {
                if (newSize.innerHeight - targetHeightSet > 0.1 ||
                    newSize.innerHeight - targetHeightSet < -0.1) {
                    heightAdjustDirection = -(newSize.innerHeight - targetHeightSet);
                }
            }
            if (widthAdjustDirection !== 0 || heightAdjustDirection !== 0) {
                attemptedSize.width += widthAdjustDirection;
                attemptedSize.innerWidth += widthAdjustDirection;
                attemptedSize.height += heightAdjustDirection;
                attemptedSize.innerHeight += heightAdjustDirection;
                setTimeout(() => {
                    this.setSizeInner(targetSize, attemptedSize, setWidth, setHeight, elm);
                },
                    0);
            }
        }
        this.decrement();
    }

    private getSize(el: HTMLElement): ElementSize {
        //if (el.innerText.indexOf("Course") === 0) {
        //    debugger;
        //}
        let h: string = null;
        let w: string = null;
        let innerH: number = null;
        let innerW: number = null;
        if (window.getComputedStyle) {
            const size = window.getComputedStyle(el, null);
            h = size.height;
            w = size.width;
            innerH = parseFloat(size.height) - (parseFloat(size.borderTopWidth) +
                parseFloat(size.borderBottomWidth) +
                parseFloat(size.paddingTop) +
                parseFloat(size.paddingBottom) +
                parseFloat(size.marginTop) +
                parseFloat(size.marginBottom));
            innerW = parseFloat(size.width) - (parseFloat(size.borderLeftWidth) +
                parseFloat(size.borderRightWidth) +
                parseFloat(size.paddingLeft) +
                parseFloat(size.paddingRight) +
                parseFloat(size.marginLeft) +
                parseFloat(size.marginRight));
        }
        if (isNaN(parseFloat(h))) {
            h = el.scrollHeight.toString();
        }
        if (isNaN(parseFloat(w))) {
            w = el.scrollWidth.toString();
        }
        return new ElementSize(
            parseFloat(w), parseFloat(h),
            innerW || parseFloat(el.style.width), innerH || parseFloat(el.style.height));
    }

    private setSize(elem: HTMLElement,
        targetSize: ElementSize,
        attemptedSize: ElementSize,
        width, height) {
        setTimeout(() => {
            this.setSizeInner(targetSize, attemptedSize, width, height, elem);
        },
            0);
    }

    private cloneSize(elSource, elClone, width, height): ElementSize {
        let size = this.getSize(elSource);
        let size2 = this.getSize(elSource);
        // Doing this in a setTimeout of zero dramatically increases the
        // performance by allowing it to multi-thread
        if (width || height) {
            this.setSize(elClone, size, size2, width, height);
        }
        return size;
    }

    public cloneTablePortion(elm: HTMLTableElement, startColumn: number, startRow: number, endColumn?: number, endRow?: number)
        : HTMLTableElement {
        let maxWidth = 0;
        var $sourceTable = elm;
        var $cloneTable = this.cloneElement($sourceTable);
        let $cloneRows = $cloneTable.getElementsByTagName("tr");
        if (!endRow) {
            endRow = $cloneRows.length;
        }
        let rowsToRemove = new Array<HTMLTableRowElement>();
        let row = -1;
        let columnWidths = [];
        for (var i = 0; i < $cloneRows.length; i++) {
            let elem = $cloneRows[i];
            if (i < startRow || i > endRow) {
                rowsToRemove.push(elem as HTMLTableRowElement);
                continue;
            }
            row++;
            let $sourceRow = $sourceTable.getElementsByTagName("tr")[i];
            this.cloneSize(
                $sourceRow,
                elem,
                false,
                true);

            let $cloneRow = elem;
            let $sourceCells = $sourceRow.querySelectorAll("td,th");
            let $cloneCells = $cloneRow.querySelectorAll("td,th");
            let end = endColumn;
            if (!end) {
                end = $sourceCells.length;
            }
            // Go through each cell
            for (let j = 0, columnIndex = 0; j < end; j++) {
                let sourceCell = $sourceCells[j] as HTMLTableCellElement;
                let cloneCell = $cloneCells[j] as HTMLTableCellElement;
                let size: ElementSize;
                if (
                    row < 3 ||
                    !columnWidths[columnIndex]
                ) {
                    size = this.cloneSize(
                        sourceCell,
                        cloneCell,
                        "inner",
                        false);
                    columnWidths[columnIndex] = size.innerWidth;
                }
                else {
                    size = this.getSize(sourceCell);
                }
                if (size.width > maxWidth) {
                    maxWidth = size.width;
                }
                columnIndex += sourceCell.colSpan;
            }
            if (endColumn || startColumn) {
                let index = 0;
                var endIndex = endColumn || Number.MAX_VALUE;
                var start = startColumn || 0;
                let cellsToRemove = new Array<HTMLTableCellElement>();
                for (var k = 0; k < $cloneCells.length; k++) {
                    var cell = $cloneCells[k] as HTMLTableCellElement;
                    if (index > endIndex || index < start) {
                        cellsToRemove.push(cell);
                    }
                    index += cell.colSpan;
                }
                for (let remove of cellsToRemove) {
                    remove.parentElement.removeChild(remove);
                }
            }
        }
        for (let row of rowsToRemove) {
            row.parentElement.removeChild(row);
        }
        $cloneTable.style.width = maxWidth + "px";
        return $cloneTable as HTMLTableElement;
    }

    public cloneElement(element: HTMLElement): HTMLElement {
        let parent: HTMLElement;
        let tagName = element.nodeName.toLowerCase();
        if (["th", "td"].indexOf(tagName) !== -1) {
            let row = document.createElement("tr");
            let table = document.createElement("table");
            table.appendChild(row);
            parent = row;
        } else if (["tr"].indexOf(tagName) !== -1) {
            parent = document.createElement("table");
        }
        else {
            parent = document.createElement("div");
        }
        parent.innerHTML = element.outerHTML;
        let child = parent.children[0];
        parent.removeChild(child);
        return child as HTMLElement;
        //element.parentNode.insertBefore(newDiv.children[0], element);
    }

    public apply() {
        let tableClone = this.cloneElement(this.table);

        let newTable = document.createElement("table");
        let row1 = document.createElement("tr");
        let row2 = document.createElement("tr");
        newTable.appendChild(row1);
        newTable.appendChild(row2);
        let corner = document.createElement("td");
        let header = document.createElement("td");
        let columns = document.createElement("td");
        let data = document.createElement("td");
        row1.appendChild(corner);
        row1.appendChild(header);
        row2.appendChild(columns);
        row2.appendChild(data);

        //row2.appendChild(data);
        // corner.innerHTML = "Corner";
        // data.innerHTML = "Data";
        // columns.innerHTML = "Columns";
        // header.innerHTML = "Header";
        this.table.parentNode.insertBefore(newTable, this.table);

        // let cellToMove = table.getElementsByClassName("myspecialfield")[0] as HTMLTableCellElement;
        // let cellClone = this.cloneElement(cellToMove);
        // cellToMove.parentNode.insertBefore(cellClone, cellToMove);
        // cellToMove.parentNode.removeChild(cellToMove);
        // row2.appendChild(cellToMove);

        let columnRegion = new StickyTableRegionInternal(
            0,
            this.headerRegion.startColumn - 1,
            this.headerRegion.endRow + 1,
            -1
        );
        let dataRegion = new StickyTableRegionInternal(
            columnRegion.endColumn + 1,
            -1,
            columnRegion.startRow,
            -1
        );
        let cornerRegion = new StickyTableRegionInternal(
            0,
            columnRegion.endColumn,
            0,
            this.headerRegion.endRow
        );
        let headerPortion =
            this.cloneTablePortion(this.table, this.headerRegion.startColumn, 0, null, this.headerRegion.endRow);
        header.appendChild(headerPortion);
        let columnsPortion =
            this.cloneTablePortion(this.table, columnRegion.startColumn, columnRegion.startRow, columnRegion.endColumn, null);
        columns.appendChild(columnsPortion);
        let cornerPortion =
            this.cloneTablePortion(this.table, 0, 0, cornerRegion.endColumn, cornerRegion.endRow);
        corner.appendChild(cornerPortion);
        let dataPortion =
            this.cloneTablePortion(this.table, dataRegion.startColumn, dataRegion.startRow, null, null);
        data.appendChild(dataPortion);
        this.table.className += " sticky-table-original";
        this.applyTo(newTable);
    }
    private hasClass(ele: HTMLElement, cls: string) {
        if (!ele.className) {
            return false;
        }
        return !!ele.className.match(new RegExp('(\\s|^)' + cls + '(\\s|$)'));
    }

    private addClass(ele: HTMLElement, cls: string) {
        if (!this.hasClass(ele, cls)) {
            if (!ele.className) {
                ele.className = cls;
            } else {
                ele.className += " " + cls;
            }
        }
    }

    private removeClass(ele: HTMLElement, cls: string) {
        if (this.hasClass(ele, cls)) {
            var reg = new RegExp('(\\s|^)' + cls + '(\\s|$)');
            ele.className = ele.className.replace(reg, ' ');
        }
    }

    public resize(width, height) {
        // Resolve these from a hidden, rendered version of the table
        let columnsWidth = this.columns.content.children[0].scrollWidth;
        let headerHeight = this.header.content.children[0].scrollHeight;
        let dataWidth = this.data.content.children[0].scrollWidth;
        let dataHeight = this.data.content.children[0].scrollHeight;

        let fullContentWidth = columnsWidth + dataWidth;
        let fullContentHeight = headerHeight + dataHeight;
        this.setStyle(this.columns.cell, "width", columnsWidth);
        this.setStyle(this.columns.cell, "height", dataHeight);
        this.setStyle(this.columns.content, "width", columnsWidth);
        this.setStyle(this.columns.content, "height", dataHeight);

        this.setStyle(this.row1, "height", headerHeight);
        this.setStyle(this.row2, "height", dataHeight);

        this.setStyle(this.corner.cell, "width", columnsWidth);
        this.setStyle(this.corner.cell, "height", headerHeight);
        this.setStyle(this.corner.content, "width", columnsWidth);
        this.setStyle(this.corner.content, "height", headerHeight);

        this.setStyle(this.data.cell, "marginLeft", columnsWidth);
        this.setStyle(this.header.cell, "marginLeft", columnsWidth);
        this.setStyle(this.data.content, "width", dataWidth);
        this.setStyle(this.data.content, "height", dataHeight);

        this.setStyle(this.header.content, "width", dataWidth);
        this.setStyle(this.header.content, "height", headerHeight);

        this.setStyle(this.content, "width", fullContentWidth);
        this.setStyle(this.content, "height", fullContentHeight);

        this.setStyle(this.scrollable, "width", width);
        this.setStyle(this.scrollable, "height", height);

        this.setStyle(this.fixed, "width", this.scrollable.clientWidth);
        this.setStyle(this.fixed, "height", this.scrollable.clientHeight);
        let visibleDataWidth = this.scrollable.clientWidth - columnsWidth;
        let visibleDataHeight = this.scrollable.clientHeight - headerHeight;
        this.setStyle(this.data.cell, "width", visibleDataWidth);
        this.setStyle(this.data.cell, "height", visibleDataHeight);
        this.setStyle(this.columns.cell, "height", visibleDataHeight);
        this.setStyle(this.header.cell, "width", visibleDataWidth);
    };

    private getRow(row: number): HTMLTableRowElement {
        return this.tableRows[row] as HTMLTableRowElement;
    }

    private getCell(row: number, column: number): HTMLTableCellElement {
        return this.getRow(row).children[column] as HTMLTableCellElement;
    }

    private wrapCell(row, column, className): StickyTablesWrappedCell {
        let cell = this.getCell(row, column);
        cell.className += " " + className + " sticky-table-cell-content-container";
        let content = this.wrapContentsInDiv(cell, "sticky-table-cell-content");
        return new StickyTablesWrappedCell(cell, content);
    }

    private setStyle(elm: HTMLElement, style: string, value: any) {
        elm.style[style] = parseFloat(value) + "px";
    }

    public applyTo(table: HTMLTableElement) {
        let $this = this;
        this.table = table;
        this.fixed = $this.wrapInDiv(this.table, "sticky-table-fixed");
        this.content = $this.wrapInDiv(this.fixed, "sticky-table-content");
        this.scrollable = $this.wrapInDiv(this.content, "sticky-table-scrollable");
        let findRows = function (root: Element): Array<HTMLTableRowElement> {
            let tableRows = new Array<HTMLTableRowElement>();
            let children = root.children;
            for (let index = 0; index < children.length; index++) {
                let elm = children[index];
                if (elm instanceof HTMLTableRowElement) {
                    tableRows.push(elm);
                } else if (elm.children && elm.children.length) {
                    tableRows = tableRows.concat(findRows(elm));
                }
            }
            return tableRows;
        }
        this.tableRows = findRows(table);
        //let tableRows2 = findRows(table);
        this.corner = this.wrapCell(0, 0, "corner");
        this.header = this.wrapCell(0, 1, "header");
        this.columns = this.wrapCell(1, 0, "columns");
        this.data = this.wrapCell(1, 1, "data");
        this.row1 = this.getRow(0);
        this.addClass(this.row1, "row1");
        this.row2 = this.getRow(1);
        this.addClass(this.row2, "row2");

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

        $this.listen($this.scrollable, "mousewheel", scrollLimiter);
        $this.listen($this.scrollable, "wheel", scrollLimiter);

        let syncScroll = function (method: ScrollDataType, syncFrom: HTMLElement, syncTo: HTMLElement) {
            let fromScroll = $this.getScrollData(syncFrom, method);
            let toScroll = $this.getScrollData(syncTo, method);
            let toPosition = toScroll.max * fromScroll.percent;
            switch (method) {
                case ScrollDataType.Left:
                    syncTo.scrollLeft = toPosition;
                    break;
                case ScrollDataType.Top:
                    syncTo.scrollTop = toPosition;
                    break;
            }
        };

        $this.listen($this.scrollable, "scroll", function () {
            syncScroll(ScrollDataType.Top, $this.scrollable, $this.data.cell);
            syncScroll(ScrollDataType.Top, $this.scrollable, $this.columns.cell);
            syncScroll(ScrollDataType.Left, $this.scrollable, $this.data.cell);
            syncScroll(ScrollDataType.Left, $this.scrollable, $this.header.cell);
        });

        let onWheel = function (event) {
            let elm = $this.scrollable;
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
        $this.listen(this.scrollable, "DOMMouseScroll", onWheel);
        $this.listen(this.scrollable, "mousewheel", onWheel);
        $this.listen(this.scrollable, "wheel", onWheel);

        // Resolve the scrollable parent for scrolling the parent
        // once we've scrolled on an extreme X or Y
        let parentWithScrollEvents = $this.scrollParentFinder.find(this.scrollable);
        let parentWithScrollBar = parentWithScrollEvents;
        if (parentWithScrollEvents === document.body) {
            parentWithScrollEvents = window;
        }
        let syncDocumentScrollPosition = function () {
            $this.setStyle($this.fixed, "marginTop", -parentWithScrollBar.scrollTop);
            $this.setStyle($this.fixed, "marginLeft", -parentWithScrollBar.scrollLeft);
        };
        // Sync with scrollable parent
        $this.listen(parentWithScrollEvents, "scroll", function () {
            syncDocumentScrollPosition();
        });
        syncDocumentScrollPosition();
        // Just to be sure
        setTimeout(syncDocumentScrollPosition, 500);

        // Whatever we want
        //        resize(250, 250);
    }
}
document.addEventListener("DOMContentLoaded", function (event) {
    let sticky = new StickyTable(document.getElementById("matrix") as HTMLTableElement,
        new StickyTableRegion(3, 2));
    sticky.apply();
});