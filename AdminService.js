function getCatalogSnapshot_(user, options) {
  const actor = user || assertAuthorizedUser_();
  const includeInactive = Boolean(options && options.includeInactive && isAdminUser_(actor));
  const allRegionals = getSheetRecords_(SHEETS.REGIONALS)
    .sort(function(a, b) {
      return normalizeString_(a.abreviatura).localeCompare(normalizeString_(b.abreviatura));
    })
    .map(function(row) {
      return {
        regionalId: row.regional_id,
        abreviatura: row.abreviatura,
        regional: row.regional,
        director: row.director,
        sexo: row.sexo,
        cargo: row.cargo,
        activo: normalizeBoolean_(row.activo || 'true')
      };
    });

  const allAgreementTypes = getSheetRecords_(SHEETS.AGREEMENT_TYPES)
    .sort(function(a, b) {
      return toNumber_(a.orden, 0) - toNumber_(b.orden, 0);
    })
    .map(function(row) {
      return {
        convenioId: row.convenio_id,
        tipoConvenio: row.tipo_convenio,
        activo: normalizeBoolean_(row.activo || 'true')
      };
    });

  const allPrefixes = getSheetRecords_(SHEETS.CERT_PREFIXES)
    .sort(function(a, b) {
      return toNumber_(a.orden, 0) - toNumber_(b.orden, 0);
    })
    .map(function(row) {
      return {
        prefixId: row.prefix_id,
        codigo: row.codigo,
        descripcion: row.descripcion,
        activo: normalizeBoolean_(row.activo || 'true')
      };
    });

  const templates = getSheetRecords_(SHEETS.TEMPLATES).map(function(row) {
    return {
      templateKey: row.template_key,
      templateName: row.template_name,
      variant: row.variant,
      active: normalizeBoolean_(row.active || 'true'),
      htmlContent: row.html_content,
      updatedAt: toClientDateTime_(row.updated_at),
      updatedByEmail: row.updated_by_email
    };
  });

  const snapshot = {
    // The generator and its validation must only work with active catalog entries.
    regionals: allRegionals.filter(function(item) { return item.activo; }),
    agreementTypes: allAgreementTypes.filter(function(item) { return item.activo; }),
    prefixes: allPrefixes.filter(function(item) { return item.activo; }),
    templates: isAdminUser_(actor) ? templates : templates.map(function(template) {
      return {
        templateKey: template.templateKey,
        templateName: template.templateName,
        variant: template.variant,
        active: template.active
      };
    })
  };

  if (includeInactive) {
    snapshot.management = {
      regionals: allRegionals,
      agreementTypes: allAgreementTypes,
      prefixes: allPrefixes
    };
  }

  return snapshot;
}

function listUsers_(user) {
  const actor = user || assertAdminUser_();
  if (!isAdminUser_(actor)) {
    throw new Error('No autorizado.');
  }
  return getSheetRecords_(SHEETS.USERS)
    .sort(function(a, b) {
      return (normalizeString_(a.display_name) || normalizeString_(a.email))
        .localeCompare(normalizeString_(b.display_name) || normalizeString_(b.email));
    })
    .map(function(row) {
      return {
        email: normalizeEmail_(row.email),
        displayName: normalizeString_(row.display_name),
        role: normalizeUpper_(row.role || ROLES.USER),
        status: normalizeUpper_(row.status || ACCESS_STATUS.PENDING),
        department: normalizeString_(row.department),
        notes: normalizeString_(row.notes),
        createdAt: toClientDateTime_(row.created_at),
        updatedAt: toClientDateTime_(row.updated_at)
      };
    });
}

function saveUserAccess_(payload, user) {
  const actor = user || assertAdminUser_();
  if (!isAdminUser_(actor)) {
    throw new Error('No autorizado.');
  }

  const email = normalizeEmail_(payload.email);
  if (!email) {
    throw new Error('El correo del usuario es obligatorio.');
  }

  const allowedDomain = normalizeString_(getConfigValue_('allowed_domain', '')).toLowerCase();
  if (allowedDomain && !email.endsWith('@' + allowedDomain)) {
    throw new Error('El correo debe pertenecer al dominio ' + allowedDomain + '.');
  }

  const existing = findRecordByField_(SHEETS.USERS, 'email', email);
  const record = existing || {
    email: email,
    created_at: nowIsoString_()
  };

  record.display_name = normalizeString_(payload.displayName) || deriveDisplayNameFromEmail_(email);
  record.role = normalizeRole_(payload.role);
  record.status = normalizeAccessStatus_(payload.status);
  record.department = normalizeString_(payload.department);
  record.notes = normalizeString_(payload.notes);
  record.updated_at = nowIsoString_();

  if (existing) {
    updateSheetRecords_(SHEETS.USERS, [record]);
  } else {
    appendSheetRecords_(SHEETS.USERS, [record]);
  }

  logAudit_('USER', email, existing ? 'UPDATED' : 'CREATED', actor, 'Usuario actualizado en hoja Usuarios.', {
    email: email,
    role: record.role,
    status: record.status
  });

  return record;
}

