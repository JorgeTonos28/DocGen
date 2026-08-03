function buildDashboardSummary_(user) {
  const documents = listDocuments_({}, user);
  const today = todayIsoDate_();
  const activeDocs = documents.filter(function(document) {
    return document.status === DOCUMENT_STATUS.ACTIVE;
  });
  const archivedDocs = documents.filter(function(document) {
    return document.status === DOCUMENT_STATUS.ARCHIVED;
  });
  const createdToday = documents.filter(function(document) {
    return isSameDay_(document.createdAt, today);
  });
  const recentDocuments = documents.slice(0, 5);
  const byRegional = {};

  activeDocs.forEach(function(document) {
    const regional = document.regionalNombre || document.regionalAbreviatura || 'Sin regional';
    byRegional[regional] = (byRegional[regional] || 0) + 1;
  });

  const byRegionalList = Object.keys(byRegional)
    .map(function(key) {
      return { regional: key, total: byRegional[key] };
    })
    .sort(function(a, b) {
      return b.total - a.total;
    })
    .slice(0, 6);

  const printedLast7Days = getSheetRecords_(SHEETS.AUDIT).filter(function(row) {
    return row.action === 'PRINTED';
  }).length;

  return {
    totalActive: activeDocs.length,
    totalArchived: archivedDocs.length,
    createdToday: createdToday.length,
    printedLast7Days: printedLast7Days,
    recentDocuments: recentDocuments,
    byRegional: byRegionalList
  };
}

function listDocuments_(filters, user) {
  const actor = user || assertAuthorizedUser_();
  const search = normalizeString_((filters && filters.search) || '').toLowerCase();
  const statusFilter = normalizeUpper_((filters && filters.status) || '');
  const regionalFilter = normalizeUpper_((filters && filters.regional) || '');
  const docs = getSheetRecords_(SHEETS.DOCUMENTS)
    .filter(function(record) {
      if (!isAdminUser_(actor) && normalizeEmail_(record.owner_email) !== actor.email) {
        return false;
      }
      if (statusFilter && normalizeUpper_(record.status) !== statusFilter) {
        return false;
      }
      if (regionalFilter && normalizeUpper_(record.regional_abreviatura) !== regionalFilter) {
        return false;
      }
      if (!search) {
        return true;
      }
      const haystack = [
        record.document_id,
        record.document_type,
        record.regional_abreviatura,
        record.regional_nombre,
        record.ceaf_summary,
        record.centro_summary,
        record.numeracion_summary,
        record.owner_name
      ].join(' ').toLowerCase();
      return haystack.indexOf(search) !== -1;
    })
    .sort(function(a, b) {
      return compareDateDesc_(a, b, 'updated_at');
    })
    .map(function(record) {
      return mapDocumentRecordToClient_(record);
    });

  const limit = toNumber_((filters && filters.limit) || 0, 0);
  return limit > 0 ? docs.slice(0, limit) : docs;
}

function getDocumentDetail_(documentId, user) {
  const actor = user || assertAuthorizedUser_();
  const header = findRecordByField_(SHEETS.DOCUMENTS, 'document_id', documentId);
  if (!header) {
    throw new Error('No se encontró el documento solicitado.');
  }
  if (!isAdminUser_(actor) && normalizeEmail_(header.owner_email) !== actor.email) {
    throw new Error('No tienes permisos para consultar este documento.');
  }

  const cachedDetail = getCachedDocumentDetailForUser_(header, actor);
  if (cachedDetail) {
    return cachedDetail;
  }

  const lines = getCurrentDocumentLines_(documentId);
  // Historical documents remain printable even when their regional is later deactivated.
  const regional = getRegionalByAbbreviation_(header.regional_abreviatura, { allowInactive: true });
  const previewHtml = renderDocumentHtml_({
    documentId: header.document_id,
    documentType: header.document_type,
    documentYear: toNumber_(header.document_year, new Date().getFullYear()),
    regionalAbreviatura: header.regional_abreviatura,
    lines: lines.map(function(line) {
        return {
          lineId: line.line_id,
          sortOrder: toNumber_(line.sort_order, 1),
          ceaf: normalizeCeafCode_(line.ceaf),
          tipoConvenio: normalizeString_(line.tipo_convenio),
          centro: normalizeString_(line.centro),
          certPrefix: normalizeString_(line.cert_prefix),
          numeracion: normalizeCertNumber_(line.numeracion),
          fechaCertificacion: toIsoDateString_(line.fecha_certificacion)
        };
    }),
    notes: header.notes || ''
  }, actor, regional);

  const auditEntries = getSheetRecords_(SHEETS.AUDIT)
    .filter(function(row) {
      return normalizeString_(row.entity_id) === documentId;
    })
    .sort(function(a, b) {
      return compareDateDesc_(a, b, 'timestamp');
    })
    .map(function(row) {
      return {
        action: row.action,
        actorName: row.actor_name,
        actorEmail: row.actor_email,
        timestamp: toClientDateTime_(row.timestamp),
        summary: row.summary
      };
    });

  const detail = {
    document: mapDocumentRecordToClient_(header),
    lines: lines.map(function(line) {
      return {
        lineId: line.line_id,
        sortOrder: toNumber_(line.sort_order, 1),
        ceaf: normalizeCeafCode_(line.ceaf),
        tipoConvenio: normalizeString_(line.tipo_convenio),
        centro: normalizeString_(line.centro),
        certPrefix: normalizeString_(line.cert_prefix),
        numeracion: normalizeCertNumber_(line.numeracion),
        fechaCertificacion: toIsoDateString_(line.fecha_certificacion)
      };
    }),
    previewHtml: previewHtml,
    auditEntries: auditEntries
  };

  cacheDocumentDetailForUser_(header, actor, detail);
  return detail;
}

