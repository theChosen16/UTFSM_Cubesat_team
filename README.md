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
| Testing | [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) |
| CI/CD | GitHub Actions + GitHub Pages |

## Funcionalidades

- **Landing page** pública con información del equipo
- **Autenticación**: registro, inicio de sesión y recuperación de contraseña vía Firebase Auth
- **Dashboard** privado con estadísticas en tiempo real desde Firestore (proyectos activos, tareas pendientes, completadas y miembros)
- **Proyectos**: listado y gestión de proyectos del equipo (datos desde Firestore)
- **Gestión de Tareas**: dashboard para maestro y admin que permite crear tareas asignando proyecto, equipo encargado, prioridad y responsable(s)
- **Selección de equipo**: cada usuario puede elegir a qué equipo pertenecer desde su perfil, sin asignación automática
- **Miembros**: directorio de integrantes con gestión de roles (accesible para maestro y admin). Solo el maestro puede asignar el rol de administrador
- **Perfil**: vista y edición de datos personales, selección de equipo y cuestionario de cualidades
- **Rutas protegidas** que redirigen a login cuando el usuario no está autenticado
- **Redirección automática**: usuarios autenticados son redirigidos al dashboard si visitan login/registro
- **Error Boundary** global que captura errores de React y muestra una pantalla de recuperación
- **Logger de producción** para captura de errores y diagnóstico

## Roles y permisos

El sistema soporta 5 roles jerárquicos:

| Rol | Descripción | Permisos clave |
|-----|-------------|----------------|
| **Maestro** | Dueño del sistema | Administración total, asignar cualquier rol (incluido admin), eliminar miembros, gestionar tareas |
| **Admin** | Administrador | Gestionar contenido, proyectos, tareas y asignar roles (excepto admin y maestro) |
| **Manager** | Líder de proyecto | Crear proyectos, controlar el equipo, guiar desarrollo |
| **Técnico** | Equipo técnico | Ver proyectos asignados, actualizar estado de tareas |
| **Relaciones Públicas** | Comunicación | Gestionar redes sociales, coordinar recursos universitarios |

### Administrador del sistema

El usuario **maestro** actual es el primer usuario registrado en la plataforma. **Solo el maestro** puede asignar el rol de administrador a otros usuarios. Los usuarios **admin** pueden gestionar miembros y roles (excepto admin y maestro) desde la sección "Miembros" del menú lateral.

> **Nota:** Solo correos institucionales de la USM (`@usm.cl` o `@sansano.usm.cl`) son aceptados para registro.

## Equipos

Los usuarios pueden seleccionar el equipo al que desean pertenecer desde su perfil. La asignación de equipo es independiente del rol y no se realiza de forma automática al registrarse. Los equipos disponibles son:

| Equipo | Descripción |
|--------|-------------|
| **Estructura** | Diseño estructural y mecánico del satélite |
| **Software** | Desarrollo de software embebido y de misión |
| **Comunicaciones** | Sistemas de telecomunicaciones y enlace |
| **Propulsión** | Sistemas de propulsión y control de actitud |
| **Gestión** | Coordinación de proyectos y equipos |
| **Relaciones Públicas** | Redes sociales, difusión y contactos |

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
| `npm test` | Ejecuta los tests con Vitest (modo CI) |
| `npm run test:watch` | Ejecuta los tests en modo observador |

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
