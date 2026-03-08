# USM CubeSat Team 🛰️

Sitio web oficial del equipo de nano satélites de la **Universidad Técnica Federico Santa María (UTFSM)**. La aplicación permite gestionar miembros, proyectos y recursos del equipo en una plataforma centralizada con autenticación segura.

## Tabla de contenidos

- [Tecnologías](#tecnologías)
- [Funcionalidades](#funcionalidades)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Variables de entorno](#variables-de-entorno)
- [Scripts disponibles](#scripts-disponibles)
- [Despliegue](#despliegue)
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
- **Dashboard** privado con resumen de actividad
- **Proyectos**: listado y gestión de proyectos del equipo
- **Miembros**: directorio de integrantes
- **Perfil**: vista y edición de datos personales
- Rutas protegidas que redirigen a login cuando el usuario no está autenticado

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

1. Cada push o pull request a `main` ejecuta el pipeline de CI (lint + build).
2. Si el CI pasa, el workflow de despliegue publica la aplicación en GitHub Pages.

La URL pública es: `https://thechosen16.github.io/UTFSM_Cubesat_team/`

## Contribuir

1. Crea un fork del repositorio
2. Crea una rama descriptiva: `git checkout -b feature/mi-funcionalidad`
3. Realiza tus cambios y añade tests si aplica
4. Asegúrate de que lint y tests pasan: `npm run lint && npm test`
5. Abre un Pull Request hacia `main`

Todo PR debe pasar el pipeline de CI antes de ser fusionado.

## Seguridad

Consulta [SECURITY.md](./SECURITY.md) para conocer la política de seguridad del proyecto y cómo reportar vulnerabilidades de forma responsable.
