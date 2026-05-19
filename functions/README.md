# Cloud Function: checkTaskDueDates

Esta carpeta contiene la Cloud Function programada `checkTaskDueDates` que revisa las tareas en Firestore y crea actividades (`due_soon` y `overdue`) en la colección `activities`.

Objetivo:
- Ejecutar en servidor (Cloud Functions) cada 15 minutos para evitar duplicados y cargas desde clientes.

Archivos importantes:
- `index.js`: función programada.
- `package.json`: dependencias (`firebase-admin`, `firebase-functions`).

Pasos seguros para desplegar (sin cambiar tu estructura):

1) Preparar el entorno (desde la raíz del repo):

```bash
cd functions
npm install
```

2) Desplegar con Firebase CLI (método recomendado si usas Firebase):

- Asegúrate de haber inicializado el proyecto y estar en el proyecto correcto:

```bash
firebase login
firebase use --add
```

- Desplegar la función:

```bash
firebase deploy --only functions:checkTaskDueDates
```

Nota: la función usa `functions.pubsub.schedule` y Firebase se encarga de crear el trigger de Scheduler.

3) Configurar el umbral `DUE_SOON_HOURS` (por ejemplo 24 horas)

Opción A — Usar la consola de Google Cloud (fácil y seguro):

- Ve a Google Cloud Console → Cloud Functions → selecciona `checkTaskDueDates` → Editar → sección "Variables de entorno" y agrega:

  - `DUE_SOON_HOURS` = `24`

- Guarda y redepliega la función desde la consola.

Opción B — Usar `gcloud` al desplegar (permite pasar variables de entorno):

```bash
gcloud functions deploy checkTaskDueDates \
  --region=us-central1 \
  --runtime=nodejs18 \
  --trigger-topic=projects/YOUR_PROJECT/topics/cloud-scheduler \
  --set-env-vars DUE_SOON_HOURS=24
```

Nota: Si prefieres usar `firebase functions:config:set` (configuración que se obtiene con `functions.config()`), habría que adaptar `index.js` para leer `functions.config()` en lugar de `process.env`. Actualmente la función lee `process.env.DUE_SOON_HOURS`.

4) Pruebas locales (opcional)

- Puedes probar la función localmente con el emulador de funciones de Firebase. Desde `functions`:

```bash
npm install -g firebase-tools
firebase emulators:start --only functions
```

La función programada no se disparará automáticamente en el emulador con el mismo cron; puedes ejecutar la función manualmente con `node` invocando el archivo exportado si necesitas probar la lógica.

5) Qué esperar

- La función busca tareas con `dueDate` en Firestore. Si una tarea está vencida crea una actividad `overdue`. Si una tarea vence dentro de `DUE_SOON_HOURS` crea `due_soon`.
- Para evitar duplicados, la función consulta actividades recientes antes de crear nuevas (parámetros internos: 7-30 días según acción).

6) Seguridad y rendimiento

- La función lee todas las tareas (se itera sobre snapshot). Si tienes miles de tareas, considerar paginación o consultas parciales (por ejemplo: solo tareas con `dueDate <= now + DUE_SOON_HOURS`). Puedo ayudarte a ajustar la consulta si lo deseas.

Si quieres, despliego la función para ti (necesitaré acceso o que me confirmes los comandos a ejecutar). También puedo adaptar `index.js` para leer `functions.config()` si prefieres administrar la configuración con `firebase functions:config:set`.
