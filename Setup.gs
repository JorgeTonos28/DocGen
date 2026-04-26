const DEFAULT_LEGACY_REGIONALS = Object.freeze([
  { abreviatura: 'DRM', regional: 'Direcci\u00f3n Regional Metropolitana', director: 'Juan Matos', sexo: 'Hombre', cargo: 'Metropolitana' },
  { abreviatura: 'DRCN', regional: 'Direcci\u00f3n Regional Cibao-Norte', director: 'Luis Manuel Rodr\u00edguez', sexo: 'Hombre', cargo: 'Cibao-Norte' },
  { abreviatura: 'DRCS', regional: 'Direcci\u00f3n Regional Cibao-Nordeste', director: 'Fernelys Beriguete Ota\u00f1o', sexo: 'Hombre', cargo: 'Cibao-Nordeste' },
  { abreviatura: 'DRS', regional: 'Direcci\u00f3n Regional Sur', director: 'Santa Cuevas', sexo: 'Mujer', cargo: 'Sur' },
  { abreviatura: 'DRO', regional: 'Direcci\u00f3n Regional Oriental', director: 'Iris Hurtado', sexo: 'Mujer', cargo: 'Oriental' },
  { abreviatura: 'DRE', regional: 'Direcci\u00f3n Regional Este', director: 'Ram\u00f3n Garc\u00eda', sexo: 'Hombre', cargo: 'Este' },
  { abreviatura: 'DRV', regional: 'Direcci\u00f3n Regional Valdesia', director: 'Odelis Matos', sexo: 'Hombre', cargo: 'Valdesia' }
]);

const DEFAULT_LEGACY_AGREEMENT_TYPES = Object.freeze([
  'Adjudicado Presencial y Semipresencial',
  'Adjudicado Virtual',
  'Seg\u00fan Programa de Fondos Concursables Presencial y Semipresencial',
  'Seg\u00fan Programa de Fondos Concursables Virtual',
  'Seg\u00fan Programa de Fondos Concursables T\u00e9cnico',
  'T\u00e9cnico Presencial y Semipresencial',
  'T\u00e9cnico Virtual',
  'Diplomado Presencial y Semipresencial',
  'Diplomado Virtual',
  'Por Proyecto DIGEV',
  'IES Presencial y Semipresencial'
]);

const DEFAULT_LEGACY_USERS = Object.freeze([
  { displayName: 'Jorge Tonos', email: 'jtonos@infotep.gob.do', role: 'ADMIN' },
  { displayName: 'Fulano De Tal', email: 'fdetal@infotep.gob.do', role: 'ADMIN' },
  { displayName: 'Massiel Pichardo', email: 'mapichardo@infotep.gob.do', role: 'ADMIN' },
  { displayName: 'Felicia Escoboza', email: 'fescoboza@infotep.gob.do', role: 'USER' },
  { displayName: 'Francilis Soto', email: 'francilis.soto@infotep.gob.do', role: 'USER' },
  { displayName: 'Leticia Geraldino', email: 'lgeraldino@infotep.gob.do', role: 'USER' },
  { displayName: 'Zaya Encarnaci\u00f3n', email: 'zencarnacion@infotep.gob.do', role: 'USER' },
  { displayName: 'Damara Batista', email: 'dmbatista@infotep.gob.do', role: 'USER' },
  { displayName: 'Mario Aquino', email: 'mario.aquino@infotep.gob.do', role: 'USER' },
  { displayName: 'Frilgida Ferreras', email: 'fferreras@infotep.gob.do', role: 'USER' },
  { displayName: 'Daniel Diaz', email: 'dadiaz@infotep.gob.do', role: 'USER' },
  { displayName: 'Katherine Maria', email: 'katherine.maria@infotep.gob.do', role: 'USER' },
  { displayName: 'Karla Ure\u00f1a', email: 'karla.urena@infotep.gob.do', role: 'USER' },
  { displayName: 'Marina Peralta', email: 'mperaltag@infotep.gob.do', role: 'USER' },
  { displayName: 'Marcelo Corcino', email: 'mcorcino@infotep.gob.do', role: 'USER' },
  { displayName: 'Jannorys Ramirez', email: 'jannorys.ramirez@infotep.gob.do', role: 'USER' },
  { displayName: 'Massiel Pichardo', email: 'mpichardo@infotep.gob.do', role: 'ADMIN' },
  { displayName: 'Corayma Collado', email: 'corayma.collado@infotep.gob.do', role: 'USER' }
]);

function setupDocGen() {
  Object.keys(SHEET_HEADERS).forEach(function(sheetName) {
    ensureSheetStructure_(sheetName, SHEET_HEADERS[sheetName]);
  });

  seedDefaultConfig_();
  seedDefaultRegionals_();
  seedDefaultAgreementTypes_();
  seedDefaultPrefixes_();
  seedTemplateCatalog_();
  seedDefaultUsers_();
  seedCurrentUserAsAdminIfNeeded_();

  return {
    ok: true,
    spreadsheetId: getDataSpreadsheet_().getId(),
    appVersion: APP_VERSION
  };
}

function seedDefaultConfig_() {
  const existing = getSheetRecords_(SHEETS.CONFIG);
  const existingKeys = getRecordMapByField_(existing, 'key');

  DEFAULT_CONFIG_ROWS.forEach(function(row) {
    if (!existingKeys[row[0]]) {
      appendSheetRecords_(SHEETS.CONFIG, [{
        key: row[0],
        value: row[1],
        description: row[2]
      }]);
    }
  });

  clearConfigCache_();
}

