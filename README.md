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
- **Asistente IA Inteligente con Function Calling (`Cubesat Bot`)**: Un bot de inteligencia artificial integrado usando el SDK oficial `@google/generative-ai`. Resuelve consultas aeroespaciales específicas y, para administradores autorizados (`admin`, `maestro`, `manager`), incorpora un mecanismo seguro de **Function Calling** recursivo (de hasta 3 niveles) para crear tareas, agendar reuniones, generar métricas e iniciar sincronizaciones en tiempo real mediante comandos directos de lenguaje natural, con interfaz de sugerencias tácticas (*suggestion chips*) y saludo adaptado.

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

> **Nota de seguridad:** el registro ya **no** otorga automáticamente el rol de maestro al primer usuario. Ese mecanismo (un "bootstrap lock" que el propio cliente creaba) permitía que, en cualquier despliegue donde ese documento faltara, la siguiente persona en registrarse se convirtiera en maestro del espacio de trabajo. En un despliegue nuevo, el primer maestro se asigna una sola vez desde la consola de Firebase; ver [SECURITY.md → Provisioning the first maestro](SECURITY.md#provisioning-the-first-maestro).

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

## Asistente de IA (Cubesat Bot) y Function Calling 🤖🛰️

El **Cubesat Bot** es el centro de asistencia de inteligencia artificial del UTFSM CubeSat Team. Integrado directamente en la interfaz del portal web mediante el SDK oficial `@google/generative-ai` y motorizado de forma inteligente por la familia de modelos de última generación `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-2.5-flash` y `gemini-flash-latest` (con soporte para conmutación automática por fallo).

### 1. Reglas y Comportamiento Aeroespacial Estricto
El bot está configurado con instrucciones de sistema rigurosas que garantizan el foco de la misión:
1. **Foco Espacial Obligatorio**: Responde únicamente consultas relacionadas con ciencia espacial, ingeniería de nanosatélites, diseño de componentes orbitales (radiación, redundancia, estrés mecánico, consumo energético, órbitas, comunicaciones) y gestión interna del equipo. Niega amablemente cualquier otra respuesta no atingente.
2. **Filosofía de Sencillez**: Evalúa opciones con perspectiva crítica e ingenieril, priorizando siempre los sistemas sencillos y robustos por sobre el sobre-diseño.
3. **Contexto Vivo**: En cada inicialización de chat, el servicio recopila el estado actual de los proyectos y tareas directamente desde Firestore, permitiendo que el bot conozca y referencie metas pendientes reales del equipo.

### 2. Capacidad Ejecutiva (Function Calling)
Para los usuarios autenticados con privilegios de gestión (roles `admin`, `maestro` o pertenecientes al equipo `manager`), el bot activa sus **capacidades ejecutivas** (*Gemini Function Calling*), permitiéndoles operar el portal web mediante comandos conversacionales fluidos.

#### Herramientas Mapeadas Activas (Tools)
* `crearTarea(titulo, prioridad, equipo, descripcion, fechaLimite, projectId, generarHitosAeroespaciales)`: Crea y delega una tarea en el sistema Firestore asignando puntaje de importancia respectivo. Si `generarHitosAeroespaciales` es verdadero, autogenera micro-hitos técnicos aeroespaciales en Firestore basados en el tipo de tarea (firmware/software, termodinámica, estructura, etc.).
* `crearEvento(titulo, tipo, fechaInicio, descripcion, fechaFin, todoElDia)`: Registra y agenda reuniones, visitas o plazos límite de entrega en el Calendario oficial.
* `sincronizarProyecto()`: Actualiza y sincroniza los activos del equipo, guardando el evento en la bitácora (`ActivityLogService`).
* `obtenerMetricas()`: Genera un reporte analítico del progreso en tiempo real de todos los proyectos y tareas del equipo.
* `registrarCumpleanos(miembroId, fecha)`: Registra o actualiza de manera conversacional la fecha de cumpleaños de un integrante del equipo en Firestore (útil para felicitaciones automatizadas).
* `gestionarCubeDesign(accion, miembroId)`: Permite confirmar/desconfirmar la nómina técnica oficial, auditar el avance técnico frente a los plazos, o sembrar los 4 hitos preparatorios críticos en el calendario para el evento de competencia de CubeDesign 2026.
* `auditarActaDrive(fechaActa, acuerdosResumen)`: Procesa un acta o minuta de reunión de Google Drive de manera masiva, parseando acuerdos para poblar automáticamente Firestore con tareas e hitos clasificados según subsistema y prioridad.
* `obtenerEstadoNoticiario()`: Obtiene el estado de despacho y log del último envío del noticiario o boletín semanal del equipo Cubesat.
* `forzarEnvioNoticiario()`: Despacha de manera inmediata el noticiario o boletín semanal "Boletín de la Órbita" a todos los miembros activos por correo electrónico.

#### Bucle de Resolución Recursivo (Deep Execution Loop)
El servicio `BotService` implementa un interceptor dinámico que:
1. Lee la respuesta del modelo Gemini. Si contiene un objeto `functionCall`, detiene la conversación.
2. Extrae los argumentos e invoca el método correspondiente del servicio seguro [AdminActionsService.ts](file:///c:/Users/alean/Desktop/Cubesat%20team%20page/src/sdk/AdminActionsService.ts).
3. Obtiene el resultado de base de datos y lo re-inyecta recursivamente (hasta 3 niveles encadenados) de vuelta al chat en curso en la parte de respuesta (`functionResponse`).
4. Deja que Gemini redacte una confirmación contextualizada e ingenieril al usuario.

### 3. Seguridad y Control de Privilegios
Para salvaguardar la base de datos de accesos fraudulentos o inyecciones de prompts:
* **Filtro de Inyección de SDK**: Las herramientas (*tools*) y el System Prompt ejecutivo **jamás** se le envían al SDK de Gemini si el usuario autenticado no posee permisos demostrables de gestión. El bot actúa en modo pasivo puramente conversacional para miembros estándar.
* **Verificación de Rol en Caliente**: En el momento en que se intercepta una llamada a función en el cliente, `BotService` ejecuta una validación local síncrona en caliente del rol activo antes de invocar a `AdminActionsService`, asegurando máxima robustez frente a ataques que intenten simular llamadas de sistema.

### 4. Interfaz UI/UX de Gestión Rápida
* **Saludo Dinámico**: El chatbot reconoce la firma del administrador y cambia su mensaje inicial a un saludo ejecutivo detallando sus herramientas activas.
* **Suggestion Chips**: Muestra una barra superior sobre el input con accesos rápidos interactivos (`📊 Ver Métricas`, `🛠️ Crear Tarea`, `📅 Agendar Reunión`, `🔄 Sincronizar Base`) para guiar al usuario e ilustrar el potencial ejecutivo del bot de manera visual.

### 5. Lectura Multi-modal y de Documentos 📄🖼️
Los usuarios con permisos de gestión (`admin`, `manager`, `maestro`) pueden adjuntar imágenes y documentos de diversos formatos en el Cubesat Bot y solicitarle análisis, resúmenes, auditorías u otras acciones.
* **Procesamiento de Archivos**:
  * **Visual y Multi-modal Nativo**: Las imágenes (PNG, JPEG, WEBP) y documentos PDF se codifican a Base64 y se envían de forma nativa al modelo de Gemini usando `inlineData`, permitiendo que el bot use visión computacional de alta fidelidad.
  * **Compresión y Parsing de Oficina**: Los archivos de Microsoft Word (`.docx`) y PowerPoint (`.pptx`) son parseados en caliente en el navegador mediante `jszip`. El sistema extrae dinámicamente el texto de párrafos y diapositivas y los inyecta de forma estructurada como contexto del prompt, ahorrando procesamiento del servidor.
  * **Formatos de Texto Plano**: Archivos `.txt`, `.csv`, `.json` y `.md` son leídos en texto plano e incorporados directamente en el cuerpo del mensaje.
* **UI/UX Segura y Envolvente**:
  * Solo los roles autorizados ven el botón de clip (📎) de adjuntar archivos en el chat.
  * Cuenta con previsualizaciones flotantes de tipo glassmorphic con barra de carga, peso del archivo y alertas de error.
  * Los mensajes enviados en el chat que contienen archivos adjuntos muestran un badge estilizado con el nombre e ícono correspondiente en su burbuja de chat.

### 6. Ideas de Expansión
Para optimizar el orden, la coordinación interna del equipo y potenciar el portal, se ha mapeado la siguiente extensión estratégica para incorporar a futuro:
* **Asignación Predictiva y Balanceo de Carga ⚖️**: Auditoría en tiempo real de tareas activas por subsistema técnico para sugerir asignaciones equilibradas al crear nuevas tareas.

---

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

El proyecto se publica de manera estática y gratuita en **GitHub Pages**. Dado que la facturación de GitHub (Actions Billing) en repositorios privados puede restringir la ejecución de workflows automáticos en la nube, el despliegue se realiza **manualmente desde el entorno local**, compilando la aplicación en la carpeta `/docs` directamente en la rama principal (`main`).

Para desplegar y actualizar el sitio web productivo:

1. Asegúrate de tener configurado tu archivo `.env.local` con las variables de Firebase.
2. Ejecuta el script de despliegue automatizado:
   ```bash
   npm run deploy
   ```
   Este comando compilará síncronamente el proyecto en modo de producción (`npm run build`), añadirá los cambios generados en `/docs`, confirmará el commit en Git y los subirá de forma segura a la rama remota `main`.
3. Tu sitio se actualizará automáticamente y sin costo alguno en la URL pública: `https://thechosen16.github.io/UTFSM_Cubesat_team/`

---

## Zero-Trust y Gestión de Secretos

Para evitar la fuga de credenciales críticas en este repositorio público y eliminar la necesidad de configurar variables de entorno en sistemas externos, el portal implementa un modelo de **Zero-Trust**:

1. **Sin Secretos en el Cliente**:
   * **Gemini API Key**: Se almacena exclusivamente en las propiedades de entorno privadas de tu Google Apps Script (`Script Properties`), actuando como un Backend Proxy seguro (`handleChat`). La web del cliente nunca carga ni expone la API Key.
   * **Drive Bridge Secrets**: La URL y el token secreto de subida se recuperan dinámicamente en caliente desde Firestore (`/system_config/keys`) una vez que el usuario institucional (`@usm.cl` o `@sansano.usm.cl`) inicia sesión.
2. **Siembra de Credenciales**:
   Para registrar o actualizar tus credenciales del Drive Bridge en producción, abre la Consola de Desarrollador del navegador en el portal autenticado con tu cuenta de Administrador o Maestro, y ejecuta el siguiente script:
   ```javascript
   const db = window.firebaseDb;
   const { doc, setDoc } = window.firebaseFirestore;

   await setDoc(doc(db, 'system_config', 'keys'), {
     driveUploadUrl: "TU_GOOGLE_APPS_SCRIPT_EXEC_URL",
     driveUploadSecret: "TU_SHARED_SECRET"
   });
   console.log("¡Credenciales del Drive Bridge guardadas exitosamente!");
   ```
3. **Reglas de Seguridad de Firebase**:
   Para proteger el acceso a estos secretos y auditar el noticiario masivo, el archivo [firestore.rules](file:///c:/Users/alean/Desktop/Cubesat%20team%20page/firestore.rules) restringe los accesos. Puesto que tienes instalado `firebase-tools` localmente, puedes desplegar cualquier cambio en las reglas de forma instantánea ejecutando:
   ```bash
   firebase deploy --only firestore:rules
   ```
   *(También puedes administrarlas copiando el contenido de `firestore.rules` y pegándolo en la sección de Reglas del Firebase Console)*

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
