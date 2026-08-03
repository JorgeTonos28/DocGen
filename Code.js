function doGet(e) {
  const view = normalizeString_(e && e.parameter && e.parameter.view) || 'app';
  if (view === 'print') {
    return renderPrintView_(e);
  }
  return renderAppView_();
}

function renderAppView_() {
  const userContext = getAuthorizedUserContext_(false);
  if (!userContext.isAuthorized) {
    return renderDeniedView_(userContext);
  }

  const template = HtmlService.createTemplateFromFile('Index');
  template.bootDataJson = JSON.stringify(buildBootstrapPayload_(userContext));
  template.logoDataUrl = getLogoDataUrl_();
  template.signatureDataUrl = getSignatureDataUrl_();
  template.appVersion = APP_VERSION;
  template.appName = APP_NAME;

  return template.evaluate()
    .setTitle(APP_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function renderDeniedView_(deniedContext) {
  const template = HtmlService.createTemplateFromFile('Denied');
  template.denied = JSON.stringify(deniedContext);
  template.appName = APP_NAME;
  return template.evaluate()
    .setTitle(APP_NAME + ' | Acceso denegado')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function renderPrintView_(e) {
  const user = assertAuthorizedUser_();
  const documentId = normalizeString_(e && e.parameter && e.parameter.id);
  if (!documentId) {
    throw new Error('Falta el parámetro id para la vista de impresión.');
  }

  const detail = getDocumentDetail_(documentId, user);
  const template = HtmlService.createTemplateFromFile('Print');
  template.documentDetailJson = JSON.stringify({
    documentId: detail.document.documentId,
    title: detail.document.documentId + '.pdf'
  });
  template.logoDataUrl = getLogoDataUrl_();
  template.appName = APP_NAME;
  template.appVersion = APP_VERSION;
  template.previewHtml = detail.previewHtml;
  template.documentTitle = detail.document.documentId;
  template.printAutoOpen = JSON.stringify(normalizeBoolean_(getConfigValue_('print_auto_open', 'false')));
  return template.evaluate()
    .setTitle(detail.document.documentId + ' | Vista imprimible')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function buildBootstrapPayload_(user) {
  return {
    app: {
      name: APP_NAME,
      version: APP_VERSION
    },
    currentUser: {
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      department: user.department,
      initials: user.initials
    },
    config: getClientConfig_(),
    catalogs: getCatalogSnapshot_(user, { includeInactive: isAdminUser_(user) }),
    dashboard: buildDashboardSummary_(user),
    documents: listDocuments_({}, user),
    audit: isAdminUser_(user) ? listAuditEntries_({ limit: 50 }, user) : [],
    users: isAdminUser_(user) ? listUsers_(user) : []
  };
}

function apiBootstrap() {
  const user = assertAuthorizedUser_();
  return buildBootstrapPayload_(user);
}

function apiGetDashboardSummary() {
  const user = assertAuthorizedUser_();
  return buildDashboardSummary_(user);
}

function apiListDocuments(filters) {
  const user = assertAuthorizedUser_();
  return listDocuments_(filters || {}, user);
}

function apiGetDocumentDetail(documentId) {
  const user = assertAuthorizedUser_();
  return getDocumentDetail_(documentId, user);
}

function apiSaveDocument(payload) {
  const user = assertAuthorizedUser_();
  return saveDocument_(payload || {}, user);
}

function apiArchiveDocuments(documentIds) {
  const user = assertAuthorizedUser_();
  return archiveDocuments_(documentIds || [], user);
}

function apiPrepareDuplicate(documentId) {
  const user = assertAuthorizedUser_();
  return prepareDuplicateDocument_(documentId, user);
}

function apiGetAuditEntries(filters) {
  const user = assertAuthorizedUser_();
  return listAuditEntries_(filters || {}, user);
}

function apiGetAdminBootstrap() {
  const user = assertAdminUser_();
  return {
    users: listUsers_(user),
    catalogs: getCatalogSnapshot_(user, { includeInactive: true }),
    audit: listAuditEntries_({ limit: 150 }, user)
  };
}

function apiSaveUserAccess(payload) {
  const user = assertAdminUser_();
  return saveUserAccess_(payload || {}, user);
}

function apiSaveCatalogItem(payload) {
  const user = assertAdminUser_();
  return saveCatalogItem_(payload || {}, user);
}

function apiSaveTemplate(payload) {
  const user = assertAdminUser_();
  return saveTemplate_(payload || {}, user);
}

function apiGetPrintPreviewHtml(payload) {
  const user = assertAuthorizedUser_();
  const regional = getRegionalByAbbreviation_(payload.regionalAbreviatura);
  return {
    previewHtml: renderDocumentHtml_(payload, user, regional)
  };
}

function apiMarkPrinted(documentId) {
  const user = assertAuthorizedUser_();
  return markDocumentPrinted_(documentId, user);
}
