function renderDocumentHtml_(payload, actor, regionalOverride) {
  const regional = regionalOverride || getRegionalByAbbreviation_(payload.regionalAbreviatura);
  const templateKey = payload.lines.length > 1 ? TEMPLATE_KEYS.OFICIO_MULTI : TEMPLATE_KEYS.OFICIO_SINGLE;
  let html = getTemplateHtml_(templateKey);
  const currentYear = toNumber_(payload.documentYear, new Date().getFullYear());

  const replacements = {
    '**DIRIGIDO**': regional.sexo === 'Hombre' ? 'Al' : 'A la',
    '**ESPACIADO_STYLE**': regional.sexo === 'Hombre' ? 'width:23.17pt;' : 'width:14pt;',
    '**NOMBRE_DIRECTOR_REGIONAL**': (regional.sexo === 'Hombre' ? 'Sr. ' : 'Sra. ') + escapeHtml_(regional.director),
    '**CARGO**': escapeHtml_((regional.sexo === 'Hombre' ? 'Director Regional ' : 'Directora Regional ') + extractRegionalCargoSuffix_(regional.cargo || regional.regional)),
    '**ANO_OFICIO**': String(currentYear),
    '**INICIALES_USUARIO**': escapeHtml_(actor.initials || buildUserInitials_(actor.displayName)),
    '**NOMBRE_USUARIO_CREADOR**': escapeHtml_(actor.displayName || '')
  };

  Object.keys(replacements).forEach(function(token) {
    html = html.split(token).join(replacements[token]);
  });

  payload.lines.forEach(function(line, index) {
    const lineNumber = index + 1;
    const formattedCeaf = regional.abreviatura + '-' + line.ceaf + '-' + currentYear;
    const formattedCert = line.certPrefix + '-' + line.numeracion + '-' + currentYear + ' de fecha ' + formatDateDisplayEs_(line.fechaCertificacion);

    html = html
      .split('**N' + lineNumber + '**').join(String(lineNumber))
      .split('**CEAF' + lineNumber + '**').join(escapeHtml_(formattedCeaf))
      .split('**TC' + lineNumber + '**').join(escapeHtml_(line.tipoConvenio))
      .split('**CTR' + lineNumber + '**').join(escapeHtml_(line.centro))
      .split('**CRTF' + lineNumber + '**').join(escapeHtml_(formattedCert));
  });

  for (var i = payload.lines.length + 1; i <= 3; i += 1) {
    html = html.replace(new RegExp('<tr id="ceaf' + i + '".*?<\\/tr>', 'gs'), '');
  }

  return html;
}

function extractRegionalCargoSuffix_(value) {
  const normalized = normalizeString_(value);
  if (!normalized) {
    return '';
  }
  const parts = normalized.split(' ');
  return parts[parts.length - 1].replace('-', ' ');
}