function saveCatalogItem_(payload, user) {
  const actor = user || assertAdminUser_();
  if (!isAdminUser_(actor)) {
    throw new Error('No autorizado.');
  }

  const collection = normalizeString_(payload.collection);
  if (!collection) {
    throw new Error('No se indico la coleccion a actualizar.');
  }

  if (collection === 'regionales') {
    return saveRegionalCatalogItem_(payload, actor);
  }
  if (collection === 'tiposConvenio') {
    return saveAgreementTypeCatalogItem_(payload, actor);
  }
  if (collection === 'prefijos') {
    return savePrefixCatalogItem_(payload, actor);
  }

  throw new Error('Coleccion no soportada: ' + collection);
}

function saveRegionalCatalogItem_(payload, actor) {
  const abreviatura = normalizeUpper_(payload.abreviatura);
  const regional = normalizeString_(payload.regional);
  const director = normalizeString_(payload.director);
  if (!abreviatura) {
    throw new Error('La abreviatura de la regional es obligatoria.');
  }
  if (!regional) {
    throw new Error('El nombre de la regional es obligatorio.');
  }
  if (!director) {
    throw new Error('El nombre del director o directora es obligatorio.');
  }

  const existingById = payload.regionalId ? findRecordByField_(SHEETS.REGIONALS, 'regional_id', payload.regionalId) : null;
  const existingByAbbreviation = findRecordByField_(SHEETS.REGIONALS, 'abreviatura', abreviatura);
  if (
    existingById &&
    existingByAbbreviation &&
    normalizeString_(existingById.regional_id) !== normalizeString_(existingByAbbreviation.regional_id)
  ) {
    throw new Error('La abreviatura indicada ya pertenece a otra regional.');
  }
  const existing = existingById || existingByAbbreviation;
  const record = existing || {
    regional_id: payload.regionalId || generateUuid_()
  };

  record.abreviatura = abreviatura;
  record.regional = regional;
  record.director = director;
  record.sexo = normalizeRegionalSexo_(payload.sexo);
  record.cargo = normalizeString_(payload.cargo) || regional;
  record.activo = String(normalizeCatalogActive_(payload.activo));
  record.updated_at = nowIsoString_();

  if (existing) {
    updateSheetRecords_(SHEETS.REGIONALS, [record]);
  } else {
    appendSheetRecords_(SHEETS.REGIONALS, [record]);
  }

  logAudit_('CATALOG', abreviatura, existing ? 'UPDATED' : 'CREATED', actor, 'Regional actualizada.', {
    abreviatura: abreviatura,
    regional: regional
  });
  return record;
}

function saveAgreementTypeCatalogItem_(payload, actor) {
  const existing = payload.convenioId ? findRecordByField_(SHEETS.AGREEMENT_TYPES, 'convenio_id', payload.convenioId) : null;
  const record = existing || {
    convenio_id: payload.convenioId || generateUuid_()
  };

  record.tipo_convenio = normalizeString_(payload.tipoConvenio);
  if (!record.tipo_convenio) {
    throw new Error('El tipo de convenio es obligatorio.');
  }
  record.activo = String(normalizeCatalogActive_(payload.activo));
  record.orden = String(toNumber_(payload.orden, 10));
  record.updated_at = nowIsoString_();

  if (existing) {
    updateSheetRecords_(SHEETS.AGREEMENT_TYPES, [record]);
  } else {
    appendSheetRecords_(SHEETS.AGREEMENT_TYPES, [record]);
  }

  logAudit_('CATALOG', record.convenio_id, existing ? 'UPDATED' : 'CREATED', actor, 'Tipo de convenio actualizado.', {
    convenioId: record.convenio_id,
    tipoConvenio: record.tipo_convenio
  });
  return record;
}

