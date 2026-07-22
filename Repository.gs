function getDataSpreadsheet_() {
  const spreadsheetId = normalizeString_(PropertiesService.getScriptProperties().getProperty('DOCGEN_SPREADSHEET_ID'));
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    return active;
  }
  throw new Error('No se encontro una hoja de calculo vinculada. Configure DOCGEN_SPREADSHEET_ID en Script Properties o vincule el proyecto a una spreadsheet.');
}

const TEXT_FORMAT_COLUMNS = Object.freeze({
  Documentos: ['ceaf_summary', 'numeracion_summary'],
  DocumentoLineas: ['ceaf', 'cert_prefix', 'numeracion']
});

function getSheetByNameOrThrow_(sheetName) {
  const headers = SHEET_HEADERS[sheetName];
  if (headers && headers.length) {
    return ensureSheetStructure_(sheetName, headers);
  }

  const sheet = getDataSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('No existe la hoja requerida: ' + sheetName + '. Ejecute setupDocGen() primero.');
  }
  return sheet;
}

function ensureSheetStructure_(sheetName, headers) {
  const spreadsheet = getDataSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  ensureSheetSize_(sheet, headers.length, 2);

  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const existingHeaders = lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(normalizeString_) : [];
  const needsMigration = !headers.every(function(header, index) {
    return existingHeaders[index] === header;
  });

  if (!lastRow) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  if (!needsMigration) {
    if (sheet.getFrozenRows() !== 1) {
      sheet.setFrozenRows(1);
    }
    if (lastRow >= 2) {
      applyTextColumnFormats_(sheetName, sheet, headers, 2, lastRow - 1);
    }
    return sheet;
  }

  const records = readRawSheetRecords_(sheet, lastRow, lastColumn, existingHeaders);
  const rows = records.map(function(record) {
    return headers.map(function(header) {
      return record[header] != null ? record[header] : '';
    });
  });

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) {
    ensureSheetSize_(sheet, headers.length, rows.length + 1);
    applyTextColumnFormats_(sheetName, sheet, headers, 2, rows.length);
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function getSheetRecords_(sheetName) {
  const sheet = getSheetByNameOrThrow_(sheetName);
  const headers = SHEET_HEADERS[sheetName] || [];
  const lastRow = sheet.getLastRow();
  const columnCount = headers.length || sheet.getLastColumn();
  if (lastRow < 2 || columnCount === 0) {
    return [];
  }

  const values = sheet.getRange(2, 1, lastRow - 1, columnCount).getValues();
  return values
    .map(function(row, index) {
      const hasData = row.some(function(cell) {
        return normalizeString_(cell) !== '';
      });
      if (!hasData) {
        return null;
      }
      const record = {};
      headers.forEach(function(header, columnIndex) {
        record[header] = row[columnIndex];
      });
      record.__rowNum = index + 2;
      return record;
    })
    .filter(Boolean);
}

function appendSheetRecords_(sheetName, records) {
  if (!records || !records.length) {
    return;
  }
  const sheet = getSheetByNameOrThrow_(sheetName);
  const headers = SHEET_HEADERS[sheetName];
  const rows = records.map(function(record) {
    return headers.map(function(header) {
      return record[header] != null ? record[header] : '';
    });
  });
  const startRow = sheet.getLastRow() + 1;
  ensureSheetSize_(sheet, headers.length, startRow + rows.length - 1);
  applyTextColumnFormats_(sheetName, sheet, headers, startRow, rows.length);
  sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
}

function updateSheetRecords_(sheetName, records) {
  if (!records || !records.length) {
    return;
  }
  const sheet = getSheetByNameOrThrow_(sheetName);
  const headers = SHEET_HEADERS[sheetName];
  records.forEach(function(record) {
    if (!record.__rowNum) {
      throw new Error('Falta __rowNum para actualizar en ' + sheetName);
    }
    const row = headers.map(function(header) {
      return record[header] != null ? record[header] : '';
    });
    ensureSheetSize_(sheet, headers.length, record.__rowNum);
    applyTextColumnFormats_(sheetName, sheet, headers, record.__rowNum, 1);
    sheet.getRange(record.__rowNum, 1, 1, headers.length).setValues([row]);
  });
}

function findRecordByField_(sheetName, fieldName, value) {
  const normalizedTarget = normalizeString_(value);
  return getSheetRecords_(sheetName).find(function(record) {
    return normalizeString_(record[fieldName]) === normalizedTarget;
  }) || null;
}

function getRecordMapByField_(records, fieldName) {
  return records.reduce(function(accumulator, record) {
    accumulator[normalizeString_(record[fieldName])] = record;
    return accumulator;
  }, {});
}

function ensureSheetSize_(sheet, minColumns, minRows) {
  const requiredColumns = Math.max(1, toNumber_(minColumns, 1));
  const requiredRows = Math.max(1, toNumber_(minRows, 1));

  if (sheet.getMaxColumns() < requiredColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredColumns - sheet.getMaxColumns());
  }
  if (sheet.getMaxRows() < requiredRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
  }
}

function applyTextColumnFormats_(sheetName, sheet, headers, startRow, rowCount) {
  const fields = TEXT_FORMAT_COLUMNS[sheetName] || [];
  if (!fields.length || rowCount <= 0) {
    return;
  }

  fields.forEach(function(field) {
    const columnIndex = headers.indexOf(field) + 1;
    if (columnIndex > 0) {
      sheet.getRange(startRow, columnIndex, rowCount, 1).setNumberFormat('@');
    }
  });
}

function readRawSheetRecords_(sheet, lastRow, lastColumn, existingHeaders) {
  if (lastRow < 2 || !lastColumn) {
    return [];
  }
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  return values
    .filter(function(row) {
      return row.some(function(cell) {
        return normalizeString_(cell) !== '';
      });
    })
    .map(function(row) {
      return existingHeaders.reduce(function(record, header, index) {
        if (header) {
          record[header] = row[index];
        }
        return record;
      }, {});
    });
}
