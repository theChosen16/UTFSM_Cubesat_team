# USM CubeSat Team 🛰️

Sitio web oficial del equipo de nano satélites de la **Universidad Técnica Federico Santa María (UTFSM)**. La aplicación permite gestionar miembros, proyectos y recursos del equipo en una plataforma centralizada con autenticación segura.

## Tabla de contenidos

- [Tecnologías](#tecnologías)
- [Funcionalidades](#funcionalidades)
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
- [Seguridad](#seguridad)

## Tecnologías

| Categoría | Herramienta |
|-----------|-------------|
| Framework UI | [React 18](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/) |
| Build tool | [Vite](https://vitejs.dev/) |
| Estilos | [Tailwind CSS](https://tailwindcss.com/) |
| Backend / Auth | [Firebase](https://firebase.google.com/) (Authentication + Firestore) |
| Routing | [React Router v6](https://reactrouter.com/) |
| Iconos | [Lucide React](https://lucide.dev/) |
| Testing | [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) + Firebase Emulators (E2E) |
| CI/CD | GitHub Actions + GitHub Pages |

## Funcionalidades

- **Landing page** pública con información del equipo
- **Autenticación**: registro, inicio de sesión y recuperación de contraseña vía Firebase Auth
- **Dashboard** privado con estadísticas en tiempo real desde Firestore (proyectos activos, tareas pendientes, completadas y miembros)
  - Saludo personalizado según género del usuario (Bienvenido/Bienvenida)
  - Estructura del equipo muestra distribución de miembros por equipo (`equipo`), no por rol
- **Proyectos**: listado y creación de proyectos del equipo con formulario integrado (nombre, descripción, equipo, prioridad, fecha límite). Datos almacenados en Firestore con feedback de errores al usuario
- **Gestión de Tareas**: dashboard para maestro, admin y manager que permite crear tareas asignando proyecto, equipo encargado, prioridad y responsable(s). Mensajes de error visibles al usuario en caso de fallo
- **Selección de equipos**: cada usuario puede pertenecer a hasta 2 equipos simultáneamente, seleccionables desde su perfil mediante checkboxes
- **Miembros**: directorio de integrantes mostrando equipos asignados (máximo 2) y rol. Solo se muestran badges de rol para admin y maestro. Gestión de rol mediante dropdown, accesible para maestro. Asignación de equipos mediante checkboxes, accesible para maestro y admin. Manejo de errores en imágenes de avatar con fallback automático
- **Perfil**: vista y edición de datos personales, selección de equipos (máx. 2), género y cuestionario de cualidades
  - **Foto de perfil**: los usuarios pueden subir una foto de perfil (máx. 500 KB) que se muestra en el sidebar, perfil y directorio de miembros
  - **Selección de género**: permite al usuario indicar su género para personalizar el saludo en el dashboard
- **Indicadores de permisos**: las opciones restringidas del menú lateral muestran un ícono de candado para distinguir acciones que requieren permisos especiales
- **Diseño responsivo**: interfaz adaptativa optimizada para móvil y escritorio con prevención de solapamiento de texto/iconos en pantallas pequeñas (320px+). Navegación compacta en landing, textos truncados en tarjetas, badges y encabezados
- **Animación de fondo estelar warp-speed**: tres capas parallax de 94 estrellas con colores variados (azules, dorados, rosas, verdes), movimiento caótico multi-waypoint, rotaciones sutiles y brillo dinámico. Incluye efecto *warp-pulse* que simula viaje a la velocidad de la luz con pulsos rápidos de `brightness` y `blur`. Punto focal con animación `focal-wander` acelerada (12 s) y `warp-pulse` (4 s). Compatible con `prefers-reduced-motion` y optimizada para móvil
- **Notificaciones y mensajería**: sistema de notificaciones internas con bandeja de entrada, mensajes directos y composición con destinatario pre-seleccionado desde el perfil de otro miembro
- **Perfiles clickeables**: en el directorio de miembros, hacer clic en un usuario navega a su perfil donde se puede ver su información y enviar un mensaje directo
- **Auto-extracción de nombre desde email**: al registrarse con correo institucional, el sistema extrae automáticamente nombre y apellido. Usuarios registrados antes de esta funcionalidad recuperan su nombre al iniciar sesión
- **Rutas protegidas** que redirigen a login cuando el usuario no está autenticado
- **Redirección automática**: usuarios autenticados son redirigidos al dashboard si visitan login/registro
- **Error Boundary** global que captura errores de React y muestra una pantalla de recuperación
- **Logger de producción** para captura de errores y diagnóstico

## Roles y permisos

El sistema define **roles** (permisos de administración) y **equipos** (área de trabajo) de forma independiente. Cada usuario tiene **un único rol** y puede pertenecer a **hasta 2 equipos** simultáneamente.

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

- [Node.js](https://nodejs.org/) ≥ 20 (LTS recomendado)
- [npm](https://www.npmjs.com/) ≥ 10
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
```

> ⚠️ **Nunca** subas `.env.local` al repositorio. Está excluido en `.gitignore`.

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

Los tests E2E cubren: autenticación (registro, roles, sign in/out), proyectos, tareas, notificaciones, miembros y perfiles. Total: **33 tests** en 6 archivos.

## Despliegue

El proyecto se despliega automáticamente en **GitHub Pages** mediante GitHub Actions:

1. Cada push o pull request a `main` ejecuta el pipeline de CI (lint + tests + build).
2. Si el CI pasa, el workflow de despliegue publica la aplicación en GitHub Pages.
3. Tras el despliegue, un smoke test verifica que la página es accesible (HTTP 200).

La URL pública es: `https://thechosen16.github.io/UTFSM_Cubesat_team/`

## CI/CD

El pipeline de CI/CD incluye:

- **CI** (`.github/workflows/ci.yml`): Lint → Tests → Build en cada PR y push a main
- **Deploy** (`.github/workflows/deploy.yml`): Build + Deploy a GitHub Pages + smoke test post-despliegue

### Flujo de trabajo

```
PR / Push a main  →  CI (lint + test + build)  →  Deploy a GitHub Pages  →  Smoke Test
```

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

## Contribuir

1. Crea un fork del repositorio
2. Crea una rama descriptiva: `git checkout -b feature/mi-funcionalidad`
3. Realiza tus cambios y añade tests si aplica
4. Asegúrate de que lint y tests pasan: `npm run lint && npm test`
5. Abre un Pull Request hacia `main`

Todo PR debe pasar el pipeline de CI antes de ser fusionado.

## Seguridad

Consulta [SECURITY.md](./SECURITY.md) para conocer la política de seguridad del proyecto y cómo reportar vulnerabilidades de forma responsable.