function saveDocument_(payload, user) {
  const actor = user || assertAuthorizedUser_();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const validated = validateDocumentPayload_(payload, actor);
    const now = nowIsoString_();
    const documents = getSheetRecords_(SHEETS.DOCUMENTS);
    const currentDocument = validated.documentId ? documents.find(function(record) {
      return normalizeString_(record.document_id) === validated.documentId;
    }) : null;

    if (currentDocument && !isAdminUser_(actor) && normalizeEmail_(currentDocument.owner_email) !== actor.email) {
      throw new Error('No tienes permisos para modificar este documento.');
    }

    const regional = getRegionalByAbbreviation_(validated.regionalAbreviatura);
    const documentId = currentDocument ? currentDocument.document_id : getNextDocumentId_();
    const revisionNo = currentDocument ? getNextDocumentRevision_(documentId) : 1;
    const currentYear = currentDocument ? toNumber_(currentDocument.document_year, new Date().getFullYear()) : new Date().getFullYear();

    if (currentDocument) {
      deactivateCurrentDocumentLines_(documentId, now);
    }

    const templateVariant = validated.lines.length > 1 ? TEMPLATE_KEYS.OFICIO_MULTI : TEMPLATE_KEYS.OFICIO_SINGLE;
    const formattedCeafList = validated.lines.map(function(line) {
      return regional.abreviatura + '-' + line.ceaf + '-' + currentYear;
    });
    const formattedCerts = validated.lines.map(function(line) {
      return line.certPrefix + '-' + line.numeracion + '-' + currentYear;
    });

    const header = currentDocument || {
      document_id: documentId,
      created_at: now,
      created_by_email: actor.email,
      created_by_name: actor.displayName,
      owner_email: actor.email,
      owner_name: actor.displayName
    };

    header.document_type = 'OFICIO_REMISION_CEAF';
    header.template_variant = templateVariant;
    header.document_year = String(currentYear);
    header.regional_abreviatura = regional.abreviatura;
    header.regional_nombre = regional.regional;
    header.status = DOCUMENT_STATUS.ACTIVE;
    header.item_count = String(validated.lines.length);
    header.ceaf_summary = formattedCeafList.join(' | ');
    header.convenio_summary = validated.lines.map(function(line) { return line.tipoConvenio; }).join(' | ');
    header.centro_summary = validated.lines.map(function(line) { return line.centro; }).join(' | ');
    header.numeracion_summary = formattedCerts.join(' | ');
    header.notes = validated.notes || '';
    header.updated_at = now;
    header.updated_by_email = actor.email;
    header.deleted_at = '';
    header.deleted_by_email = '';

    if (currentDocument) {
      updateSheetRecords_(SHEETS.DOCUMENTS, [header]);
    } else {
      appendSheetRecords_(SHEETS.DOCUMENTS, [header]);
    }

    appendSheetRecords_(SHEETS.DOCUMENT_LINES, validated.lines.map(function(line, index) {
      return {
        line_id: generateUuid_(),
        document_id: documentId,
        revision_no: String(revisionNo),
        sort_order: String(index + 1),
        ceaf: line.ceaf,
        tipo_convenio: line.tipoConvenio,
        centro: line.centro,
        cert_prefix: line.certPrefix,
        numeracion: line.numeracion,
        fecha_certificacion: line.fechaCertificacion,
        is_current: 'true',
        created_at: now,
        updated_at: now
      };
    }));

    logAudit_('DOCUMENT', documentId, currentDocument ? 'UPDATED' : 'CREATED', actor, currentDocument ? 'Documento actualizado.' : 'Documento creado.', {
      documentId: documentId,
      regional: regional.abreviatura,
      lines: validated.lines.length
    });

    const detail = getDocumentDetail_(documentId, actor);
    return {
      document: detail.document,
      lines: detail.lines,
      previewHtml: detail.previewHtml,
      message: currentDocument ? 'Documento actualizado correctamente.' : 'Documento creado correctamente.'
    };
  } finally {
    lock.releaseLock();
  }
}
