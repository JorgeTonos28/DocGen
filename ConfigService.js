function getConfigMap_(forceRefresh) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'docgen:config';
  if (!forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  const configRows = getSheetRecords_(SHEETS.CONFIG);
  const config = {};
  configRows.forEach(function(row) {
    config[normalizeString_(row.key)] = row.value;
  });

  cache.put(cacheKey, JSON.stringify(config), 300);
  return config;
}

function clearConfigCache_() {
  CacheService.getScriptCache().remove('docgen:config');
}

function getConfigValue_(key, fallback) {
  const config = getConfigMap_();
  return Object.prototype.hasOwnProperty.call(config, key) ? config[key] : fallback;
}

function setConfigValue_(key, value, description) {
  const configRows = getSheetRecords_(SHEETS.CONFIG);
  const existing = configRows.find(function(row) {
    return normalizeString_(row.key) === key;
  });

  if (existing) {
    existing.value = value;
    existing.description = description != null ? description : existing.description;
    updateSheetRecords_(SHEETS.CONFIG, [existing]);
  } else {
    appendSheetRecords_(SHEETS.CONFIG, [{
      key: key,
      value: value,
      description: description || ''
    }]);
  }

  clearConfigCache_();
}

function getClientConfig_() {
  return {
    appName: getConfigValue_('app_name', APP_NAME),
    institutionName: getConfigValue_('institution_name', 'INFOTEP'),
    supportEmail: getConfigValue_('support_email', ''),
    primaryColor: getConfigValue_('primary_color', '#003366'),
    secondaryColor: getConfigValue_('secondary_color', '#F37021'),
    uiSignatureWidthPx: toNumber_(getConfigValue_('ui_signature_width_px', 168), 168),
    uiSignatureHeightPx: toNumber_(getConfigValue_('ui_signature_height_px', 0), 0),
    maxCeafPerDocument: toNumber_(getConfigValue_('max_ceaf_per_document', 3), 3),
    certDateLookbackDays: toNumber_(getConfigValue_('cert_date_lookback_days', 31), 31),
    printAutoOpen: normalizeBoolean_(getConfigValue_('print_auto_open', 'false'))
  };
}

function getImageDataUrlFromConfig_(key) {
  const fileId = normalizeString_(getConfigValue_(key, ''));
  if (!fileId) {
    return '';
  }
  try {
    const metadata = getDriveFileMetadata_(fileId);
    if (metadata.mimeType && metadata.mimeType.indexOf('image/') !== 0) {
      throw new Error('El archivo configurado en ' + key + ' no es una imagen valida de Drive.');
    }

    const blob = DriveApp.getFileById(fileId).getBlob();
    const contentType = blob.getContentType() || metadata.mimeType || 'image/png';
    const base64 = Utilities.base64Encode(blob.getBytes());
    return 'data:' + contentType + ';base64,' + base64;
  } catch (error) {
    console.error('DocGen image load failed for ' + key + ': ' + normalizeConfigError_(error));
    return '';
  }
}

function getLogoDataUrl_() {
  return getImageDataUrlFromConfig_('logo_file_id');
}

function getSignatureDataUrl_() {
  return getImageDataUrlFromConfig_('signature_file_id');
}

function getDriveFileMetadata_(fileId) {
  return Drive.Files.get(fileId, {
    fields: 'id,name,mimeType'
  });
}

function normalizeConfigError_(error) {
  if (!error) {
    return 'Error desconocido.';
  }
  if (typeof error === 'string') {
    return error;
  }
  return error.message || JSON.stringify(error);
}

function getNextDocumentId_() {
  const configRows = getSheetRecords_(SHEETS.CONFIG);
  const existing = configRows.find(function(row) {
    return normalizeString_(row.key) === 'document_sequence';
  });
  const nextSequence = toNumber_(existing ? existing.value : 0, 0) + 1;
  const currentYear = Utilities.formatDate(new Date(), getAppTimeZone_(), 'yyyy');

  if (existing) {
    existing.value = String(nextSequence);
    updateSheetRecords_(SHEETS.CONFIG, [existing]);
  } else {
    appendSheetRecords_(SHEETS.CONFIG, [{
      key: 'document_sequence',
      value: String(nextSequence),
      description: 'Secuencia incremental para IDs de documentos'
    }]);
  }

  clearConfigCache_();
  return 'OF-' + currentYear + '-' + padNumber_(nextSequence, 5);
}
