# DocGen INFOTEP

Aplicacion web en Google Apps Script para generar, editar, imprimir, anular y auditar oficios de remision CEAF. Esta version reemplaza el MVP legado en PHP y conserva su flujo funcional, pero con una arquitectura de datos basada en Google Sheets, manifest de Apps Script versionado y despliegue por `clasp`.

## Estado actual

El proyecto ya incluye:

- shell web con dashboard, generador, historial, detalle, usuarios, catalogos y auditoria;
- setup inicial con migracion segura de headers si el esquema cambia;
- autocorreccion de schema en lectura/escritura para alinear headers vigentes aun si una hoja quedo con columnas anteriores;
- plantillas oficiales `OficioTemplateSingle.html` y `OficioTemplateMulti.html`;
- validacion cliente/servidor, spinner global y auditoria;
- refresco de UI sin recarga tras guardar documentos, usuarios y catalogos;
- refresco operativo granular para panel/historial/admin sin depender de un bootstrap completo despues de guardar;
- historial con filtros automaticos en cliente sobre el dataset completo cargado, sin necesidad de pulsar aplicar;
- apertura de detalle/edicion con cache cliente y cache corta por usuario para reducir esperas repetidas;
- layouts ajustados para escritorio medio (`1366x768`), tablet y movil;
- header superior simplificado solo con avatar abreviado y footer del sidebar reducido a la version;
- scroll dedicado para auditoria del documento y auditoria global cuando la lista crece;
- scrollbars estilizados segun la linea grafica institucional;
- modo imprimible alineado a la estructura visual del Legacy, con icono inferior derecho, identificador corto del creador y geometria estable para A4;
- fallback automatico a las plantillas bundladas cuando la hoja `Plantillas` contiene una version vieja o incompatible del oficio oficial;
- acceso por cuenta activa del dominio + hoja `Usuarios`;
- logo y firma desde Drive mediante `data URL`;
- preservacion de ceros a la izquierda en CEAF y numeracion, tanto al leer desde Sheets como al guardar nuevas lineas;
- validacion de formulario alineada al MVP: CEAF de 3 digitos, numeracion de 7 digitos, ventana de fecha controlada y unicidad de numeracion activa con mensaje del usuario dueño cuando aplica;
- seed base heredado del sistema Legacy para regionales, convenios, prefijos y usuarios.

No incluye login propio por formulario.

## Estructura

```text
Doc_Gen/
|-- Legacy/          # MVP original en PHP
|-- Stitch_Design/   # Referencias visuales exportadas desde Stitch
`-- src/             # Proyecto Apps Script real
    |-- *.gs
    |-- *.html
    |-- appsscript.json
    |-- .clasp.json
    |-- README.md
    `-- AGENTS.md
```

## Arquitectura Apps Script

### Backend

- `Code.gs`: `doGet`, bootstrap y endpoints consumidos por `google.script.run`.
- `AccessService.gs`: control de acceso por dominio y hoja `Usuarios`.
- `ConfigService.gs`: `Config`, secuencia documental y carga de imagenes desde Drive.
- `Repository.gs`: lectura, escritura y migracion de estructura en Sheets.
- `DocumentService*.gs`: reglas del oficio, historial, edicion, duplicado, anulacion, impresion, cache corta de detalle y unicidad de numeracion.
- `DocumentRenderService.gs`: render oficial de las plantillas y preservacion del formato Legacy.
- `AdminService.gs`: catalogos, usuarios y plantillas.
- `AuditService.gs`: trazabilidad.
- `Setup.gs`: creacion de hojas, migracion de headers y seeds iniciales.

### Frontend

- `Index.html`: entrypoint.
- `AppShell.html`: layout, vistas y markup principal.
- `Styles.html`: sistema visual responsive con breakpoints para desktop medio, tablet y movil, ademas de scrollbars institucionales.
- `AppScripts.html`: SPA, spinner, modales, render, refresco incremental, filtros locales de historial, impresion inmediata en cliente, sincronizacion silenciosa post-impresion, cache cliente de detalle y llamadas al servidor.
- `Print.html`: fallback server-side para impresion.
- `Denied.html`: acceso denegado.

## Manifest y servicios

`appsscript.json` ya declara el servicio avanzado de Drive:

