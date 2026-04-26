function archiveDocuments_(documentIds, user) {
  const actor = user || assertAuthorizedUser_();
  const ids = Array.isArray(documentIds) ? documentIds : [];
  if (!ids.length) {
    throw new Error('No se seleccionaron documentos para anular.');
  }

  const records = getSheetRecords_(SHEETS.DOCUMENTS)
    .filter(function(record) {
      return ids.indexOf(record.document_id) !== -1;
    });

  if (!records.length) {
    throw new Error('No se encontraron documentos válidos.');
  }

  records.forEach(function(record) {
    if (!isAdminUser_(actor) && normalizeEmail_(record.owner_email) !== actor.email) {
      throw new Error('No tienes permisos para anular uno de los documentos seleccionados.');
    }
    record.status = DOCUMENT_STATUS.ARCHIVED;
    record.deleted_at = nowIsoString_();
    record.deleted_by_email = actor.email;
    record.updated_at = nowIsoString_();
    record.updated_by_email = actor.email;
  });

  updateSheetRecords_(SHEETS.DOCUMENTS, records);

  records.forEach(function(record) {
    logAudit_('DOCUMENT', record.document_id, 'ARCHIVED', actor, 'Documento anulado.', {
      documentId: record.document_id
    });
  });

  return {
    archivedIds: records.map(function(record) { return record.document_id; })
  };
}

function markDocumentPrinted_(documentId, user) {
  const actor = user || assertAuthorizedUser_();
  const header = findRecordByField_(SHEETS.DOCUMENTS, 'document_id', documentId);
  if (!header) {
    throw new Error('No se encontró el documento a marcar como impreso.');
  }
  if (!isAdminUser_(actor) && normalizeEmail_(header.owner_email) !== actor.email) {
    throw new Error('No tienes permisos para imprimir este documento.');
  }

  header.last_printed_at = nowIsoString_();
  header.last_printed_by_email = actor.email;
  header.updated_at = nowIsoString_();
  header.updated_by_email = actor.email;
  updateSheetRecords_(SHEETS.DOCUMENTS, [header]);

  logAudit_('DOCUMENT', documentId, 'PRINTED', actor, 'Documento enviado a impresión.', {
    documentId: documentId
  });

  return {
    ok: true
  };
}

function prepareDuplicateDocument_(documentId, user) {
  const detail = getDocumentDetail_(documentId, user || assertAuthorizedUser_());
  return {
    documentId: '',
    documentType: detail.document.documentType,
    regionalAbreviatura: detail.document.regionalAbreviatura,
    notes: detail.document.notes || '',
    lines: detail.lines.map(function(line) {
      return {
        ceaf: line.ceaf,
        tipoConvenio: line.tipoConvenio,
        centro: line.centro,
        certPrefix: line.certPrefix,
        numeracion: '',
        fechaCertificacion: todayIsoDate_()
      };
    })
  };
}

