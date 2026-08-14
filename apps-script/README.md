# Drive Upload Bridge — Apps Script Backend

Reemplaza Firebase Storage con un backend gratuito basado en Google Apps Script + Google Drive.

## Configuración inicial (una sola vez)

### 1. Crear el Apps Script

1. Ve a [https://script.google.com](https://script.google.com) e inicia sesión con la cuenta dueña del folder de Drive.
2. **Nuevo proyecto** → renómbralo a `USM CubeSat Drive Bridge`.
3. Borra el contenido del editor y pega el contenido completo de [`Code.gs`](./Code.gs).

### 2. Configurar las constantes

En `Code.gs`, reemplaza:

```javascript
const FOLDER_ID = 'PUT_YOUR_DRIVE_FOLDER_ID_HERE';
const SHARED_SECRET = 'PUT_A_LONG_RANDOM_STRING_HERE';
```

- **`FOLDER_ID`**: el ID del folder de Drive donde se guardarán los archivos.
  Si tu link es `https://drive.google.com/drive/folders/1l_ahsoU6KQO9__-fCQvM9mK9PqH5aS-9?usp=sharing`,
  el ID es `1l_ahsoU6KQO9__-fCQvM9mK9PqH5aS-9`.
- **`SHARED_SECRET`**: una cadena larga y aleatoria. Ejemplo:
  `crypto.randomUUID()` desde la consola del navegador, o
  [`https://www.uuidgenerator.net`](https://www.uuidgenerator.net). Mínimo 32 caracteres.

### 2.b. Configurar las Script Properties (obligatorio)

Las claves de servidor **nunca** van en `Code.gs` (el archivo está versionado en el repo). Se
configuran en **Configuración del proyecto → Propiedades del script → Agregar propiedad**:

| Propiedad | Para qué sirve | ¿Obligatoria? |
|-----------|----------------|---------------|
| `GOOGLE_AI_KEY` | Clave de la API de Gemini que usa el proxy de chat. | Sí, para el chatbot |
| `FIREBASE_WEB_API_KEY` | Clave web de Firebase (`VITE_FIREBASE_API_KEY`). Se usa para validar los ID tokens contra `identitytoolkit.googleapis.com/v1/accounts:lookup`. | **Sí** |

`FIREBASE_WEB_API_KEY` es el mecanismo autoritativo para verificar un ID token *de Firebase*:
`accounts:lookup` rechaza tokens vencidos, malformados o emitidos para otro proyecto (la clave
fija la audiencia) y devuelve el correo verificado de la cuenta. El endpoint genérico
`oauth2.googleapis.com/tokeninfo` valida ID tokens de **Google OAuth** (emisor
`accounts.google.com`), no los JWT de `securetoken.google.com` que emite Firebase, por lo que se
mantiene sólo como respaldo para despliegues que aún no configuran la propiedad. Sin una de las
dos vías, `REQUIRE_ID_TOKEN` deja el bridge cerrado y las subidas fallan.

### 3. Desplegar como Web App

1. Botón **Implementar** (arriba a la derecha) → **Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Configuración:
   - **Descripción**: `CubeSat Drive Bridge v1`
   - **Ejecutar como**: `Yo (tu correo)`
   - **Quién tiene acceso**: `Cualquier usuario`
4. **Implementar**.
5. La primera vez te pedirá autorizar permisos de Drive. Acepta.
6. Copia la **URL de la aplicación web** (formato: `https://script.google.com/macros/s/AKfyc.../exec`).

### 4. Configurar variables en la app web

Agrega a `.env.local` (y a los GitHub Secrets para producción):

```env
VITE_DRIVE_UPLOAD_URL=https://script.google.com/macros/s/AKfyc.../exec
VITE_DRIVE_UPLOAD_SECRET=el-mismo-secret-de-Code.gs
```

## Verificar que funciona

Abre la URL en el navegador. Debe responder:

```json
{ "ok": true, "service": "USM CubeSat Drive Bridge" }
```

## Actualizar el script

Cuando edites `Code.gs`:

1. Pega los cambios en el editor de Apps Script.
2. **Implementar** → **Administrar implementaciones** → ícono de lápiz → **Nueva versión** → **Implementar**.
3. La URL no cambia (siempre apunta a la última versión).

## Estructura de carpetas

El script organiza los archivos automáticamente en subcarpetas dentro del folder raíz:

```
{folder raíz}
├── tasks/
│   ├── {taskId-1}/
│   │   ├── archivo-1.pdf
│   │   └── archivo-2.png
│   └── {taskId-2}/
├── projects/
│   └── {projectId}/
└── general/
```

## Seguridad

- El secret se valida en cada request (sin él, 401). **No es una credencial de autenticación**:
  se distribuye a cada miembro autenticado vía Firestore (`system_config/keys`) y llega al
  navegador, así que por sí solo no prueba nada sobre quién llama.
- La identidad real proviene del **ID token de Firebase verificado en el servidor**
  (`REQUIRE_ID_TOKEN = true`). El correo de confianza se deriva del token, nunca del campo
  `userEmail` que envía el cliente (que es falsificable).
- **La autenticación ocurre antes de cualquier escritura en Drive.** Anteriormente el archivo se
  creaba y se publicaba con enlace ("cualquiera con el link") *antes* de resolver el correo de
  confianza, de modo que un llamante con sólo el secret podía dejar archivos en el Drive del
  equipo sin sesión válida — y esos archivos quedaban sin etiqueta `uploader:`, lo que a su vez
  permitía que cualquiera los borrara. Ambos huecos están cerrados.
- **Sin etiqueta de propiedad, no se borra.** Un archivo sin `uploader:` en su descripción ya no
  se elimina por compatibilidad hacia atrás: hay que borrarlo desde Drive directamente.
- **Rate limiting por llamante verificado** en chat, subida y borrado, para acotar el abuso de la
  cuota de Drive y de la clave de pago de Gemini.
- **Política de servidor en el chat**: el `systemInstruction` que envía el cliente se acota en
  tamaño y siempre se le añade una política inmutable del lado servidor, de modo que el alcance
  "solo CubeSat" no dependa de una cadena que el llamante puede omitir.
- Solo correos `@usm.cl` o `@sansano.usm.cl` pueden subir/eliminar.
- Cada archivo subido se marca como **"Cualquiera con el link puede ver"** (los miembros NO necesitan acceso al folder).
- El folder raíz **NO** debe ser público — los usuarios acceden únicamente vía la app, nunca a Drive directamente.
- `ALLOWED_MODELS` debe mantenerse sincronizado con `MODEL_CANDIDATES` de
  `src/sdk/BotService.ts`: un modelo que el cliente intenta y el bridge rechaza deja el chat
  caído (falla cerrada).

## Límites del plan gratuito

- **Tamaño por archivo**: 35 MB (límite del request HTTP de Apps Script).
- **Tiempo de ejecución**: 6 minutos por request, 6 horas/día acumuladas.
- **Storage**: depende de tu cuota de Drive (15 GB gratis por cuenta de Google).

Para un equipo de ~30 personas con archivos de tipo informe/imagen/foto, esto sobra.
