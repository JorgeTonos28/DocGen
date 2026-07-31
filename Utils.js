function getAppTimeZone_() {
  return Session.getScriptTimeZone() || 'America/Santo_Domingo';
}

function nowIsoString_() {
  return Utilities.formatDate(new Date(), getAppTimeZone_(), "yyyy-MM-dd'T'HH:mm:ss");
}

function todayIsoDate_() {
  return Utilities.formatDate(new Date(), getAppTimeZone_(), 'yyyy-MM-dd');
}

function toIsoDateString_(value) {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    const normalized = normalizeString_(value);
    const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return isValidLocalDateParts_(isoMatch[1], isoMatch[2], isoMatch[3]) ? normalized : '';
    }
    const displayMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (displayMatch) {
      if (!isValidLocalDateParts_(displayMatch[3], displayMatch[2], displayMatch[1])) {
        return '';
      }
      return displayMatch[3] + '-' + displayMatch[2].padStart(2, '0') + '-' + displayMatch[1].padStart(2, '0');
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return Utilities.formatDate(date, getAppTimeZone_(), 'yyyy-MM-dd');
}

function toClientDateTime_(value) {
  if (!value) {
    return '';
  }
  const date = parseDateValue_(value);
  if (!date) {
    return normalizeString_(value);
  }
  return Utilities.formatDate(date, getAppTimeZone_(), "yyyy-MM-dd'T'HH:mm:ss");
}

function parseDateValue_(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = normalizeString_(value);
    const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return parseLocalDateParts_(isoMatch[1], isoMatch[2], isoMatch[3]);
    }
    const displayMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (displayMatch) {
      return parseLocalDateParts_(displayMatch[3], displayMatch[2], displayMatch[1]);
    }
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseLocalDateParts_(year, month, day) {
  if (!isValidLocalDateParts_(year, month, day)) {
    return null;
  }
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function isValidLocalDateParts_(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return false;
  }
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function formatDateDisplayEs_(value) {
  if (typeof value === 'string') {
    const normalized = normalizeString_(value);
    const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch && isValidLocalDateParts_(isoMatch[1], isoMatch[2], isoMatch[3])) {
      return isoMatch[3] + '/' + isoMatch[2] + '/' + isoMatch[1];
    }
    const displayMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (displayMatch && isValidLocalDateParts_(displayMatch[3], displayMatch[2], displayMatch[1])) {
      return displayMatch[1].padStart(2, '0') + '/' + displayMatch[2].padStart(2, '0') + '/' + displayMatch[3];
    }
  }
  const date = parseDateValue_(value);
  if (!date) {
    return '';
  }
  return Utilities.formatDate(date, getAppTimeZone_(), 'dd/MM/yyyy');
}

function normalizeString_(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeDigitString_(value, length) {
  const digits = normalizeString_(value).replace(/\D/g, '');
  if (!digits) {
    return '';
  }
  if (digits.length > length) {
    return digits;
  }
  return digits.padStart(length, '0');
}

function normalizeCeafCode_(value) {
  return normalizeDigitString_(value, 3);
}

function normalizeCertNumber_(value) {
  return normalizeDigitString_(value, 7);
}

function normalizeCeafSummary_(value) {
  return normalizeString_(value).replace(/([A-Z]+-)(\d{1,3})(-\d{4})/g, function(match, prefix, number, suffix) {
    return prefix + normalizeCeafCode_(number) + suffix;
  });
}

function normalizeCertSummary_(value) {
  return normalizeString_(value).replace(/([A-Z]+-)(\d{1,7})(-\d{4})/g, function(match, prefix, number, suffix) {
    return prefix + normalizeCertNumber_(number) + suffix;
  });
}

function normalizeUpper_(value) {
  return normalizeString_(value).toUpperCase();
}

function normalizeEmail_(value) {
  return normalizeString_(value).toLowerCase();
}

function normalizeBoolean_(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = normalizeString_(value).toLowerCase();
  return ['true', '1', 'si', 'sí', 'yes', 'activo'].indexOf(normalized) !== -1;
}

function toNumber_(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function padNumber_(value, length) {
  return String(value).padStart(length, '0');
}

function generateUuid_() {
  return Utilities.getUuid();
}

function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function deriveDisplayNameFromEmail_(email) {
  const local = normalizeEmail_(email).split('@')[0] || '';
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map(function(part) {
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

function buildUserInitials_(displayName) {
  const parts = normalizeString_(displayName).split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return '';
  }
  const firstName = parts[0];
  const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
  return (firstName.charAt(0) + lastName).trim();
}

function compareDateDesc_(a, b, key) {
  const aValue = parseDateValue_(a[key]);
  const bValue = parseDateValue_(b[key]);
  const aTime = aValue ? aValue.getTime() : 0;
  const bTime = bValue ? bValue.getTime() : 0;
  return bTime - aTime;
}

function isSameDay_(value, isoDate) {
  return toIsoDateString_(value) === isoDate;
}
