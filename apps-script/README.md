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

- El secret se valida en cada request (sin él, 401).
- Solo correos `@usm.cl` o `@sansano.usm.cl` pueden subir/eliminar.
- Cada archivo subido se marca como **"Cualquiera con el link puede ver"** (los miembros NO necesitan acceso al folder).
- El folder raíz **NO** debe ser público — los usuarios acceden únicamente vía la app, nunca a Drive directamente.

## Límites del plan gratuito

- **Tamaño por archivo**: 35 MB (límite del request HTTP de Apps Script).
- **Tiempo de ejecución**: 6 minutos por request, 6 horas/día acumuladas.
- **Storage**: depende de tu cuota de Drive (15 GB gratis por cuenta de Google).

Para un equipo de ~30 personas con archivos de tipo informe/imagen/foto, esto sobra.
