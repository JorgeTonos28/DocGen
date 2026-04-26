# Reglas Operativas para Agentes

Estas reglas aplican a cualquier agente o desarrollador que modifique este proyecto.

## 1. Versionado primero

- Antes de cualquier cambio funcional, incrementa `APP_VERSION` en [Constants.gs](/C:/Users/jorge/Documents/AppScript/Doc_Gen/src/Constants.gs:1).
- El resumen final debe mencionar explicitamente la nueva version.
- Si el cambio impacta despliegue, indica que debe publicarse un nuevo deployment de la web app.

## 2. README siempre al dia

- Si cambias comportamiento, setup, estructura de hojas, `Config`, manifest, scopes, templates, vistas o despliegue, actualiza [README.md](/C:/Users/jorge/Documents/AppScript/Doc_Gen/src/README.md:1) en la misma interaccion.
- No dejes deuda documental para despues.

## 3. Manifest y servicios

- Si agregas o quitas un servicio avanzado, actualiza `appsscript.json`.
- Si agregas o quitas scopes OAuth, actualiza `appsscript.json` y `README.md`.
- No uses servicios avanzados nuevos sin dejar el manifest listo para `clasp push`.
- Si el cambio depende de Drive, Sheets u otro servicio de Google, piensa tambien en permisos, errores de autorizacion y degradacion segura.

## 4. Arquitectura vigente

- Este proyecto no usa multi-tenant.
- No reintroduzcas `administracion_id`, `regional_scope` ni logo por regional salvo instruccion explicita del usuario.
- El logo institucional es global y sale de `Config.logo_file_id`.
- Todos los usuarios habilitados pueden operar sobre todas las regionales; la vista global total sigue siendo administrativa.

## 5. Responsive no negociable

- Toda modificacion de UI debe mantenerse usable en escritorio y movil.
- Breakpoints operativos:
  - `<= 1024px`: sidebar como drawer, layouts apilados y tablas con overflow.
  - `<= 720px`: compactacion adicional de acciones, formularios y tablas.
- En cambios de layout, valida scroll vertical real, `overflow` de tablas, espacios internos y que no queden botones o textos pegados a los bordes.

## 6. Spinner en todo proceso asincrono

- Toda llamada visible a `google.script.run` debe pasar por el mecanismo central de busy/loading.
- Si un flujo encadena varias llamadas, el spinner debe cubrir todo el ciclo.
- No introduzcas procesos asincronos nuevos que no den feedback visual claro al usuario.

## 7. Seguridad y acceso

- No implementes login propio ni manejo local de contrasenas salvo instruccion explicita.
- La autenticacion debe seguir basada en cuenta activa del dominio + hoja `Usuarios`.
- No hardcodees IDs de Drive, IDs de spreadsheet, dominios ni secretos si pueden vivir en `Config` o Script Properties.
- Toda operacion administrativa o sensible debe validar permisos del lado servidor.

## 8. Integridad de datos

- Manten validacion en cliente y servidor para todo dato critico.
- Las escrituras de documentos deben conservar `LockService` o equivalente.
- No sustituyas anulacion logica por borrado fisico sin instruccion explicita.
- Si cambias headers o estructura de hojas, actualiza `setupDocGen()` y preserva la migracion de datos existentes.
- Si cambias numeracion, fechas, estados o reglas de unicidad, revisa tambien historial, auditoria, impresion y edicion.

## 9. Auditoria y trazabilidad

- Todo cambio relevante sobre documentos, usuarios, catalogos o plantillas debe seguir registrandose en `Auditoria`.
- No desactives auditoria para simplificar un flujo.
- Si agregas una entidad nueva administrable, incorpora logging consistente.

## 10. Plantillas e imagenes

- Conserva las reglas del MVP para oficios CEAF salvo instruccion contraria.
- No rompas placeholders de las plantillas oficiales.
- Logos, fotos y firmas deben seguir el patron `data URL` desde Drive via `Config`.
- Si agregas nuevas imagenes institucionales, usa helpers equivalentes a `getImageDataUrlFromConfig_(key)`.

## 11. Calidad minima antes de cerrar

- Revisa sintaxis de los archivos modificados si es posible.
- Piensa explicitamente en escenarios de error:
  - usuario no autorizado,
  - catalogos vacios,
  - numeracion duplicada,
  - fecha invalida,
  - documento inexistente,
  - permisos insuficientes,
  - fallo en guardado, edicion, anulacion o impresion,
  - archivo Drive invalido o inaccesible.
- Si no pudiste probar algo, dilo claramente en el resumen final.

## 12. Setup tras cambios estructurales

- Si cambias el esquema de hojas, seeds o migraciones, indica en el resumen final que debe volver a ejecutarse `setupDocGen()`.
- Si el cambio toca manifest, deja claro si basta con `clasp push` o si hace falta redeploy.