function savePrefixCatalogItem_(payload, actor) {
  const existing = payload.prefixId ? findRecordByField_(SHEETS.CERT_PREFIXES, 'prefix_id', payload.prefixId) : null;
  const record = existing || {
    prefix_id: payload.prefixId || generateUuid_()
  };

  record.codigo = normalizeUpper_(payload.codigo);
  if (!record.codigo) {
    throw new Error('El codigo del prefijo es obligatorio.');
  }
  record.descripcion = normalizeString_(payload.descripcion);
  record.activo = String(normalizeCatalogActive_(payload.activo));
  record.orden = String(toNumber_(payload.orden, 10));
  record.updated_at = nowIsoString_();

  if (existing) {
    updateSheetRecords_(SHEETS.CERT_PREFIXES, [record]);
  } else {
    appendSheetRecords_(SHEETS.CERT_PREFIXES, [record]);
  }

  logAudit_('CATALOG', record.prefix_id, existing ? 'UPDATED' : 'CREATED', actor, 'Prefijo de certificacion actualizado.', {
    prefixId: record.prefix_id,
    codigo: record.codigo
  });
  return record;
}

function saveTemplate_(payload, user) {
  const actor = user || assertAdminUser_();
  if (!isAdminUser_(actor)) {
    throw new Error('No autorizado.');
  }

  const templateKey = normalizeString_(payload.templateKey);
  const htmlContent = normalizeString_(payload.htmlContent);
  if (!templateKey || !htmlContent) {
    throw new Error('La clave y el contenido HTML de la plantilla son obligatorios.');
  }
  const normalizedHtmlContent = normalizeOfficialTemplateHtml_(
    htmlContent,
    getBundledTemplateHtml_(templateKey)
  );

  const existing = findRecordByField_(SHEETS.TEMPLATES, 'template_key', templateKey);
  const record = existing || {};
  record.template_key = templateKey;
  record.template_name = normalizeString_(payload.templateName || templateKey);
  record.variant = normalizeString_(payload.variant || 'OFICIO');
  record.active = String(normalizeCatalogActive_(payload.active));
  record.html_content = normalizedHtmlContent;
  record.updated_at = nowIsoString_();
  record.updated_by_email = actor.email;

  if (existing) {
    updateSheetRecords_(SHEETS.TEMPLATES, [record]);
  } else {
    appendSheetRecords_(SHEETS.TEMPLATES, [record]);
  }

  logAudit_('TEMPLATE', templateKey, existing ? 'UPDATED' : 'CREATED', actor, 'Plantilla actualizada.', {
    templateKey: templateKey
  });

  return record;
}

function getTemplateHtml_(templateKey) {
  const bundledTemplate = getBundledTemplateHtml_(templateKey);
  const fromSheet = findRecordByField_(SHEETS.TEMPLATES, 'template_key', templateKey);
  if (
    fromSheet &&
    normalizeBoolean_(fromSheet.active || 'true') &&
    normalizeString_(fromSheet.html_content)
  ) {
    return normalizeOfficialTemplateHtml_(fromSheet.html_content, bundledTemplate);
  }

  return normalizeOfficialTemplateHtml_(bundledTemplate, bundledTemplate);
}

function getBundledTemplateHtml_(templateKey) {
  if (templateKey === TEMPLATE_KEYS.OFICIO_MULTI) {
    return HtmlService.createHtmlOutputFromFile('OficioTemplateMulti').getContent();
  }

  return HtmlService.createHtmlOutputFromFile('OficioTemplateSingle').getContent();
}

function normalizeOfficialTemplateHtml_(html, bundledTemplate) {
  const restoredHtml = restoreOfficialHeadingBlock_(String(html || ''), String(bundledTemplate || ''));
  const formatMarker = 'data-docgen-official-format';
  if (restoredHtml.indexOf(formatMarker) !== -1) {
    return restoredHtml;
  }

  const formattedHtml = restoredHtml.replace(
    /class=(['"])([^'"]*\bcontent\b[^'"]*)\1/i,
    function(match, quote, classNames) {
      if (classNames.indexOf('docgen-official-template') !== -1) {
        return match;
      }
      return 'class=' + quote + classNames + ' docgen-official-template' + quote;
    }
  );
  const typography = '<style ' + formatMarker + '>' +
    '.docgen-official-template,.docgen-official-template *{font-family:INFOTEXT,"Times New Roman",serif!important;}' +
    '.docgen-official-template strong,.docgen-official-template strong *{font-family:INFOTEXT_B,INFOTEXT,"Times New Roman",serif!important;}' +
    '</style>';
  return typography + formattedHtml;
}

