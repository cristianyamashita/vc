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
    wrap: svg('<path d="M3 4.5h10M3 8h7a2.5 2.5 0 0 1 0 5H8" ' + stroke + '/><path d="M8 11.5 6.5 13 8 14.5" ' + stroke + '/>'),
  };

  function get(name) {
    return ICONS[name] || "";
  }

  return { get, ICONS };
})();
