function renderDocumentHtml_(payload, actor, regionalOverride) {
  const regional = regionalOverride || getRegionalByAbbreviation_(payload.regionalAbreviatura);
  const templateKey = payload.lines.length > 1 ? TEMPLATE_KEYS.OFICIO_MULTI : TEMPLATE_KEYS.OFICIO_SINGLE;
  let html = normalizeOficioTableLayout_(stripCreatorNameLine_(getTemplateHtml_(templateKey)));
  const currentYear = toNumber_(payload.documentYear, new Date().getFullYear());

  const replacements = {
    '**DIRIGIDO**': regional.sexo === 'Hombre' ? 'Al' : 'A la',
    '**ESPACIADO_STYLE**': regional.sexo === 'Hombre' ? 'width:23.17pt;' : 'width:14pt;',
    '**NOMBRE_DIRECTOR_REGIONAL**': (regional.sexo === 'Hombre' ? 'Sr. ' : 'Sra. ') + escapeHtml_(regional.director),
    '**CARGO**': escapeHtml_((regional.sexo === 'Hombre' ? 'Director Regional ' : 'Directora Regional ') + extractRegionalCargoSuffix_(regional.cargo || regional.regional)),
    '**ANO_OFICIO**': String(currentYear),
    '**INICIALES_USUARIO**': escapeHtml_(actor.initials || buildUserInitials_(actor.displayName)),
    '**NOMBRE_USUARIO_CREADOR**': ''
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

function normalizeOficioTableLayout_(html) {
  const columnWidths = ['24.65pt', '73.5pt', '118.1pt', '79.5pt', '90.35pt'];

  return String(html || '').replace(/<table\b[\s\S]*?<\/table>/gi, function(tableHtml) {
    if (tableHtml.indexOf('**TC1**') === -1 || tableHtml.indexOf('**CEAF1**') === -1) {
      return tableHtml;
    }

    let normalizedTable = tableHtml.replace(/^<table\b([^>]*)>/i, function(match, attributes) {
      return '<table' + setHtmlInlineStyle_(attributes, 'table-layout', 'fixed') + '>';
    });

    normalizedTable = normalizedTable.replace(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi, function(rowMatch, rowAttributes, rowHtml) {
      let cellIndex = 0;
      const normalizedRow = rowHtml.replace(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi, function(cellMatch, cellAttributes, cellHtml) {
        const width = columnWidths[cellIndex];
        let normalizedCellHtml = cellHtml;

        if (cellIndex === 2) {
          normalizedCellHtml = normalizedCellHtml.replace(/<p\b([^>]*)>/gi, function(paragraphMatch, paragraphAttributes) {
            return '<p' + setHtmlInlineStyle_(paragraphAttributes, 'text-align', 'center') + '>';
          });
        }

        cellIndex += 1;
        if (!width) {
          return cellMatch;
        }
        return '<td' + setHtmlInlineStyle_(cellAttributes, 'width', width) + '>' + normalizedCellHtml + '</td>';
      });

      return '<tr' + rowAttributes + '>' + normalizedRow + '</tr>';
    });

    return normalizedTable;
  });
}

function setHtmlInlineStyle_(attributes, property, value) {
  const sourceAttributes = String(attributes || '');
  const styleMatch = sourceAttributes.match(/\sstyle=(['"])(.*?)\1/i);
  const declarations = styleMatch
    ? styleMatch[2].split(';').map(function(declaration) { return declaration.trim(); }).filter(Boolean)
    : [];
  const propertyPattern = new RegExp('^' + property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:', 'i');
  let propertyUpdated = false;

  const nextDeclarations = declarations.map(function(declaration) {
    if (!propertyPattern.test(declaration)) {
      return declaration;
    }
    propertyUpdated = true;
    return property + ':' + value;
  });
  if (!propertyUpdated) {
    nextDeclarations.push(property + ':' + value);
  }

  const nextStyle = 'style="' + nextDeclarations.join('; ') + ';"';
  if (styleMatch) {
    return sourceAttributes.replace(styleMatch[0], ' ' + nextStyle);
  }
  return sourceAttributes + ' ' + nextStyle;
}

function stripCreatorNameLine_(html) {
  return String(html || '').replace(
    /<p[^>]*>\s*(?:<span[^>]*>\s*)?\*\*NOMBRE_USUARIO_CREADOR\*\*(?:\s*<\/span>)?\s*<\/p>/gi,
    ''
  );
}

function extractRegionalCargoSuffix_(value) {
  const normalized = normalizeString_(value);
  if (!normalized) {
    return '';
  }
  const parts = normalized.split(' ');
  return parts[parts.length - 1].replace('-', ' ');
}