```json
{
  "dependencies": {
    "enabledAdvancedServices": [
      {
        "userSymbol": "Drive",
        "serviceId": "drive",
        "version": "v3"
      }
    ]
  }
}
```

Scopes usados actualmente:

- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/drive`
- `https://www.googleapis.com/auth/userinfo.email`

Si el script usa un proyecto estandar de Google Cloud en lugar del predeterminado de Apps Script, valida tambien que Drive API este habilitada en ese proyecto.

## Modelo de datos

La app usa una Google Sheet como datastore principal. Si el proyecto no esta vinculado a una spreadsheet, define `DOCGEN_SPREADSHEET_ID` en Script Properties.

### Hojas y headers

#### `Config`

```text
key | value | description
```

Claves sembradas:

- `app_name`
- `institution_name`
- `allowed_domain`
- `support_email`
- `primary_color`
- `secondary_color`
- `logo_file_id`
- `signature_file_id`
- `ui_signature_width_px`
- `ui_signature_height_px`
- `document_sequence`
- `max_ceaf_per_document`
- `cert_date_lookback_days`
- `print_auto_open`
- `legal_director_name`
- `legal_director_title`

#### `Usuarios`

```text
email | display_name | role | status | department | notes | created_at | updated_at
```

#### `Regionales`

```text
regional_id | abreviatura | regional | director | sexo | cargo | activo | updated_at
```

#### `TiposConvenio`

```text
convenio_id | tipo_convenio | activo | orden | updated_at
```

#### `PrefijosCertificacion`

```text
prefix_id | codigo | descripcion | activo | orden | updated_at
```

#### `Documentos`

```text
document_id | document_type | template_variant | document_year | regional_abreviatura | regional_nombre | status | item_count | ceaf_summary | convenio_summary | centro_summary | numeracion_summary | notes | created_at | created_by_email | created_by_name | updated_at | updated_by_email | owner_email | owner_name | deleted_at | deleted_by_email | last_printed_at | last_printed_by_email
```

#### `DocumentoLineas`

```text
line_id | document_id | revision_no | sort_order | ceaf | tipo_convenio | centro | cert_prefix | numeracion | fecha_certificacion | is_current | created_at | updated_at
```

#### `Auditoria`

```text
audit_id | entity_type | entity_id | action | actor_email | actor_name | timestamp | summary | payload_json
```

#### `Plantillas`

```text
template_key | template_name | variant | active | html_content | updated_at | updated_by_email
```

## Decision arquitectonica vigente

Este proyecto ya no usa modelo multi-tenant. Por tanto:

- no existe `administracion_id`;
- no existe `regional_scope`;
- el logo es global de la app via `Config.logo_file_id`;
- todas las regionales estan disponibles para todos los usuarios habilitados.

La visibilidad global de documentos sigue reservada al rol `ADMIN`. Los usuarios no admin conservan acceso sobre sus propios registros.

## Seeds iniciales

`setupDocGen()` siembra automaticamente:

- regionales base del Legacy:
  - DRM, DRCN, DRCS, DRS, DRO, DRE, DRV;
- tipos de convenio base del Legacy;
- prefijos `BS` y `CI`;
- usuarios base heredados del sistema anterior;
- plantillas HTML oficiales;
- el usuario actual como `ADMIN` si aun no existe.

Los nombres base se tomaron del MVP Legacy y de la data entregada para la migracion.

## Reglas de negocio

- solo acceden usuarios del dominio configurado y activos en `Usuarios`;
- cada oficio admite de 1 a 3 lineas CEAF;
- `ceaf` debe tener exactamente 3 digitos;
- `numeracion` debe tener exactamente 7 digitos;
- `ceaf`, `numeracion`, `ceaf_summary` y `numeracion_summary` se tratan como texto para preservar ceros a la izquierda;
- las numeraciones deben ser unicas entre documentos activos;
- la fecha de certificacion no puede estar en el futuro ni fuera de la ventana permitida;
- el documento se anula logicamente, no se borra fisicamente;
- toda accion relevante se registra en `Auditoria`;
- el render oficial usa la regional, sexo, director y plantilla correcta single/multi;
- si una plantilla guardada en hoja no cumple la estructura oficial del oficio, la app usa automaticamente la plantilla oficial bundlada del proyecto para preservar el formato Legacy.

## Setup