function validateDocumentPayload_(payload, actor) {
  const config = getClientConfig_();
  const maxLines = config.maxCeafPerDocument;
  const regionalAbreviatura = normalizeUpper_(payload.regionalAbreviatura);
  const lines = Array.isArray(payload.lines) ? payload.lines : [];

  if (!regionalAbreviatura) {
    throw new Error('Debe seleccionar una regional.');
  }
  if (!lines.length) {
    throw new Error('Debe agregar al menos una línea CEAF.');
  }
  if (lines.length > maxLines) {
    throw new Error('No se permiten más de ' + maxLines + ' líneas por documento.');
  }

  const snapshot = getCatalogSnapshot_(actor);
  const validPrefixes = snapshot.prefixes.map(function(prefix) {
    return normalizeUpper_(prefix.codigo);
  });
  const validAgreementTypes = snapshot.agreementTypes.map(function(item) {
    return normalizeString_(item.tipoConvenio);
  });

  const normalizedLines = lines.map(function(line, index) {
    const ceaf = normalizeString_(line.ceaf);
    const tipoConvenio = normalizeString_(line.tipoConvenio);
    const centro = normalizeString_(line.centro);
    const certPrefix = normalizeUpper_(line.certPrefix);
    const numeracion = normalizeString_(line.numeracion);
    const fechaCertificacion = toIsoDateString_(line.fechaCertificacion);

    if (!/^\d{3}$/.test(ceaf)) {
      throw new Error('La línea ' + (index + 1) + ' tiene un CEAF inválido. Debe contener exactamente 3 dígitos.');
    }
    if (validAgreementTypes.length && validAgreementTypes.indexOf(tipoConvenio) === -1) {
      throw new Error('La línea ' + (index + 1) + ' usa un tipo de convenio no permitido.');
    }
    if (!centro) {
      throw new Error('La línea ' + (index + 1) + ' no tiene centro.');
    }
    if (validPrefixes.length && validPrefixes.indexOf(certPrefix) === -1) {
      throw new Error('La línea ' + (index + 1) + ' usa un prefijo de certificación no permitido.');
    }
    if (!/^\d{7}$/.test(numeracion)) {
      throw new Error('La línea ' + (index + 1) + ' tiene una numeración inválida. Debe contener exactamente 7 dígitos.');
    }
    if (!fechaCertificacion) {
      throw new Error('La línea ' + (index + 1) + ' no tiene fecha de certificación.');
    }
    validateCertificationDate_(fechaCertificacion, config.certDateLookbackDays);

    return {
      ceaf: ceaf,
      tipoConvenio: tipoConvenio,
      centro: centro,
      certPrefix: certPrefix,
      numeracion: numeracion,
      fechaCertificacion: fechaCertificacion
    };
  });

  const uniqueNumbers = {};
  normalizedLines.forEach(function(line) {
    if (uniqueNumbers[line.numeracion]) {
      throw new Error('Las numeraciones de certificación deben ser únicas dentro del documento.');
    }
    uniqueNumbers[line.numeracion] = true;
  });

  assertNumerationUniqueness_(normalizedLines.map(function(line) {
    return line.numeracion;
  }), normalizeString_(payload.documentId), actor);

  return {
    documentId: normalizeString_(payload.documentId),
    regionalAbreviatura: regionalAbreviatura,
    notes: normalizeString_(payload.notes),
    lines: normalizedLines
  };
}

function validateCertificationDate_(isoDate, lookbackDays) {
  const currentDate = parseDateValue_(todayIsoDate_());
  const targetDate = parseDateValue_(isoDate);
  if (!targetDate || !currentDate) {
    throw new Error('La fecha de certificación no es válida.');
  }
  const millisDiff = currentDate.getTime() - targetDate.getTime();
  const dayDiff = Math.floor(millisDiff / 86400000);
  if (dayDiff < 0) {
    throw new Error('La fecha de certificación no puede estar en el futuro.');
  }
  if (dayDiff > lookbackDays) {
    throw new Error('La fecha de certificación no puede ser anterior a ' + lookbackDays + ' días.');
  }
}

function assertNumerationUniqueness_(numeraciones, currentDocumentId, actor) {
  const currentNumbers = numeraciones.map(normalizeString_);
  const activeDocuments = getSheetRecords_(SHEETS.DOCUMENTS).filter(function(document) {
    if (normalizeUpper_(document.status) !== DOCUMENT_STATUS.ACTIVE) {
      return false;
    }
    if (currentDocumentId && normalizeString_(document.document_id) === currentDocumentId) {
      return false;
    }
    return true;
  });

  const activeDocumentMap = getRecordMapByField_(activeDocuments, 'document_id');
  const conflictingLine = getSheetRecords_(SHEETS.DOCUMENT_LINES).find(function(line) {
    return normalizeBoolean_(line.is_current || 'false') &&
      currentNumbers.indexOf(normalizeString_(line.numeracion)) !== -1 &&
      Object.prototype.hasOwnProperty.call(activeDocumentMap, normalizeString_(line.document_id));
  });

  if (conflictingLine) {
    const conflictDocument = activeDocumentMap[normalizeString_(conflictingLine.document_id)];
    const ownerName = normalizeString_(conflictDocument && conflictDocument.owner_name) || 'otro usuario';
    const ownerEmail = normalizeEmail_(conflictDocument && conflictDocument.owner_email);
    const sameOwner = actor && ownerEmail === normalizeEmail_(actor.email);

    if (sameOwner) {
      throw new Error('La numeración ' + conflictingLine.numeracion + ' ya está en uso en el oficio activo ' + conflictDocument.document_id + '.');
    }

    throw new Error('La numeración ' + conflictingLine.numeracion + ' ya está en uso por ' + ownerName + ' en el oficio ' + conflictDocument.document_id + '.');
  }
}

