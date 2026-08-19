const APP_VERSION = '1.3.9';
const APP_NAME = 'DocGen INFOTEP';

const SHEETS = Object.freeze({
  CONFIG: 'Config',
  USERS: 'Usuarios',
  REGIONALS: 'Regionales',
  AGREEMENT_TYPES: 'TiposConvenio',
  CERT_PREFIXES: 'PrefijosCertificacion',
  DOCUMENTS: 'Documentos',
  DOCUMENT_LINES: 'DocumentoLineas',
  AUDIT: 'Auditoria',
  TEMPLATES: 'Plantillas'
});

const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  USER: 'USER',
  AUDITOR: 'AUDITOR'
});

const ACCESS_STATUS = Object.freeze({
  ACTIVE: 'ACTIVO',
  PENDING: 'PENDIENTE',
  INACTIVE: 'INACTIVO'
});

const DOCUMENT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVO',
  ARCHIVED: 'ANULADO'
});

const TEMPLATE_KEYS = Object.freeze({
  OFICIO_SINGLE: 'OFICIO_REMISION_CEAF_SINGLE',
  OFICIO_MULTI: 'OFICIO_REMISION_CEAF_MULTI'
});

const DEFAULT_CONFIG_ROWS = Object.freeze([
  ['app_name', 'DocGen INFOTEP', 'Nombre visible de la aplicacion'],
  ['institution_name', 'INFOTEP', 'Nombre institucional'],
  ['allowed_domain', 'infotep.gob.do', 'Dominio autorizado para acceder a la web app'],
  ['support_email', '', 'Correo para soporte o solicitud de acceso'],
  ['primary_color', '#003366', 'Color primario institucional'],
  ['secondary_color', '#F37021', 'Color secundario institucional'],
  ['logo_file_id', '', 'ID de archivo en Drive para el logo de la app'],
  ['signature_file_id', '', 'ID de archivo en Drive para firma institucional'],
  ['ui_signature_width_px', '168', 'Ancho en pixeles de la firma en el footer de la web app'],
  ['ui_signature_height_px', '', 'Alto en pixeles de la firma en el footer de la web app; vacio mantiene proporcion'],
  ['document_sequence', '0', 'Secuencia incremental para IDs de documentos'],
  ['max_ceaf_per_document', '3', 'Cantidad maxima de lineas CEAF por oficio'],
  ['cert_date_lookback_days', '31', 'Cantidad maxima de dias hacia atras permitida para fecha de certificacion'],
  ['print_auto_open', 'false', 'Indica si la vista imprimible dispara el cuadro de impresion automaticamente'],
  ['legal_director_name', 'Carmen Reyes', 'Nombre mostrado en la firma del oficio'],
  ['legal_director_title', 'Directora Juridica', 'Cargo mostrado en la firma del oficio']
]);

const SHEET_HEADERS = Object.freeze({
  Config: ['key', 'value', 'description'],
  Usuarios: ['email', 'display_name', 'role', 'status', 'department', 'notes', 'created_at', 'updated_at'],
  Regionales: ['regional_id', 'abreviatura', 'regional', 'director', 'sexo', 'cargo', 'activo', 'updated_at'],
  TiposConvenio: ['convenio_id', 'tipo_convenio', 'activo', 'orden', 'updated_at'],
  PrefijosCertificacion: ['prefix_id', 'codigo', 'descripcion', 'activo', 'orden', 'updated_at'],
  Documentos: ['document_id', 'document_type', 'template_variant', 'document_year', 'regional_abreviatura', 'regional_nombre', 'status', 'item_count', 'ceaf_summary', 'convenio_summary', 'centro_summary', 'numeracion_summary', 'notes', 'created_at', 'created_by_email', 'created_by_name', 'updated_at', 'updated_by_email', 'owner_email', 'owner_name', 'deleted_at', 'deleted_by_email', 'last_printed_at', 'last_printed_by_email'],
  DocumentoLineas: ['line_id', 'document_id', 'revision_no', 'sort_order', 'ceaf', 'tipo_convenio', 'centro', 'cert_prefix', 'numeracion', 'fecha_certificacion', 'is_current', 'created_at', 'updated_at'],
  Auditoria: ['audit_id', 'entity_type', 'entity_id', 'action', 'actor_email', 'actor_name', 'timestamp', 'summary', 'payload_json'],
  Plantillas: ['template_key', 'template_name', 'variant', 'active', 'html_content', 'updated_at', 'updated_by_email']
});
