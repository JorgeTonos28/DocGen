function getAuthorizedUserContext_(throwOnDenied) {
  const email = normalizeEmail_(Session.getActiveUser().getEmail());
  const config = getConfigMap_();
  const allowedDomain = normalizeString_(config.allowed_domain).toLowerCase();

  const denied = function(reason, status, extra) {
    const payload = Object.assign({
      isAuthorized: false,
      reason: reason,
      status: status || 'NO_REGISTRADO',
      email: email || '',
      supportEmail: getConfigValue_('support_email', ''),
      institutionName: getConfigValue_('institution_name', 'INFOTEP')
    }, extra || {});
    if (throwOnDenied) {
      throw new Error(payload.reason);
    }
    return payload;
  };

  if (!email) {
    return denied('No fue posible identificar el correo institucional del usuario activo.', 'NO_IDENTIFICADO');
  }

  if (allowedDomain && !email.endsWith('@' + allowedDomain)) {
    return denied('La cuenta activa no pertenece al dominio permitido para esta app.', 'DOMINIO_INVALIDO');
  }

  const users = getSheetRecords_(SHEETS.USERS);
  const userRow = users.find(function(row) {
    return normalizeEmail_(row.email) === email;
  });

  if (!userRow) {
    return denied('Tu cuenta no esta registrada en la hoja Usuarios.', 'NO_REGISTRADO');
  }

  const status = normalizeUpper_(userRow.status || ACCESS_STATUS.PENDING);
  if (status !== ACCESS_STATUS.ACTIVE) {
    return denied('Tu cuenta existe, pero no esta activa para utilizar la aplicacion.', status, {
      displayName: normalizeString_(userRow.display_name)
    });
  }

  return {
    isAuthorized: true,
    email: email,
    displayName: normalizeString_(userRow.display_name) || deriveDisplayNameFromEmail_(email),
    role: normalizeUpper_(userRow.role || ROLES.USER),
    status: status,
    department: normalizeString_(userRow.department),
    notes: normalizeString_(userRow.notes),
    initials: buildUserInitials_(normalizeString_(userRow.display_name) || deriveDisplayNameFromEmail_(email))
  };
}

function assertAuthorizedUser_() {
  return getAuthorizedUserContext_(true);
}

function assertAdminUser_() {
  const user = assertAuthorizedUser_();
  if (user.role !== ROLES.ADMIN) {
    throw new Error('Esta accion requiere permisos de administrador.');
  }
  return user;
}

function isAdminUser_(user) {
  return user && user.role === ROLES.ADMIN;
}
