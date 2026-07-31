function logAudit_(entityType, entityId, action, actor, summary, payload) {
  appendSheetRecords_(SHEETS.AUDIT, [{
    audit_id: generateUuid_(),
    entity_type: entityType,
    entity_id: entityId,
    action: action,
    actor_email: actor.email,
    actor_name: actor.displayName,
    timestamp: nowIsoString_(),
    summary: summary,
    payload_json: payload ? JSON.stringify(payload) : ''
  }]);
}

function listAuditEntries_(filters, user) {
  const actor = user || assertAdminUser_();
  if (!isAdminUser_(actor)) {
    return [];
  }

  const rows = getSheetRecords_(SHEETS.AUDIT);
  const search = normalizeString_((filters && filters.search) || '').toLowerCase();
  const limit = toNumber_((filters && filters.limit) || 150, 150);

  return rows
    .filter(function(row) {
      if (!search) {
        return true;
      }
      return [
        row.entity_type,
        row.entity_id,
        row.action,
        row.actor_email,
        row.actor_name,
        row.summary
      ].join(' ').toLowerCase().indexOf(search) !== -1;
    })
    .sort(function(a, b) {
      return compareDateDesc_(a, b, 'timestamp');
    })
    .slice(0, limit)
    .map(function(row) {
      return {
        auditId: row.audit_id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        action: row.action,
        actorEmail: row.actor_email,
        actorName: row.actor_name,
        timestamp: toClientDateTime_(row.timestamp),
        summary: row.summary
      };
    });
}