function seedDefaultRegionals_() {
  const existing = getSheetRecords_(SHEETS.REGIONALS);
  const existingByAbbreviation = getRecordMapByField_(existing, 'abreviatura');
  const now = nowIsoString_();
  const recordsToAppend = DEFAULT_LEGACY_REGIONALS
    .filter(function(item) {
      return !existingByAbbreviation[normalizeString_(item.abreviatura)];
    })
    .map(function(item) {
      return {
        regional_id: generateUuid_(),
        abreviatura: item.abreviatura,
        regional: item.regional,
        director: item.director,
        sexo: item.sexo,
        cargo: item.cargo,
        activo: 'true',
        updated_at: now
      };
    });

  if (recordsToAppend.length) {
    appendSheetRecords_(SHEETS.REGIONALS, recordsToAppend);
  }
}

function seedDefaultAgreementTypes_() {
  const existing = getSheetRecords_(SHEETS.AGREEMENT_TYPES);
  const existingByType = getRecordMapByField_(existing, 'tipo_convenio');
  const now = nowIsoString_();
  const recordsToAppend = DEFAULT_LEGACY_AGREEMENT_TYPES
    .filter(function(name) {
      return !existingByType[normalizeString_(name)];
    })
    .map(function(name, index) {
      return {
        convenio_id: generateUuid_(),
        tipo_convenio: name,
        activo: 'true',
        orden: String((index + 1) * 10),
        updated_at: now
      };
    });

  if (recordsToAppend.length) {
    appendSheetRecords_(SHEETS.AGREEMENT_TYPES, recordsToAppend);
  }
}

function seedDefaultPrefixes_() {
  const existing = getSheetRecords_(SHEETS.CERT_PREFIXES);
  const existingByCode = getRecordMapByField_(existing, 'codigo');
  const now = nowIsoString_();
  const defaults = [{
    codigo: 'BS',
    descripcion: 'BS',
    orden: '10'
  }, {
    codigo: 'CI',
    descripcion: 'CI',
    orden: '20'
  }];

  const recordsToAppend = defaults
    .filter(function(item) {
      return !existingByCode[normalizeString_(item.codigo)];
    })
    .map(function(item) {
      return {
        prefix_id: generateUuid_(),
        codigo: item.codigo,
        descripcion: item.descripcion,
        activo: 'true',
        orden: item.orden,
        updated_at: now
      };
    });

  if (recordsToAppend.length) {
    appendSheetRecords_(SHEETS.CERT_PREFIXES, recordsToAppend);
  }
}

function seedTemplateCatalog_() {
  const existing = getSheetRecords_(SHEETS.TEMPLATES);
  const byKey = getRecordMapByField_(existing, 'template_key');
  const actorEmail = normalizeEmail_(Session.getActiveUser().getEmail());

  if (!byKey[TEMPLATE_KEYS.OFICIO_SINGLE]) {
    appendSheetRecords_(SHEETS.TEMPLATES, [{
      template_key: TEMPLATE_KEYS.OFICIO_SINGLE,
      template_name: 'Oficio de remision de 1 CEAF',
      variant: 'SINGLE',
      active: 'true',
      html_content: HtmlService.createHtmlOutputFromFile('OficioTemplateSingle').getContent(),
      updated_at: nowIsoString_(),
      updated_by_email: actorEmail
    }]);
  }

  if (!byKey[TEMPLATE_KEYS.OFICIO_MULTI]) {
    appendSheetRecords_(SHEETS.TEMPLATES, [{
      template_key: TEMPLATE_KEYS.OFICIO_MULTI,
      template_name: 'Oficio de remision de 2 a 3 CEAFs',
      variant: 'MULTI',
      active: 'true',
      html_content: HtmlService.createHtmlOutputFromFile('OficioTemplateMulti').getContent(),
      updated_at: nowIsoString_(),
      updated_by_email: actorEmail
    }]);
  }
}

function seedDefaultUsers_() {
  const existing = getSheetRecords_(SHEETS.USERS);
  const existingByEmail = getRecordMapByField_(existing, 'email');
  const now = nowIsoString_();
  const recordsToAppend = DEFAULT_LEGACY_USERS
    .filter(function(item) {
      return !existingByEmail[normalizeString_(item.email)];
    })
    .map(function(item) {
      return {
        email: normalizeEmail_(item.email),
        display_name: item.displayName,
        role: item.role,
        status: ACCESS_STATUS.ACTIVE,
        department: '',
        notes: 'Sembrado desde base Legacy.',
        created_at: now,
        updated_at: now
      };
    });

  if (recordsToAppend.length) {
    appendSheetRecords_(SHEETS.USERS, recordsToAppend);
  }
}

function seedCurrentUserAsAdminIfNeeded_() {
  const email = normalizeEmail_(Session.getActiveUser().getEmail());
  if (!email) {
    return;
  }
  const existing = findRecordByField_(SHEETS.USERS, 'email', email);
  if (existing) {
    return;
  }

  appendSheetRecords_(SHEETS.USERS, [{
    email: email,
    display_name: deriveDisplayNameFromEmail_(email),
    role: ROLES.ADMIN,
    status: ACCESS_STATUS.ACTIVE,
    department: 'Departamento Juridico',
    notes: 'Sembrado automaticamente por setupDocGen().',
    created_at: nowIsoString_(),
    updated_at: nowIsoString_()
  }]);
}
