function getCatalogSnapshot_(user) {
  const actor = user || assertAuthorizedUser_();
  const regionals = getSheetRecords_(SHEETS.REGIONALS)
    .filter(function(row) {
      return normalizeBoolean_(row.activo || 'true');
    })
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

  const agreementTypes = getSheetRecords_(SHEETS.AGREEMENT_TYPES)
    .filter(function(row) {
      return normalizeBoolean_(row.activo || 'true');
    })
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

  const prefixes = getSheetRecords_(SHEETS.CERT_PREFIXES)
    .filter(function(row) {
      return normalizeBoolean_(row.activo || 'true');
    })
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

  return {
    regionals: regionals,
    agreementTypes: agreementTypes,
    prefixes: prefixes,
    templates: isAdminUser_(actor) ? templates : templates.map(function(template) {
      return {
        templateKey: template.templateKey,
        templateName: template.templateName,
        variant: template.variant,
        active: template.active
      };
    })
  };
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

  const existing = findRecordByField_(SHEETS.REGIONALS, 'abreviatura', abreviatura);
  const record = existing || {
    regional_id: payload.regionalId || generateUuid_()
  };

  record.abreviatura = abreviatura;
  record.regional = regional;
  record.director = director;
  record.sexo = normalizeRegionalSexo_(payload.sexo);
  record.cargo = normalizeString_(payload.cargo) || regional;
  record.activo = String(payload.activo !== false);
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
  record.activo = String(payload.activo !== false);
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
  record.activo = String(payload.activo !== false);
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

  const existing = findRecordByField_(SHEETS.TEMPLATES, 'template_key', templateKey);
  const record = existing || {};
  record.template_key = templateKey;
  record.template_name = normalizeString_(payload.templateName || templateKey);
  record.variant = normalizeString_(payload.variant || 'OFICIO');
  record.active = String(payload.active !== false);
  record.html_content = htmlContent;
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
    normalizeString_(fromSheet.html_content) &&
    isOfficialOficioTemplate_(fromSheet.html_content)
  ) {
    return fromSheet.html_content;
  }

  return bundledTemplate;
}

function getBundledTemplateHtml_(templateKey) {
  if (templateKey === TEMPLATE_KEYS.OFICIO_MULTI) {
    return HtmlService.createHtmlOutputFromFile('OficioTemplateMulti').getContent();
  }

  return HtmlService.createHtmlOutputFromFile('OficioTemplateSingle').getContent();
}

function isOfficialOficioTemplate_(html) {
  const normalized = normalizeString_(html);
  return normalized.indexOf('**DIRIGIDO**') !== -1 &&
    normalized.indexOf('margin-left:144pt') !== -1 &&
    normalized.indexOf('width:440.85pt') !== -1 &&
    normalized.indexOf('**NOMBRE_USUARIO_CREADOR**') !== -1;
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
