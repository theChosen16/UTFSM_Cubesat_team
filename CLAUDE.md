# CLAUDE.md — Contexto para Claude Code

## Proyecto

**USM CubeSat Team** — plataforma web privada para gestión interna del equipo de nano-satélites de la UTFSM.
Stack: React 18 + TypeScript + Vite + Tailwind CSS + Firebase (Auth / Firestore) + Google Drive vía Apps Script (uploads) + React Router v6.
Deploy: GitHub Pages vía GitHub Actions (`https://thechosen16.github.io/UTFSM_Cubesat_team/`).

## Comandos esenciales

```bash
npm run dev          # servidor de desarrollo (puerto 5173)
npm run build        # tsc -b && vite build  — debe pasar sin errores antes de commit
npm test             # Vitest modo CI (171 tests, ~34 s)
npm run lint         # ESLint
npm run test:e2e     # tests E2E contra emuladores Firebase
npm run emulators    # inicia emuladores manualmente
```

El pipeline CI ejecuta `bun run lint && bun run test && bun run build` en cada PR.

## Arquitectura

### Colecciones Firestore

| Colección | Descripción |
|-----------|-------------|
| `users` | Perfiles de usuario (rol, equipos, foto) |
| `projects` | Proyectos del equipo |
| `tasks` | Tareas con hitos, entregables, avances y score |
| `notifications` | Notificaciones internas |
| `activity_log` | Registro inmutable de acciones de usuario |
| `files` | Metadatos de archivos subidos a Storage |
| `member_scores` | Scores acumulados por miembro (reservado) |

Las constantes de colección están en `src/lib/constants.ts` (`COLLECTIONS`).

### SDK Services (`src/sdk/`)

- `TaskService` — CRUD de tareas; `updateStatus` registra en ActivityLog; `addProgressUpdate` y `attachFileToDeliverable` incluyen logs y notificaciones automáticas.
- `ActivityLogService` — `create`, `getAll`, `getByUser`.
- `FileService` — `upload` (Apps Script + Drive + Firestore metadata), `getAll`, `delete`. Lee `VITE_DRIVE_UPLOAD_URL` y `VITE_DRIVE_UPLOAD_SECRET`. `isConfigured()` indica si el bridge está disponible.
- `NotificationService` — `create` (con deduplicación opcional), `ensureDeadlineReminder`, `notifyDeliverableUploaded`.
- `BotService` — servicio del chatbot IA con soporte recursivo de **Gemini Function Calling** (hasta 3 niveles) para administradores, conmutación de modelos por fallo (`gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-2.5-flash`, etc.) y procesamiento/lectura de archivos adjuntos (imágenes, PDFs, DOCX, PPTX, TXT, CSV, JSON, MD).
- `AdminActionsService` — servicio puente seguro que resuelve las llamadas ejecutivas de IA sobre Firestore (creación de tareas/eventos, sincronizaciones, consulta/despacho de noticiarios semanales, gestión de CubeDesign 2026, auditoría de actas de reunión e ingreso de cumpleaños) validando privilegios en caliente.
- `UserService`, `ProjectService` — servicios pre-existentes.

### Tipos clave (`src/types/index.ts`)

`Task` incluye: `hitos?: TaskMilestone[]`, `deliverables?: TaskDeliverable[]`, `progressUpdates?: TaskProgressUpdate[]`, `attachmentIds?: string[]`, `fechaLimite?: string`, `completedBy?`, `completedAt?`, `scoreAwarded?`.

`ActivityLogEntry` usa `ActivityLogType`: `task_created | task_status_changed | task_progress_logged | task_completed | deliverable_uploaded | deliverable_status_changed`.

`NotificationType` incluye: `task_assigned | deliverable_uploaded | deadline_reminder | message | system`.

`ProcessedBotFile` contiene metadatos y datos codificados o texto extraído para el bot: `name`, `mimeType`, `size`, `inlineData` (base64) y `extractedText` (texto parseado de DOCX/PPTX/etc.).

`MailDigestLog` registra los envíos del noticiario o boletín semanal con `triggeredBy`, `recipientCount`, `eventsCount`, `tasksCount` y lista de destinatarios.

### Páginas (todas lazy-loaded)

| Ruta | Componente |
|------|-----------|
| `/dashboard` | Dashboard — stats + Centro de Tracking de Actividades por sub-equipo |
| `/projects` | Projects |
| `/tasks` | TaskManagement — hitos, entregables, avances |
| `/files` | FileRepository — biblioteca central de archivos |
| `/members` | Members — métricas de actividad por miembro y sub-equipo |
| `/notifications` | Notifications |
| `/profile` | Profile |

### Utilidades

- `src/lib/memberMetrics.ts` — `buildMemberPerformance()` y `getMemberRankInfo()` para calcular score y rango por miembro.
- `src/lib/schemas.ts` — validación Zod para formularios (incluye `milestoneSchema`, `deliverableSchema`).

## Roles y permisos

- **Maestro**: administración total.
- **Admin**: gestión de contenido y miembros (excepto maestro/admin).
- Miembros sin rol especial pueden actualizar campos específicos de sus tareas asignadas (ver `firestore.rules`).
- `canManageWorkspace()` = `hasTeam('manager') || hasRole('maestro') || hasRole('admin')`.

## Reglas de Firebase

- `firestore.rules` — regla granular de `update` en `tasks`: los asignados solo pueden tocar `estado, progressUpdates, fechaInicioReal, fechaFinReal, tiempoInvertido, deliverables, attachmentIds, completedBy, completedAt, scoreAwarded`.
- **Sin `storage.rules`** — los archivos viven en Google Drive vía Apps Script (`apps-script/Code.gs`), no en Firebase Storage. Esto evita el costo de Firebase Storage en planes pagos.

## Drive bridge (Apps Script)

- Backend gratuito para subir archivos: `apps-script/Code.gs` desplegado como Web App de Apps Script con permisos del dueño del Drive.
- Recibe `POST` con `{ secret, action: 'upload'|'delete', userEmail, fileName, fileBase64, mimeType, taskId?, projectId?, deliverableId? }`.
- Organiza en subcarpetas `tasks/{taskId}/`, `projects/{projectId}/`, `general/`.
- Marca cada archivo como **anyone-with-link can view** → los miembros bajan/previsualizan sin acceso al folder padre.
- Validaciones: secret compartido + email institucional (`@usm.cl`/`@sansano.usm.cl`) + límite 35 MB.
- Setup: `apps-script/README.md` documenta el flujo completo.

## Tests

- **Unitarios**: `src/pages/*.test.tsx`, `src/sdk/*.test.ts`, `src/lib/*.test.ts` — 171 tests.
- **E2E**: `src/test/e2e/*.e2e.test.ts` — usan emuladores Firebase (Auth + Firestore en puertos 9099/8080).
- Mocks globales en `src/test/setup.ts`.

## Convenciones

- TypeScript estricto — no usar `any`; preferir tipos explícitos o `unknown`.
- Tailwind CSS con clases del tema espacial: `space-700`, `space-800`, `space-600` (fondo oscuro), `cyan-400/500` (acento principal).
- Textos de la UI en **español (Chile)** (`es-CL`).
- Logging de errores mediante `logger.error(...)` de `src/lib/logger.ts` — nunca `console.error` directo.
- `crypto.randomUUID()` para IDs de hitos/entregables/updates en cliente.
- Fechas almacenadas como ISO strings (`new Date().toISOString()`) excepto `createdAt` que usa `Timestamp.now()` de Firestore.
