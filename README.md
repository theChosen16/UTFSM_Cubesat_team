# USM CubeSat Team 🛰️

Sitio web oficial del equipo de nano satélites de la **Universidad Técnica Federico Santa María (UTFSM)**. La aplicación permite gestionar miembros, proyectos y recursos del equipo en una plataforma centralizada con autenticación segura.

## Tabla de contenidos

- [Tecnologías](#tecnologías)
- [Funcionalidades](#funcionalidades)
- [Optimizaciones UI/UX](#optimizaciones-uiux)
  - [Optimización de rendimiento móvil](#optimización-de-rendimiento-móvil)
- [Roles y permisos](#roles-y-permisos)
- [Equipos](#equipos)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Variables de entorno](#variables-de-entorno)
- [Scripts disponibles](#scripts-disponibles)
- [Tests E2E con Firebase Emulators](#tests-e2e-con-firebase-emulators)
- [Despliegue](#despliegue)
- [CI/CD](#cicd)
- [Logging y diagnóstico](#logging-y-diagnóstico)
- [Contribuir](#contribuir)
  - [Feedback y sugerencias](#feedback-y-sugerencias)
  - [Contribuir con código](#contribuir-con-código)
  - [Proceso CI/CD y aprobación](#proceso-cicd-y-aprobación)
  - [Reportar vulnerabilidades](#reportar-vulnerabilidades)
- [Seguridad](#seguridad)

## Tecnologías

| Categoría | Herramienta |
|-----------|-------------|
| Framework UI | [React 18](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/) |
| Build tool | [Vite](https://vitejs.dev/) |
| Estilos | [Tailwind CSS](https://tailwindcss.com/) |
| Backend / Auth | [Firebase](https://firebase.google.com/) (Authentication + Firestore) |
| Almacenamiento de archivos | [Google Apps Script](https://script.google.com/) + [Google Drive](https://drive.google.com/) (gratuito, sin Firebase Storage) |
| Routing | [React Router v6](https://reactrouter.com/) |
| Iconos | [Lucide React](https://lucide.dev/) |
| Testing | [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) + Firebase Emulators (E2E) |
| CI/CD | GitHub Actions + GitHub Pages |

## Funcionalidades

- **Landing page** pública con información del equipo y **línea de tiempo histórica** con scroll-reveal animado (IntersectionObserver) que narra la trayectoria del equipo desde 2019 hasta 2026
- **Autenticación**: registro en dos pasos (email/contraseña → nombre y apellido), inicio de sesión y recuperación de contraseña vía Firebase Auth. Los usuarios existentes sin nombre registrado son interceptados por un overlay obligatorio al iniciar sesión
- **Dashboard** privado con estadísticas en tiempo real desde Firestore (proyectos activos, tareas pendientes, completadas y miembros)
  - Saludo personalizado según género del usuario (Bienvenido/Bienvenida)
  - Estructura del equipo muestra distribución de miembros por equipo (`equipo`), no por rol
- **Proyectos**: listado y creación de proyectos del equipo con formulario integrado (nombre, descripción, equipo, prioridad, fecha límite). Datos almacenados en Firestore con feedback de errores al usuario
- **Gestión de Tareas**: dashboard para maestro, admin y manager que permite crear tareas asignando proyecto, equipo encargado, prioridad, responsable(s) y **fecha límite**. Cada tarea puede incluir **hitos internos** (pasos trazables) y **entregables** (archivos o resultados esperados). Mensajes de error visibles al usuario en caso de fallo
  - **Hitos de tarea**: divide una tarea en etapas internas con nombre, descripción y fecha límite propios
  - **Entregables y evidencias**: define qué archivos o resultados deben entregarse; los responsables suben archivos directamente desde la tarjeta de la tarea
  - **Historial de avance**: cualquier responsable puede registrar un mensaje de progreso en una tarea, con estado y fecha, visible en orden cronológico inverso
  - **Indicador de plazo vencido**: las tareas con fecha límite pasada muestran el plazo en rojo
  - **Aprobación de entregables**: maestro, admin y manager pueden marcar un entregable como aprobado
- **Repertorio de archivos** (`/files`): biblioteca central para evidencias, entregables y documentos del equipo, **respaldada en Google Drive** vía un Apps Script gratuito (sin Firebase Storage). Permite subir archivos asociados a proyectos o tareas, filtrar por proyecto, tarea, miembro y tipo de documento (PDF, Imagen, Planilla, Documento). Los archivos se organizan automáticamente en subcarpetas `tasks/{id}/`, `projects/{id}/` y `general/` dentro del folder de Drive del proyecto. Los administradores y el propio autor pueden eliminar archivos
- **Selección de equipos**: cada usuario puede pertenecer a hasta 2 equipos simultáneamente, seleccionables desde su perfil mediante checkboxes
- **Miembros**: directorio de integrantes mostrando equipos asignados (máximo 2) y rol. Solo se muestran badges de rol para admin y maestro. Gestión de rol mediante dropdown, accesible para maestro. Asignación de equipos mediante checkboxes, accesible para maestro y admin. Manejo de errores en imágenes de avatar con fallback automático
- **Perfil**: vista y edición de datos personales, selección de equipos (máx. 2), género y cuestionario de cualidades
  - **Foto de perfil**: los usuarios pueden subir una foto de perfil (máx. 500 KB) que se muestra en el sidebar, perfil y directorio de miembros
  - **Selección de género**: permite al usuario indicar su género para personalizar el saludo en el dashboard
- **Indicadores de permisos**: las opciones restringidas del menú lateral muestran un ícono de candado para distinguir acciones que requieren permisos especiales
- **Diseño responsivo**: interfaz adaptativa optimizada para móvil y escritorio con prevención de solapamiento de texto/iconos en pantallas pequeñas (320px+). Navegación compacta en landing, textos truncados en tarjetas, badges y encabezados
- **Animación de fondo estelar warp-speed**: múltiples capas parallax de ~210 estrellas con colores variados (azules, dorados, rosas, verdes), movimiento caótico multi-waypoint, rotaciones sutiles y brillo dinámico. Incluye **capas fractales Fibonacci** con distribución en espiral áurea, profundidad escalada y drift variable. Efecto *warp-pulse* que simula viaje a la velocidad de la luz. Punto focal con animaciones `focal-wander` y `warp-pulse`. Compatible con `prefers-reduced-motion` y **optimizada para móvil** (ver [Optimización de rendimiento móvil](#optimización-de-rendimiento-móvil))
- **Notificaciones y mensajería**: sistema de notificaciones internas con bandeja de entrada, mensajes directos y composición con destinatario pre-seleccionado desde el perfil de otro miembro. El sistema genera automáticamente:
  - `deadline_reminder`: aviso a los responsables cuando una tarea tiene plazo dentro de los próximos 3 días o ya vencido (con deduplicación para no spam)
  - `deliverable_uploaded`: aviso al creador y demás responsables cuando alguien sube un archivo a un entregable
- **Registro de actividad (Activity Log)**: cada acción relevante (crear tarea, cambiar estado, registrar avance, subir entregable) queda registrada en la colección `activity_log` de Firestore con metadatos estructurados
- **Métricas de miembros y leaderboard**: el Dashboard muestra un ranking de miembros basado en puntos acumulados por tareas completadas (`scoreAwarded`). La página de Miembros muestra conteo de tareas completadas, pendientes y última actividad registrada por cada integrante
- **Perfiles clickeables**: en el directorio de miembros, hacer clic en un usuario navega a su perfil donde se puede ver su información y enviar un mensaje directo
- **Auto-extracción de nombre desde email**: al registrarse con correo institucional, el sistema extrae automáticamente nombre y apellido. Usuarios registrados antes de esta funcionalidad recuperan su nombre al iniciar sesión
- **Rutas protegidas** que redirigen a login cuando el usuario no está autenticado
- **Redirección automática**: usuarios autenticados son redirigidos al dashboard si visitan login/registro
- **Error Boundary** global que captura errores de React y muestra una pantalla de recuperación
- **Logger de producción** para captura de errores y diagnóstico

## Roles y permisos

El sistema define **roles** (permisos de administración) y **equipos** (área de trabajo) de forma independiente. Cada usuario tiene **un único rol** y puede pertenecer a **hasta 2 equipos** simultáneamente.

## Optimizaciones UI/UX

La plataforma implementa un conjunto de mejores prácticas modernas de UI/UX:

### Accesibilidad (WCAG 2.2)

- **Skip-to-content**: enlace oculto que aparece al enfocar con teclado, permitiendo saltar al contenido principal
- **Landmarks ARIA**: `role="banner"`, `role="navigation"`, `role="main"`, `role="contentinfo"` en la landing; `aria-label`, `aria-expanded`, `aria-current="page"` en la navegación del sidebar
- **Touch targets mínimos de 44px**: botones (`h-11`), inputs (`h-11`) y controles interactivos siguen las directrices WCAG 2.2
- **Focus visible mejorado**: anillo de foco de 2px con offset para todos los elementos interactivos, compatible con teclado
- **Formularios accesibles**: todos los inputs llevan `id`, `htmlFor` en sus labels, `autoComplete` semántico (`email`, `new-password`, `given-name`, etc.) y `aria-describedby` para mensajes de error
- **Roles semánticos en alertas**: mensajes de error con `role="alert"`, mensajes de éxito con `role="status"`, regiones dinámicas con `aria-live="polite"`
- **Tabs accesibles**: pestañas con `role="tablist"`, `role="tab"`, `aria-selected` y `aria-controls` en el buzón de notificaciones
- **Imágenes**: `alt` descriptivo, `aria-hidden="true"` en imágenes decorativas, `loading="lazy"` para carga diferida y `fetchPriority="high"` para el logo principal

### Rendimiento percibido

- **Skeleton loading**: estados de carga con shimmer animation en las tarjetas de estadísticas del dashboard, reemplazando texto estático `'…'`
- **Animaciones de entrada**: `animate-fade-in`, `animate-fade-in-up`, `animate-slide-in-right` con delays escalonados para una carga progresiva
- **View Transitions API**: soporte nativo para transiciones entre vistas con `@view-transition` y pseudo-elementos `::view-transition-old` / `::view-transition-new`
- **Lazy loading de imágenes**: `loading="lazy"` en avatares del directorio de miembros y perfiles

### Diseño moderno

- **Glass-morphism**: tarjetas con fondos semi-transparentes para efecto de transparencia. En escritorio se utiliza `backdrop-blur-sm`; eliminado en móvil para rendimiento
- **Micro-interacciones**: `active:scale-[0.97]` en botones, `hover:shadow-lg` con sombras coloreadas, escalado de iconos al hover (`group-hover:scale-110`), indicador activo en la navegación
- **Badges pill**: forma `rounded-full` para badges, con transiciones suaves
- **Tarjetas interactivas**: hover con border highlight (`hover:border-cyan-500/30`), sombra expandida y transiciones `duration-200`
- **Formularios mejorados**: estilos de autofill para tema oscuro, iconos decorativos con `pointer-events-none`, errores animados con `animate-fade-in`

### Tipografía y legibilidad

- **`text-wrap: balance`** en headings para distribución uniforme de líneas
- **`text-wrap: pretty`** en texto de cuerpo para evitar viudas/huérfanas
- **`::selection`** con colores del tema (cyan sobre fondo oscuro)
- **Suavizado de fuentes**: `-webkit-font-smoothing: antialiased` y `text-rendering: optimizeLegibility`

### Optimización de rendimiento móvil

La plataforma incluye optimizaciones específicas para dispositivos móviles y tablets (≤1024px):

- **Reducción de capas animadas**: de 12+ capas CSS simultáneas a 3 en móvil, eliminando capas fractales Fibonacci, `depth-breathe` y `focal-glow`
- **Eliminación de `backdrop-blur`**: retirado de componentes Card, Layout (sidebar, overlay), Landing, Login, Register y ForgotPassword para reducir carga GPU en scroll
- **GPU compositing hints**: `will-change: transform`, `backface-visibility: hidden` y `contain: strict` en capas animadas para promover composición GPU
- **CSS containment**: `contain: content` en el contenedor principal de contenido para aislar repaints durante scroll
- **Scroll nativo**: `scroll-behavior: smooth` deshabilitado en móvil para no interferir con la inercia nativa de Android/iOS
- **Transiciones simplificadas**: `transition-all` reemplazado por `transition-colors` en componentes Card para reducir cálculos durante interacciones

Estas optimizaciones fueron validadas para Samsung Galaxy S21 FE y dispositivos similares de gama media.

### Compatibilidad

- **`prefers-reduced-motion`**: las animaciones de fondo estelar respetan esta preferencia
- **Firefox**: soporte de scrollbar personalizado con `scrollbar-width: thin`
- **Autofill**: estilos personalizados para `:-webkit-autofill` en tema oscuro

| Rol | Descripción | Permisos clave |
|-----|-------------|----------------|
| **Maestro** | Dueño del sistema | Administración total, asignar cualquier rol (incluido admin), gestionar tareas y proyectos |
| **Admin** | Administrador | Gestionar contenido, proyectos, tareas y asignar roles (excepto admin y maestro) |

Los usuarios sin rol asignado pueden ver contenido pero no realizar acciones de gestión.

### Rol único

El rol se almacena como un campo simple (`rol: UserRole`) en Firestore. El sistema mantiene compatibilidad con el campo legacy `roles` (array) leyendo el primer elemento si `rol` no existe. Las funciones auxiliares `hasRole()` y `hasAnyRole()` verifican el rol único del usuario.

La asignación de rol se realiza desde la sección "Miembros" mediante un dropdown (solo maestro).

### Multi-equipo

Los equipos se almacenan como un arreglo (`equipos: TeamType[]`) en Firestore, con un máximo de 2 equipos por usuario. El sistema mantiene compatibilidad con el campo legacy `equipo` (string) mediante la función `sanitizeUserTeams()`. Las funciones auxiliares `hasTeam()` y `hasAnyTeam()` permiten verificar pertenencia a equipos.

La asignación de equipos se realiza desde la sección "Miembros" mediante checkboxes (maestro y admin) o desde el perfil del usuario.

### Administrador del sistema

El usuario **maestro** actual es el primer usuario registrado en la plataforma. **Solo el maestro** puede asignar el rol de administrador a otros usuarios. Los usuarios **admin** pueden gestionar miembros y roles (excepto admin y maestro) desde la sección "Miembros" del menú lateral.

### Visibilidad de roles

En el directorio de miembros, solo los badges de **admin** y **maestro** son visibles públicamente. El equipo al que pertenece cada miembro siempre se muestra.

### Indicadores de permisos

Las opciones del menú lateral que requieren permisos especiales (como "Gestión de Tareas") muestran un ícono de candado (🔒) para indicar que son acciones restringidas a ciertos roles o equipos.

> **Nota:** Solo correos institucionales de la USM (`@usm.cl` o `@sansano.usm.cl`) son aceptados para registro.

## Equipos

Los usuarios pueden seleccionar los equipos a los que desean pertenecer desde su perfil (máximo 2 equipos simultáneamente). La asignación de equipo es independiente del rol. Los equipos disponibles son:

| Equipo | Descripción |
|--------|-------------|
| **Equipo Técnico** | Desarrollo de software, hardware, estructura, simulación y cálculos |
| **Manager** | Coordinación de proyectos y equipos |
| **Relaciones Públicas** | Redes sociales, difusión y contactos universitarios |

## Requisitos previos

- [Node.js](https://nodejs.org/) ≥ 22 (LTS recomendado)
- [npm](https://www.npmjs.com/) ≥ 10
- [Bun](https://bun.sh/) ≥ 1.3 si quieres reproducir localmente el mismo runtime que usa GitHub Actions
- Una cuenta y proyecto en [Firebase](https://console.firebase.google.com/)

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/theChosen16/UTFSM_Cubesat_team.git
cd UTFSM_Cubesat_team

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno (ver sección siguiente)
cp .env.example .env.local

# 4. Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

## Variables de entorno

Copia `.env.example` a `.env.local` y completa los valores con los datos de tu proyecto Firebase:

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Opcional: habilita el asistente de IA del equipo
VITE_GOOGLE_AI_KEY=your-google-ai-key

# Opcional pero requerido para subir archivos (Google Drive bridge)
# Ver apps-script/README.md
VITE_DRIVE_UPLOAD_URL=https://script.google.com/macros/s/AKfyc.../exec
VITE_DRIVE_UPLOAD_SECRET=long-random-shared-secret
```

> ⚠️ **Nunca** subas `.env.local` al repositorio. Está excluido en `.gitignore`.

`VITE_FIREBASE_MEASUREMENT_ID` es opcional y se usa para Analytics. `VITE_GOOGLE_AI_KEY` es opcional; si no está definida, el chatbot quedará deshabilitado sin romper el resto de la aplicación. `VITE_DRIVE_UPLOAD_*` son requeridas para habilitar el repertorio de archivos; si no están definidas, la subida queda deshabilitada y la UI muestra un banner explicativo.

## Almacenamiento de archivos (Google Drive bridge)

En lugar de Firebase Storage (que requiere plan pago para uso productivo), la plataforma utiliza un **Apps Script Web App** desplegado por el dueño del Drive como puente gratuito hacia un folder compartido.

**Cómo funciona:**

1. El dueño despliega `apps-script/Code.gs` como Web App de Google Apps Script (corre con sus permisos de Drive)
2. La web envía `POST` con el archivo en base64 + metadatos (`taskId`, `projectId`, `deliverableId`, `userEmail`)
3. El script valida el secret compartido y que el correo sea institucional (`@usm.cl` o `@sansano.usm.cl`)
4. Sube el archivo a una subcarpeta del folder raíz (`tasks/{id}/`, `projects/{id}/` o `general/`) y le pone permiso "anyone with link can view"
5. Firestore almacena los metadatos (Drive file ID, nombre, mime, tamaño, autor, asociaciones) para queries y permisos
6. La web abre el archivo vía `https://drive.google.com/file/d/{ID}/view` — los miembros NO necesitan acceso al folder

**Setup completo:** ver [`apps-script/README.md`](./apps-script/README.md).

**Límites del plan gratuito:**

- 35 MB por archivo (límite de request HTTP de Apps Script)
- 15 GB acumulados por cuenta de Drive
- 6 horas/día de ejecución acumulada de Apps Script

**Variables de entorno requeridas:**

```env
VITE_DRIVE_UPLOAD_URL=https://script.google.com/macros/s/AKfyc.../exec
VITE_DRIVE_UPLOAD_SECRET=long-random-shared-secret
```

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia el servidor de desarrollo con HMR |
| `npm run build` | Compila TypeScript y genera el build de producción |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run lint` | Ejecuta ESLint sobre todo el proyecto |
| `npm test` | Ejecuta los tests unitarios con Vitest (modo CI) |
| `npm run test:watch` | Ejecuta los tests en modo observador |
| `npm run emulators` | Inicia los emuladores de Firebase (Auth + Firestore) |
| `npm run test:e2e` | Ejecuta los tests E2E con emuladores de Firebase |

## Tests E2E con Firebase Emulators

El proyecto incluye tests de integración (E2E) que se ejecutan contra emuladores locales de Firebase, sin afectar la base de datos de producción.

### Configuración

Los emuladores están configurados en `firebase.json`:

| Servicio | Puerto |
|----------|--------|
| Auth | 9099 |
| Firestore | 8080 |
| Emulator UI | 4000 |

### Ejecución

```bash
# Ejecutar E2E tests (inicia emuladores automáticamente)
npm run test:e2e

# O iniciar emuladores manualmente para desarrollo
npm run emulators
```

Los tests E2E cubren: autenticación (registro, roles, sign in/out), proyectos, tareas (incluyendo hitos, entregables y avances), notificaciones, miembros y perfiles. Total: **~36 tests** en 6 archivos.

## Despliegue

El proyecto se despliega automáticamente en **GitHub Pages** mediante GitHub Actions:

1. Cada push o pull request a `main` ejecuta el pipeline de CI (lint + tests + build).
2. Si el CI pasa en `main`, el workflow de despliegue publica la aplicación en GitHub Pages. Si el workflow `CI` falla, `Deploy to GitHub Pages` queda automáticamente **skipped**.
3. Tras el despliegue, un smoke test verifica que la página es accesible (HTTP 200).

La URL pública es: `https://thechosen16.github.io/UTFSM_Cubesat_team/`

Para que el deploy publique la versión productiva correctamente, configura estos **GitHub Secrets** en el repositorio o entorno de Pages:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (opcional)
- `VITE_GOOGLE_AI_KEY` (opcional)
- `VITE_DRIVE_UPLOAD_URL` (requerida para habilitar el repertorio de archivos)
- `VITE_DRIVE_UPLOAD_SECRET` (requerida para habilitar el repertorio de archivos)

## CI/CD

El pipeline de CI/CD utiliza GitHub Actions sobre `ubuntu-latest` y ejecuta la instalación y los scripts con **Bun 1.x**:

- **CI** (`.github/workflows/ci.yml`): job `quality` con `bun install --frozen-lockfile` → `bun run lint` → `bun run test` → `bun run build` en cada PR y push a `main`
- **Deploy** (`.github/workflows/deploy.yml`): job `build` para generar el artefacto de Pages, job `deploy` para publicar y job `smoke-test` para comprobar la URL pública tras el despliegue
- **workflow_dispatch** está habilitado en ambos workflows para ejecutar validaciones o despliegues manuales

### Flujo de trabajo

```
PR / Push a main  →  CI (lint + test + build)  →  Deploy a GitHub Pages  →  Smoke Test
```

### Validación local recomendada

Para reproducir localmente el job `quality` de CI con el mismo runtime que Actions:

```bash
bun run lint
bun run test
bun run build
```

Si prefieres `npm`, los scripts del proyecto siguen siendo compatibles mediante `npm run lint`, `npm test` y `npm run build`.

## Logging y diagnóstico

La plataforma incluye un sistema de logging estructurado (`src/lib/logger.ts`) que:

- Captura errores de aplicación con contexto (timestamp, nivel, mensaje, metadata)
- Intercepta errores globales (`window.onerror`) y promesas rechazadas (`unhandledrejection`)
- Incluye un Error Boundary de React que captura y registra errores de componentes
- Mantiene un buffer en memoria de hasta 200 entradas para diagnóstico

Para acceder a los logs en la consola del navegador:

```js
// Ver todos los logs
window.__cubesat_logger.getEntries()

// Ver solo errores
window.__cubesat_logger.getErrors()

// Exportar logs como JSON
window.__cubesat_logger.exportJSON()
```

## Estructura del proyecto

```
src/
├── components/
│   ├── layout/         # Layout principal con sidebar (incluye ruta /files)
│   ├── ui/             # Componentes reutilizables (Button, Card, Badge, Spinner, etc.)
│   ├── ErrorBoundary.tsx
│   └── ProtectedRoute.tsx
├── contexts/           # AuthContext (autenticación y gestión de usuarios)
├── lib/
│   ├── constants.ts    # Constantes centralizadas (colecciones Firestore: tasks, files, activity_log, member_scores)
│   ├── firebase.ts     # Configuración Firebase (auth, db, storage)
│   ├── logger.ts       # Sistema de logging estructurado
│   ├── memberMetrics.ts # Cálculo de rendimiento y ranking de miembros
│   ├── schemas.ts      # Esquemas Zod (incluye milestoneSchema, deliverableSchema)
│   ├── ui-constants.ts # Labels UI (incluye tipos de notificación deadline_reminder, deliverable_uploaded)
│   └── utils.ts        # Utilidades compartidas
├── pages/              # Páginas lazy-loaded (con tests unitarios adyacentes)
│   └── FileRepository.tsx  # Repertorio central de archivos
├── sdk/
│   ├── ActivityLogService.ts  # Registro de actividad en Firestore
│   ├── FileService.ts         # Subida/descarga/eliminación en Firebase Storage
│   ├── NotificationService.ts # Notificaciones (incluye deadline_reminder, deliverable_uploaded)
│   ├── TaskService.ts         # Tareas con hitos, entregables, avances y score
│   └── ...                    # Otros servicios (UserService, ProjectService, BotService)
├── test/               # Setup de tests y mocks de Firebase
├── types/              # Tipos TypeScript (Task, TaskMilestone, TaskDeliverable, ActivityLogEntry, FileRecord…)
└── docs/               # Documentación adicional (historia del equipo)
```

### Reglas de seguridad

El proyecto usa **únicamente** reglas de Firestore (los archivos viven en Drive vía Apps Script, no en Firebase Storage):

- **`firestore.rules`**: autenticación requerida para todas las colecciones. Los miembros asignados a una tarea pueden actualizar campos específicos (`estado`, `progressUpdates`, `deliverables`, `attachmentIds`, etc.) sin necesidad de ser manager. La colección `activity_log` solo permite create al propio usuario (`userId == request.auth.uid`). La colección `files` permite delete al propio autor o a un manager.
- **`apps-script/Code.gs`**: capa de seguridad de Drive. Valida secret compartido + correo institucional (`@usm.cl`/`@sansano.usm.cl`) antes de subir o eliminar archivos. Cada archivo subido se marca como "anyone with link can view" para que los miembros puedan abrirlo sin acceso al folder padre.

## Contribuir

¡Las contribuciones externas son bienvenidas! Puedes colaborar de varias formas: reportando bugs, sugiriendo funcionalidades, dejando feedback o enviando código.

### Feedback y sugerencias

Si tienes una idea, encontraste un bug o quieres proponer un cambio, abre un **Issue** en GitHub:

1. Ve a la pestaña [**Issues**](https://github.com/theChosen16/UTFSM_Cubesat_team/issues) del repositorio.
2. Haz clic en **New issue**.
3. Selecciona un título descriptivo y explica tu propuesta o problema con el mayor detalle posible (capturas de pantalla, pasos para reproducir, comportamiento esperado, etc.).
4. Etiqueta el issue si corresponde (por ejemplo: `bug`, `enhancement`, `question`).

> **Tip:** Antes de abrir un issue, revisa los existentes para evitar duplicados.

### Contribuir con código

Para proponer cambios en el código fuente, sigue este flujo:

```bash
# 1. Haz fork del repositorio desde GitHub (botón "Fork")

# 2. Clona tu fork localmente
git clone https://github.com/<tu-usuario>/UTFSM_Cubesat_team.git
cd UTFSM_Cubesat_team

# 3. Instala las dependencias
npm install

# 4. Crea una rama descriptiva para tu cambio
git checkout -b feature/mi-funcionalidad

# 5. Realiza tus cambios y añade tests si aplica

# 6. Verifica que lint y tests pasan localmente
npm run lint
npm test

# 7. Haz commit de tus cambios con un mensaje claro
git commit -m "feat: descripción breve del cambio"

# 8. Sube tu rama al fork
git push origin feature/mi-funcionalidad
```

Luego, abre un **Pull Request** desde tu fork hacia la rama `main` del repositorio original en GitHub.

### Proceso CI/CD y aprobación

Todo Pull Request debe cumplir **dos requisitos** antes de ser fusionado:

1. **Pasar el pipeline de CI** — Al abrir o actualizar un PR, GitHub Actions ejecuta automáticamente:
   - ✅ **Lint** (`npm run lint`) — verificación de estilo y calidad de código
   - ✅ **Tests** (`npm test`) — tests unitarios con Vitest
   - ✅ **Build** (`npm run build`) — compilación TypeScript + build de producción

  Si alguno de estos pasos falla, el PR no podrá ser fusionado. Asegúrate de ejecutar `bun run lint && bun run test && bun run build` o sus equivalentes con `npm` antes de abrir el PR.

2. **Aprobación del mantenedor** — Una vez que el CI pasa exitosamente, el usuario **maestro** (administrador del proyecto) revisará el PR y decidirá si aprueba el merge. Los PR no se fusionan automáticamente; siempre requieren aprobación manual.

### Reportar vulnerabilidades

**No abras issues públicos** para reportar vulnerabilidades de seguridad. Consulta [SECURITY.md](./SECURITY.md) para conocer cómo reportar vulnerabilidades de forma responsable y privada.

## Seguridad

Consulta [SECURITY.md](./SECURITY.md) para conocer la política de seguridad del proyecto y cómo reportar vulnerabilidades de forma responsable.