function getCachedDocumentDetailForUser_(header, actor) {
  try {
    const cache = CacheService.getUserCache();
    const cacheKey = buildDocumentDetailCacheKey_(header, actor);
    const cached = cache.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    return null;
  }
}

function cacheDocumentDetailForUser_(header, actor, detail) {
  try {
    const cache = CacheService.getUserCache();
    const cacheKey = buildDocumentDetailCacheKey_(header, actor);
    cache.put(cacheKey, JSON.stringify(detail), 300);
  } catch (error) {
  }
}

function buildDocumentDetailCacheKey_(header, actor) {
  return [
    'docgen',
    'detail',
    normalizeEmail_(actor && actor.email),
    normalizeString_(header && header.document_id),
    normalizeString_(header && header.updated_at)
  ].join(':');
}

function getCurrentDocumentLines_(documentId) {
  return getSheetRecords_(SHEETS.DOCUMENT_LINES)
    .filter(function(line) {
      return normalizeString_(line.document_id) === documentId && normalizeBoolean_(line.is_current || 'false');
    })
    .sort(function(a, b) {
      return toNumber_(a.sort_order, 0) - toNumber_(b.sort_order, 0);
    });
}

function deactivateCurrentDocumentLines_(documentId, timestamp) {
  const currentLines = getCurrentDocumentLines_(documentId);
  if (!currentLines.length) {
    return;
  }
  currentLines.forEach(function(line) {
    line.is_current = 'false';
    line.updated_at = timestamp;
  });
  updateSheetRecords_(SHEETS.DOCUMENT_LINES, currentLines);
}

function getNextDocumentRevision_(documentId) {
  const revisions = getSheetRecords_(SHEETS.DOCUMENT_LINES)
    .filter(function(line) {
      return normalizeString_(line.document_id) === documentId;
    })
    .map(function(line) {
      return toNumber_(line.revision_no, 0);
    });
  return revisions.length ? Math.max.apply(null, revisions) + 1 : 1;
}

function getRegionalByAbbreviation_(abreviatura) {
  const record = findRecordByField_(SHEETS.REGIONALS, 'abreviatura', normalizeUpper_(abreviatura));
  if (!record || !normalizeBoolean_(record.activo || 'true')) {
    throw new Error('La regional seleccionada no existe o está inactiva.');
  }
  return {
    regionalId: record.regional_id,
    abreviatura: normalizeUpper_(record.abreviatura),
    regional: normalizeString_(record.regional),
    director: normalizeString_(record.director),
    sexo: normalizeString_(record.sexo || 'Hombre'),
    cargo: normalizeString_(record.cargo)
  };
}

function mapDocumentRecordToClient_(record) {
  return {
    documentId: record.document_id,
    documentType: record.document_type,
    templateVariant: record.template_variant,
    documentYear: toNumber_(record.document_year, new Date().getFullYear()),
    regionalAbreviatura: record.regional_abreviatura,
    regionalNombre: record.regional_nombre,
    status: normalizeUpper_(record.status || DOCUMENT_STATUS.ACTIVE),
    itemCount: toNumber_(record.item_count, 0),
    ceafSummary: normalizeString_(record.ceaf_summary),
    convenioSummary: normalizeString_(record.convenio_summary),
    centroSummary: normalizeString_(record.centro_summary),
    numeracionSummary: normalizeString_(record.numeracion_summary),
    notes: normalizeString_(record.notes),
    createdAt: toClientDateTime_(record.created_at),
    createdByEmail: record.created_by_email,
    createdByName: record.created_by_name,
    updatedAt: toClientDateTime_(record.updated_at),
    updatedByEmail: record.updated_by_email,
    ownerEmail: record.owner_email,
    ownerName: record.owner_name,
    lastPrintedAt: toClientDateTime_(record.last_printed_at),
    lastPrintedByEmail: record.last_printed_by_email || ''
  };
}