function restoreOfficialHeadingBlock_(html, bundledTemplate) {
  const sourceRange = findOfficialHeadingRange_(html);
  const bundledRange = findOfficialHeadingRange_(bundledTemplate);
  if (!sourceRange || !bundledRange) {
    return html;
  }

  const sourceValues = getOfficialHeadingValues_(html);
  const bundledValues = getOfficialHeadingValues_(bundledTemplate);
  let restoredBlock = bundledTemplate.slice(bundledRange.start, bundledRange.end);
  ['subject', 'annex1', 'annex2'].forEach(function(field) {
    const bundledValue = bundledValues[field];
    const sourceValue = sourceValues[field];
    if (bundledValue && sourceValue) {
      restoredBlock = restoredBlock.split(bundledValue).join(sourceValue);
    }
  });

  return html.slice(0, sourceRange.start) +
    restoredBlock +
    html.slice(sourceRange.end);
}

function getOfficialHeadingValues_(html) {
  const paragraphs = getOfficialParagraphs_(html);
  const subjectParagraph = paragraphs.find(function(paragraph) {
    return paragraph.text.toLowerCase().indexOf('asunto') !== -1;
  });
  const annexIndex = paragraphs.findIndex(function(paragraph) {
    return paragraph.text.toLowerCase().indexOf('anexos') !== -1;
  });
  let annex2 = '';
  if (annexIndex !== -1) {
    for (let index = annexIndex + 1; index < paragraphs.length; index += 1) {
      if (paragraphs[index].text) {
        annex2 = paragraphs[index].text;
        break;
      }
    }
  }

  return {
    subject: getOfficialValueAfterColon_(subjectParagraph && subjectParagraph.text),
    annex1: getOfficialValueAfterColon_(annexIndex !== -1 && paragraphs[annexIndex].text),
    annex2: annex2
  };
}

function getOfficialValueAfterColon_(text) {
  const normalized = String(text || '').trim();
  const separatorIndex = normalized.indexOf(':');
  return separatorIndex === -1 ? '' : normalized.slice(separatorIndex + 1).trim();
}

function findOfficialHeadingRange_(html) {
  const paragraphs = getOfficialParagraphs_(html);
  let startParagraph = -1;
  let annexParagraph = -1;
  paragraphs.some(function(paragraph, index) {
    if (startParagraph === -1 && paragraph.text.indexOf('**DIRIGIDO**') !== -1) {
      startParagraph = index;
    }
    if (startParagraph !== -1 && paragraph.text.toLowerCase().indexOf('anexos') !== -1) {
      annexParagraph = index;
      return true;
    }
    return false;
  });

  if (startParagraph === -1 || annexParagraph === -1) {
    return null;
  }

  let nonEmptyParagraphs = 0;
  for (let index = annexParagraph + 1; index < paragraphs.length; index += 1) {
    if (!paragraphs[index].text) {
      continue;
    }
    nonEmptyParagraphs += 1;
    if (nonEmptyParagraphs === 2) {
      return {
        start: paragraphs[startParagraph].start,
        end: paragraphs[index].start
      };
    }
  }

  return null;
}

function getOfficialParagraphs_(html) {
  const paragraphs = [];
  const paragraphPattern = /<p\b[^>]*>[\s\S]*?<\/p>/gi;
  let match;
  while ((match = paragraphPattern.exec(String(html || ''))) !== null) {
    paragraphs.push({
      start: match.index,
      end: paragraphPattern.lastIndex,
      text: getOfficialParagraphText_(match[0])
    });
  }
  return paragraphs;
}

function getOfficialParagraphText_(paragraphHtml) {
  return String(paragraphHtml || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTemplateCacheVersion_(templateKey) {
  const fromSheet = findRecordByField_(SHEETS.TEMPLATES, 'template_key', templateKey);
  if (
    fromSheet &&
    normalizeBoolean_(fromSheet.active || 'true') &&
    normalizeString_(fromSheet.html_content)
  ) {
    return normalizeString_(fromSheet.updated_at) || 'sheet-template';
  }

  return 'bundled-template';
}

function normalizeCatalogActive_(value) {
  return value == null || value === '' ? true : normalizeBoolean_(value);
}

function normalizeRole_(value) {
  const role = normalizeUpper_(value || ROLES.USER);
  if ([ROLES.ADMIN, ROLES.USER, ROLES.AUDITOR].indexOf(role) === -1) {
    throw new Error('El rol indicado no es valido.');
  }
  return role;
}

function normalizeAccessStatus_(value) {
  const status = normalizeUpper_(value || ACCESS_STATUS.ACTIVE);
  if ([ACCESS_STATUS.ACTIVE, ACCESS_STATUS.PENDING, ACCESS_STATUS.INACTIVE].indexOf(status) === -1) {
    throw new Error('El estado indicado no es valido.');
  }
  return status;
}

function normalizeRegionalSexo_(value) {
  const sexo = normalizeString_(value || 'Hombre');
  return sexo === 'Mujer' ? 'Mujer' : 'Hombre';
}
