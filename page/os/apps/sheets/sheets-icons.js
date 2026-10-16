window.OSSheetsIcons = (function () {
  function svg(inner) {
    return (
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      inner +
      "</svg>"
    );
  }

  const stroke = 'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"';
  const fill = 'fill="currentColor"';

  const ICONS = {
    fileNew: svg('<path d="M4 2.5h5.5L12 5v8.5H4z" ' + stroke + '/><path d="M9.5 2.5V5H12" ' + stroke + '/>'),
    fileOpen: svg('<path d="M2.5 13V4.5h3l1.2 1.5H13.5V13z" ' + stroke + '/>'),
    fileSave: svg('<path d="M3 3h8.5L13 4.5V13H3z" ' + stroke + '/><path d="M5 3v3.5h6V3M5 13v-4h6v4" ' + stroke + '/>'),
    fileSaveAs: svg('<path d="M2.5 3h7.5L12 4.5V12H2.5z" ' + stroke + '/><path d="M4.5 3v3h5V3M4.5 12V8.5h5V12" ' + stroke + '/><path d="M13 9.5v4M11.2 11.7 13 13.5l1.8-1.8" ' + stroke + '/>'),
    fileImport: svg('<path d="M8 2.5v7M5.5 7.5 8 10l2.5-2.5" ' + stroke + '/><path d="M3 11.5V13.5h10v-2" ' + stroke + '/>'),
    fileExport: svg('<path d="M8 10.5v-8M5.5 5 8 2.5 10.5 5" ' + stroke + '/><path d="M3 11.5V13.5h10v-2" ' + stroke + '/>'),
    undo: svg('<path d="M4 7h6.5a3 3 0 0 1 0 6H8" ' + stroke + '/><path d="M4 7 6.5 4.5M4 7l2.5 2.5" ' + stroke + '/>'),
    redo: svg('<path d="M12 7H5.5a3 3 0 0 0 0 6H8" ' + stroke + '/><path d="M12 7 9.5 4.5M12 7 9.5 9.5" ' + stroke + '/>'),
    cut: svg('<circle cx="5" cy="11.5" r="2" ' + stroke + '/><circle cx="11" cy="11.5" r="2" ' + stroke + '/><path d="M8 9.5 4 2.5M8 9.5 12 2.5" ' + stroke + '/>'),
    copy: svg('<rect x="5.5" y="4" width="7" height="8" rx="1" ' + stroke + '/><path d="M3.5 6v7.5h7" ' + stroke + '/>'),
    paste: svg('<rect x="3.5" y="4.5" width="9" height="9" rx="1" ' + stroke + '/><path d="M6 4.5V3.5h4v1" ' + stroke + '/><path d="M6 8h4M6 10.5h3" ' + stroke + '/>'),
    bold: svg('<path d="M4.5 3h5a2.5 2.5 0 0 1 0 5H4.5zM4.5 8h5.5a2.5 2.5 0 0 1 0 5H4.5z" ' + stroke + '/>'),
    italic: svg('<path d="M7 3h5M4 13h5M9.5 3 6.5 13" ' + stroke + '/>'),
    underline: svg('<path d="M4.5 3v6a3.5 3.5 0 0 0 7 0V3M3.5 13.5h9" ' + stroke + '/>'),
    alignLeft: svg('<path d="M3 4h10M3 8h7M3 12h10" ' + stroke + '/>'),
    alignCenter: svg('<path d="M3 4h10M5 8h6M3 12h10" ' + stroke + '/>'),
    alignRight: svg('<path d="M3 4h10M6 8h7M3 12h10" ' + stroke + '/>'),
    merge: svg('<rect x="2.5" y="3.5" width="5" height="4" ' + stroke + '/><rect x="8.5" y="3.5" width="5" height="4" ' + stroke + '/><rect x="2.5" y="8.5" width="11" height="4" ' + stroke + '/><path d="M5.5 5.5h5M8 4.2v2.6" ' + stroke + '/>'),
    fillColor: svg('<rect x="3" y="3" width="10" height="7" rx="1" ' + stroke + '/><path d="M3 13h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
    fontColor: svg('<path d="M5 11.5 8 3.5l3 8M6.2 8.5h3.6" ' + stroke + '/><path d="M3 13.5h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
    percent: svg('<circle cx="5" cy="5" r="1.4" ' + stroke + '/><circle cx="11" cy="11" r="1.4" ' + stroke + '/><path d="M11.5 4 4.5 12" ' + stroke + '/>'),
    currency: svg('<path d="M8 2.5v11M10.5 4.5C10 3.7 9.1 3.3 8 3.3c-1.8 0-3 1-3 2.3s1.4 2.2 3 2.4c1.7.2 3.2.9 3.2 2.5s-1.4 2.5-3.4 2.5c-1.3 0-2.3-.5-2.9-1.3" ' + stroke + '/>'),
    yen: svg('<path d="m4 3 4 5 4-5M8 8v5M5.5 10h5M5.5 12h5" ' + stroke + '/>'),
    decMore: svg('<path d="M3 11.5h2.2M6.8 11.5h2.2M10.6 11.5h2.2M8 3.5v6M5.5 7.2 8 9.5l2.5-2.3" ' + stroke + '/>'),
    decLess: svg('<path d="M3 11.5h2.2M6.8 11.5h2.2M8 9.5V3.5M5.5 5.8 8 3.5l2.5 2.3" ' + stroke + '/>'),
    fx: svg('<path d="M4 3.5h5.5M6.2 3.5 4.8 12.5M5 8h4" ' + stroke + '/><path d="M11 6.5v5M9.5 8l3 3M12.5 8l-3 3" ' + stroke + '/>'),
    insertRow: svg('<path d="M3 3.5h10v9H3zM3 7h10" ' + stroke + '/><path d="M8 8.2v3.3M6.4 9.8h3.2" ' + stroke + '/>'),
    deleteRow: svg('<path d="M3 3.5h10v9H3zM3 7h10" ' + stroke + '/><path d="M6.2 9.2h3.6" ' + stroke + '/>'),
    insertCol: svg('<path d="M3 3.5h10v9H3zM8 3.5v9" ' + stroke + '/><path d="M10.7 7.2v3.3M9.1 8.8h3.2" ' + stroke + '/>'),
    deleteCol: svg('<path d="M3 3.5h10v9H3zM8 3.5v9" ' + stroke + '/><path d="M9.2 8.8h3.4" ' + stroke + '/>'),
    addSheet: svg('<path d="M3.5 4h6.5l2.5 2.5V13h-9z" ' + stroke + '/><path d="M8 7.5v4M6 9.5h4" ' + stroke + '/>'),
    strike: svg('<path d="M5 4.5c.5-1 1.6-1.5 3-1.5 2 0 3.2 1 3.2 2.2 0 .8-.4 1.3-1.2 1.8M4.5 11.5c.5 1 1.7 1.7 3.5 1.7 2.2 0 3.5-1.1 3.5-2.4 0-.6-.2-1-.6-1.4M3 8h10" ' + stroke + '/>'),
    valignTop: svg('<path d="M3 3h10M5.5 6h5v7h-5z" ' + stroke + '/>'),
    valignMiddle: svg('<path d="M3 8h2.5M10.5 8H13M5.5 4.5h5v7h-5z" ' + stroke + '/>'),
    valignBottom: svg('<path d="M3 13h10M5.5 3h5v7h-5z" ' + stroke + '/>'),
    borders: svg('<rect x="3" y="3" width="10" height="10" ' + stroke + '/><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1" stroke-dasharray="1.5 1.5"/>'),
    comma: svg('<path d="M4 3.5h2.2M8.4 3.5h2.2M4 7.5h2.2M8.4 7.5h2.2" ' + stroke + '/><path d="M7.5 10.5c1 0 1.6.6 1.6 1.4 0 1-.8 1.8-1.8 2.3" ' + stroke + '/>'),
    condFormat: svg('<rect x="2.5" y="3" width="11" height="10" rx="1" ' + stroke + '/><path d="M2.5 6.5h11M2.5 10h11M6 3v10" ' + stroke + '/><rect x="6.5" y="7" width="6.5" height="2.6" ' + fill + ' opacity="0.7"/>'),
    clear: svg('<path d="M9.5 3 13 6.5l-6 6H4.5L2.5 10.5z" ' + stroke + '/><path d="M6.5 6 10 9.5M3 14h10" ' + stroke + '/>'),
    sortAsc: svg('<path d="M4 3v10M2.2 11 4 13l1.8-2" ' + stroke + '/><path d="M8 4h2M8 7h3.5M8 10h5" ' + stroke + '/>'),
    sortDesc: svg('<path d="M4 3v10M2.2 11 4 13l1.8-2" ' + stroke + '/><path d="M8 4h5M8 7h3.5M8 10h2" ' + stroke + '/>'),
    filterToggle: svg('<path d="M2.5 3.5h11l-4.2 5v4l-2.6-1.3V8.5z" ' + stroke + '/>'),
    filterClear: svg('<path d="M2.5 3.5h9l-3.4 4.2v3.6l-2.4-1.2V7.7z" ' + stroke + '/><path d="M10.5 10.5l3 3M13.5 10.5l-3 3" ' + stroke + '/>'),
    find: svg('<circle cx="7" cy="7" r="4" ' + stroke + '/><path d="M10 10l3.5 3.5" ' + stroke + '/>'),
    caret: svg('<path d="M4.5 6.5 8 10l3.5-3.5" ' + stroke + '/>'),
    paintFormat: svg('<rect x="3" y="2.5" width="8" height="3.5" rx="0.8" ' + stroke + '/><path d="M11 4.5h2v3H7.5v6" ' + stroke + '/>'),
    insertChart: svg('<path d="M2.5 13.5h11" ' + stroke + '/><rect x="3.5" y="8" width="2.4" height="4.5" ' + fill + '/><rect x="7" y="4" width="2.4" height="8.5" ' + fill + '/><rect x="10.5" y="6" width="2.4" height="6.5" ' + fill + '/>'),
    insertNote: svg('<path d="M3 3.5h10v7H7l-3 2.5v-2.5H3z" ' + stroke + '/><path d="M5.5 6h5M5.5 8h3" ' + stroke + '/>'),
    insertDate: svg('<rect x="2.5" y="3.5" width="11" height="9.5" rx="1" ' + stroke + '/><path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" ' + stroke + '/><rect x="5" y="8.5" width="2" height="2" ' + fill + '/>'),
    insertTime: svg('<circle cx="8" cy="8" r="5.5" ' + stroke + '/><path d="M8 4.5V8l2.5 1.5" ' + stroke + '/>'),
    insertCheck: svg('<rect x="2.5" y="2.5" width="11" height="11" rx="2" ' + stroke + '/><path d="m5 8 2 2 4-4.5" ' + stroke + '/>'),
    insertRowBelow: svg('<path d="M3 3.5h10v9H3zM3 9h10" ' + stroke + '/><path d="M8 4.2v3.3M6.4 5.8h3.2" ' + stroke + '/>'),
    insertColRight: svg('<path d="M3 3.5h10v9H3zM8 3.5v9" ' + stroke + '/><path d="M5.3 7.2v3.3M3.7 8.8h3.2" ' + stroke + '/>'),
    autosum: svg('<path d="M12 3.5H4.5L8.5 8l-4 4.5H12" ' + stroke + '/>'),
    autosumMenu: svg('<path d="M4.5 6.5 8 10l3.5-3.5" ' + stroke + '/>'),
    names: svg('<rect x="2.5" y="3.5" width="11" height="9" rx="1" ' + stroke + '/><path d="M5 7h6M5 9.5h4" ' + stroke + '/>'),
    defineName: svg('<rect x="2.5" y="3.5" width="8" height="9" rx="1" ' + stroke + '/><path d="M5 7h3M5 9.5h3M12.5 6v4M10.5 8h4" ' + stroke + '/>'),
    showFormulas: svg('<path d="M3.5 4.5h4M5.3 4.5 4.2 11.5M3.8 8h3" ' + stroke + '/><path d="M9 5.5h4.5M9 8h4.5M9 10.5h4.5" ' + stroke + '/>'),
    recalc: svg('<path d="M13 8a5 5 0 0 1-8.7 3.4M3 8a5 5 0 0 1 8.7-3.4" ' + stroke + '/><path d="M11.5 2.5v2.5H9M4.5 13.5V11H7" ' + stroke + '/>'),
    traceErrors: svg('<path d="M8 2.5 14 13H2z" ' + stroke + '/><path d="M8 6.5v3M8 11.2v.3" ' + stroke + '/>'),
    sortDialog: svg('<path d="M3 4h10M3 8h7M3 12h4" ' + stroke + '/><path d="M12 7v6M10.2 11 12 13l1.8-2" ' + stroke + '/>'),
    removeDup: svg('<rect x="5.5" y="5" width="7" height="7" rx="1" ' + stroke + '/><path d="M3.5 9V4h5" ' + stroke + '/><path d="M7.5 7l3 3M10.5 7l-3 3" ' + stroke + '/>'),
    textToCols: svg('<rect x="2.5" y="4" width="11" height="8" rx="1" ' + stroke + '/><path d="M6.3 4v8M9.7 4v8" ' + stroke + '/>'),
    trimSpaces: svg('<path d="M3 5h10M5 8h6M3 11h10" ' + stroke + '/><path d="M2 2.5 14 13.5" stroke="currentColor" stroke-width="1" opacity="0.5"/>'),
    fillDown: svg('<rect x="3" y="3" width="10" height="10" ' + stroke + '/><path d="M3 6.3h10M8 7.5v4M6.3 9.8 8 11.5l1.7-1.7" ' + stroke + '/>'),
    fillRight: svg('<rect x="3" y="3" width="10" height="10" ' + stroke + '/><path d="M6.3 3v10M7.5 8h4M9.8 6.3 11.5 8l-1.7 1.7" ' + stroke + '/>'),
    fillSeries: svg('<path d="M3 12.5h10" ' + stroke + '/><path d="M3 10 6 7l2.5 2L13 4" ' + stroke + '/><path d="M10.5 4H13v2.5" ' + stroke + '/>'),
    freezeTop: svg('<rect x="2.5" y="3" width="11" height="10" ' + stroke + '/><path d="M2.5 6.5h11" stroke="currentColor" stroke-width="2.2"/><path d="M8 6.5v6.5M2.5 9.7h11" ' + stroke + '/>'),
    freezeFirstCol: svg('<rect x="2.5" y="3" width="11" height="10" ' + stroke + '/><path d="M6 3v10" stroke="currentColor" stroke-width="2.2"/><path d="M6 8h7.5M9.8 3v10" ' + stroke + '/>'),
    freezePanes: svg('<rect x="2.5" y="3" width="11" height="10" ' + stroke + '/><path d="M6 3v10M2.5 6.5h11" stroke="currentColor" stroke-width="2.2"/>'),
    unfreeze: svg('<rect x="2.5" y="3" width="11" height="10" ' + stroke + '/><path d="M6 3v10M2.5 6.5h11M9.8 3v10M2.5 9.7h11" ' + stroke + '/>'),
    gridlines: svg('<rect x="2.5" y="2.5" width="11" height="11" ' + stroke + '/><path d="M6.2 2.5v11M9.8 2.5v11M2.5 6.2h11M2.5 9.8h11" stroke="currentColor" stroke-width="1" opacity="0.6"/>'),
    zoomIn: svg('<circle cx="7" cy="7" r="4" ' + stroke + '/><path d="M10 10l3.5 3.5M7 5v4M5 7h4" ' + stroke + '/>'),
    zoomOut: svg('<circle cx="7" cy="7" r="4" ' + stroke + '/><path d="M10 10l3.5 3.5M5 7h4" ' + stroke + '/>'),
    zoomReset: svg('<circle cx="7" cy="7" r="4" ' + stroke + '/><path d="M10 10l3.5 3.5" ' + stroke + '/>'),
    hideRows: svg('<rect x="2.5" y="3" width="11" height="10" ' + stroke + '/><path d="M2.5 8h11" ' + stroke + '/><path d="M5 5.5h6M5 10.5h6" stroke="currentColor" stroke-width="1" opacity="0.5"/>'),
    unhideRows: svg('<rect x="2.5" y="3" width="11" height="10" ' + stroke + '/><path d="M2.5 6.3h11M2.5 9.7h11" ' + stroke + '/>'),
    hideCols: svg('<rect x="2.5" y="3" width="11" height="10" ' + stroke + '/><path d="M8 3v10" ' + stroke + '/><path d="M5.3 5.5v5M10.7 5.5v5" stroke="currentColor" stroke-width="1" opacity="0.5"/>'),
    unhideCols: svg('<rect x="2.5" y="3" width="11" height="10" ' + stroke + '/><path d="M6.2 3v10M9.8 3v10" ' + stroke + '/>'),
    help: svg('<circle cx="8" cy="8" r="5.5" ' + stroke + '/><path d="M6.3 6.5a1.7 1.7 0 1 1 2.6 1.4c-.6.4-.9.7-.9 1.4M8 11.3v.2" ' + stroke + '/>'),
    print: svg('<path d="M5 6V3h6v3M4 11H2.5V6.5h11V11H12" ' + stroke + '/><rect x="5" y="9" width="6" height="4" ' + stroke + '/>'),
    fileExportCsv: svg('<path d="M4 2.5h5.5L12 5v8.5H4z" ' + stroke + '/><path d="M6 8h4M6 10.5h4" ' + stroke + '/>'),
    fileExportXlsx: svg('<path d="M4 2.5h5.5L12 5v8.5H4z" ' + stroke + '/><path d="M6 7.5 10 11.5M10 7.5 6 11.5" ' + stroke + '/>'),
    fileExportVcsh: svg('<path d="M4 2.5h5.5L12 5v8.5H4z" ' + stroke + '/><path d="M6 8h4M8 6.5v4.5" ' + stroke + '/>'),
    chart: svg('<path d="M2.5 13.5h11" ' + stroke + '/><rect x="3.5" y="8" width="2.4" height="4.5" ' + fill + '/><rect x="7" y="4" width="2.4" height="8.5" ' + fill + '/><rect x="10.5" y="6" width="2.4" height="6.5" ' + fill + '/>'),
    wrap: svg('<path d="M3 4.5h10M3 8h7a2.5 2.5 0 0 1 0 5H8" ' + stroke + '/><path d="M8 11.5 6.5 13 8 14.5" ' + stroke + '/>'),
  };

  function get(name) {
    return ICONS[name] || "";
  }

  return { get, ICONS };
})();