### 1. Vincular la hoja de datos

Opciones:

1. proyecto Apps Script ligado directamente a una Google Sheet;
2. proyecto standalone con Script Property `DOCGEN_SPREADSHEET_ID`.

### 2. Ejecutar `setupDocGen()`

Esta funcion:

- crea hojas faltantes;
- migra headers existentes al esquema actual sin depender de columnas viejas;
- autoalinea hojas administradas tambien durante operaciones normales si detecta drift de headers;
- siembra `Config`;
- siembra catalogos base y usuarios del Legacy;
- siembra plantillas oficiales;
- registra al usuario actual como admin si hace falta.

Si vienes de una version previa del proyecto, vuelve a correr `setupDocGen()` despues de hacer `clasp push`.

## Deployment web app

Para reflejar cambios en la misma URL `exec` no necesitas crear un deployment nuevo. El flujo correcto es:

1. `clasp push`
2. Apps Script > `Deploy` > `Manage deployments`
3. editar el deployment web app que ya usas
4. en `Version`, seleccionar `New version`
5. guardar

Eso actualiza la URL existente del deployment. Si creas un deployment nuevo, Google genera otra URL distinta.

Notas utiles:

- `Deploy > New deployment` crea otra URL `exec`.
- `Deploy > Manage deployments > editar el deployment actual > New version` mantiene la misma URL `exec`.
- la URL `/dev` siempre sirve el ultimo codigo guardado para editores del proyecto, pero la URL `/exec` siempre sirve una version publicada.
- en esta app no necesitas cambiar el link por cada cambio si sigues editando el mismo deployment y publicando una nueva version dentro de ese mismo deployment.

Si el navegador sigue mostrando una version vieja, abre la URL `exec` en incognito o fuerza recarga completa despues de publicar la nueva version.

### 3. Completar configuracion institucional

Revisa al menos:

- `Config.support_email`
- `Config.logo_file_id`
- `Config.signature_file_id`
- `Config.ui_signature_width_px`
- `Config.ui_signature_height_px`
- estados/roles finales de `Usuarios`

### 4. Desplegar la web app

Configuracion recomendada:

- `Execute as`: propietario del script
- `Who has access`: usuarios del dominio institucional

## Logo, fotos y firmas desde Drive

La app sigue el patron institucional de imagenes por `data URL`:

1. guardar el ID del archivo en `Config` (`logo_file_id` o `signature_file_id`);
2. validar el metadata del archivo con Drive API;
3. leer el blob y convertirlo a `data:image/...;base64,...`;
4. inyectar la imagen en el HTML.

Helpers principales:

- `getImageDataUrlFromConfig_(key)`
- `getDriveFileMetadata_(fileId)`
- `getLogoDataUrl_()`
- `getSignatureDataUrl_()`

## UX y responsive

La UI actual contempla:

- sidebar drawer bajo `1024px`;
- layouts apilados bajo `1024px`;
- compactacion adicional bajo `720px`;
- scroll interno estable en desktop para que no se corte contenido largo;
- `overflow` horizontal en tablas;
- scroll dedicado en auditorias largas;
- footer global con firma opcional cargada desde Drive y tamano configurable por `Config`;
- padding uniforme en paneles;
- spinner global en todos los procesos asincronos.

## Seguridad e integridad

- sin login propio ni contrasenas locales;
- validacion de permisos en servidor;
- validacion de datos en cliente y servidor;
- `LockService` en escritura documental;
- anulacion logica;
- auditoria obligatoria;
- degradacion segura si el logo o la firma configurados en Drive no pueden leerse.

## Flujo operativo

### Usuario

1. abre la web app con su cuenta institucional;
2. selecciona una regional;
3. agrega lineas CEAF;
4. guarda el oficio;
5. revisa vista previa;
6. imprime;
7. consulta o edita desde historial.

### Admin

Ademas de lo anterior:

1. gestiona usuarios;
2. mantiene regionales, convenios y prefijos;
3. ajusta plantillas;
4. revisa auditoria global.

## Limitaciones actuales

- la impresion sigue siendo browser-based;
- las plantillas son HTML libre y deben editarse con cuidado;
- la lista inicial de usuarios/convenios sembrados depende de la data base de migracion entregada y puede ajustarse despues si faltara algun valor institucional.
