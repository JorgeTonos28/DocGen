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
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateDisplayEs_(value) {
  const date = parseDateValue_(value);
  if (!date) {
    return '';
  }
  return Utilities.formatDate(date, getAppTimeZone_(), 'dd/MM/yyyy');
}

function normalizeString_(value) {
  return String(value == null ? '' : value).trim();
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
