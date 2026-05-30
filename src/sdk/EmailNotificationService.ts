import { collection, query, getDocs, addDoc, Timestamp, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COLLECTIONS } from '@/lib/constants'
import { EventService } from '@/sdk/EventService'
import { TaskService } from '@/sdk/TaskService'
import { UserService } from '@/sdk/UserService'
import { CalendarEvent, Task, MailDigestLog } from '@/types'
import { logger } from '@/lib/logger'
import { ActivityLogService } from '@/sdk/ActivityLogService'

export class EmailNotificationService {
  /**
   * Compila los datos de los últimos 7 días y los próximos 7 días
   */
  static async compileDigestData() {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    // 1. Obtener todos los eventos y filtrar los próximos 7 días
    const allEvents = await EventService.getAll().catch(() => [] as CalendarEvent[])
    const upcomingEvents = allEvents.filter(event => {
      const eventDate = new Date(event.fechaInicio)
      return eventDate >= now && eventDate <= sevenDaysAhead
    }).sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime())

    // 2. Obtener todas las tareas y filtrar por hitos de la última semana
    const allTasks = await TaskService.getAll().catch(() => [] as Task[])
    const completedTasks = allTasks.filter(task => {
      if (task.estado !== 'completado' || !task.completedAt) return false
      const completedDate = new Date(task.completedAt)
      return completedDate >= sevenDaysAgo && completedDate <= now
    })

    const inProgressTasks = allTasks.filter(task => task.estado === 'en_progreso')

    const newTasks = allTasks.filter(task => {
      const createdDate = new Date(task.createdAt)
      return createdDate >= sevenDaysAgo && createdDate <= now
    })

    return {
      upcomingEvents,
      completedTasks,
      inProgressTasks,
      newTasks,
    }
  }

  /**
   * Genera el HTML premium estilo espacial oscuro para el boletín
   */
  static generateHTMLTemplate(
    userName: string,
    data: {
      upcomingEvents: CalendarEvent[]
      completedTasks: Task[]
      inProgressTasks: Task[]
      newTasks: Task[]
    }
  ): string {
    const now = new Date()
    const { upcomingEvents, completedTasks, inProgressTasks } = data

    // Formateador de fechas
    const formatDate = (isoString: string) => {
      try {
        const d = new Date(isoString)
        return d.toLocaleDateString('es-CL', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })
      } catch {
        return isoString
      }
    }

    // Renderizado de Eventos
    let eventsHTML = ''
    if (upcomingEvents.length === 0) {
      eventsHTML = `
        <div style="background-color: #111827; border: 1px dashed #374151; padding: 20px; border-radius: 12px; text-align: center; color: #9ca3af; font-style: italic;">
          🚀 Órbita despejada. No hay eventos programados para los próximos 7 días.
        </div>
      `
    } else {
      upcomingEvents.forEach(event => {
        let borderLeftColor = '#10b981' // Green default
        let typeBadgeColor = 'rgba(16, 185, 129, 0.2)'
        let typeTextColor = '#10b981'
        let typeLabel = 'Otro'

        switch (event.tipo) {
          case 'reunion':
            borderLeftColor = '#06b6d4' // Cyan
            typeBadgeColor = 'rgba(6, 182, 212, 0.15)'
            typeTextColor = '#22d3ee'
            typeLabel = 'Reunión'
            break
          case 'deadline':
            borderLeftColor = '#f97316' // Orange
            typeBadgeColor = 'rgba(249, 115, 22, 0.15)'
            typeTextColor = '#fb923c'
            typeLabel = 'Hito / Entrega'
            break
          case 'social':
            borderLeftColor = '#ec4899' // Pink
            typeBadgeColor = 'rgba(236, 72, 153, 0.15)'
            typeTextColor = '#f472b6'
            typeLabel = 'Social / Team'
            break
          case 'visita':
            borderLeftColor = '#3b82f6' // Blue
            typeBadgeColor = 'rgba(59, 130, 246, 0.15)'
            typeTextColor = '#60a5fa'
            typeLabel = 'Visita Técnica'
            break
        }

        eventsHTML += `
          <div style="background-color: #111827; border-left: 4px solid ${borderLeftColor}; border-top: 1px solid #1f2937; border-right: 1px solid #1f2937; border-bottom: 1px solid #1f2937; padding: 16px; margin-bottom: 12px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
              <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; background-color: ${typeBadgeColor}; color: ${typeTextColor}; padding: 3px 8px; border-radius: 12px; display: inline-block;">
                ${typeLabel}
              </span>
            </div>
            <h4 style="margin: 4px 0; color: #ffffff; font-size: 15px; font-weight: 600;">${event.titulo}</h4>
            <p style="margin: 4px 0 8px 0; color: #9ca3af; font-size: 13px; line-height: 1.4;">${event.descripcion || 'Sin descripción detallada.'}</p>
            <div style="font-size: 12px; color: #22d3ee; font-weight: bold;">
              📅 ${formatDate(event.fechaInicio)}
            </div>
          </div>
         Maka`
      })
      // Clean up the template noise if any
      eventsHTML = eventsHTML.replace(/ Maka$/, '')
    }

    // Renderizado de Tareas Completadas
    let completedHTML = ''
    if (completedTasks.length === 0) {
      completedHTML = `<li style="color: #9ca3af; font-style: italic; font-size: 13px; margin-bottom: 6px;">No se completaron tareas esta semana. ¡A acelerar motores! 🛠️</li>`
    } else {
      completedTasks.forEach(task => {
        completedHTML += `
          <li style="color: #e5e7eb; font-size: 13px; margin-bottom: 8px; line-height: 1.4;">
            <strong style="color: #10b981;">✓ ${task.titulo}</strong>
            <span style="color: #9ca3af; font-size: 12px;">(${task.equipo === 'manager' ? 'Gestión' : task.equipo === 'relaciones_publicas' ? 'RRPP' : 'Técnico'})</span>
          </li>
        `
      })
    }

    // Renderizado de Tareas en Progreso
    let inProgressHTML = ''
    if (inProgressTasks.length === 0) {
      inProgressHTML = `<li style="color: #9ca3af; font-style: italic; font-size: 13px; margin-bottom: 6px;">No hay tareas activas en progreso en este momento.</li>`
    } else {
      inProgressTasks.slice(0, 8).forEach(task => {
        inProgressHTML += `
          <li style="color: #e5e7eb; font-size: 13px; margin-bottom: 8px; line-height: 1.4;">
            <strong style="color: #a855f7;">✦ ${task.titulo}</strong> 
            <span style="color: #9ca3af; font-size: 12px;">- asignada a ${task.asignadoA.length} miembro(s)</span>
          </li>
        `
      })
      if (inProgressTasks.length > 8) {
        inProgressHTML += `
          <li style="color: #22d3ee; font-size: 12px; font-style: italic; margin-top: 4px;">
            ... y otras ${inProgressTasks.length - 8} tareas más en progreso activo en el portal.
          </li>
        `
      }
    }

    // Frase espacial motivadora aleatoria
    const spaceQuotes = [
      "&ldquo;La Tierra es la cuna de la humanidad, pero no se puede vivir en una cuna para siempre.&rdquo; &ndash; Konstantin Tsiolkovsky",
      "&ldquo;En algún lugar, algo increíble está esperando ser conocido.&rdquo; &ndash; Carl Sagan",
      "&ldquo;La órbita no es un límite, es solo el comienzo.&rdquo; &ndash; USM CubeSat Team",
      "&ldquo;La ciencia es una forma de pensar mucho más que un cuerpo de conocimiento.&rdquo; &ndash; Carl Sagan",
    ]
    const randomQuote = spaceQuotes[Math.floor(Math.random() * spaceQuotes.length)]

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>UTFSM CubeSat Team - Boletín Semanal</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: 'Inter', -apple-system, BlinkMacSystemFont, Arial, sans-serif; color: #f3f4f6;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <!-- HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); padding: 32px 24px; text-align: center; border-bottom: 2px solid #06b6d4;">
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="padding-bottom: 10px;">
                    <span style="font-size: 32px;">🛰️</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">BOLETÍN SEMANAL CUBESAT</h1>
              <p style="margin: 5px 0 0 0; color: #22d3ee; font-size: 13px; font-weight: bold; letter-spacing: 2px;">UTFSM CUBESAT TEAM</p>
            </td>
          </tr>

          <!-- BODY CONTAINER -->
          <tr>
            <td style="padding: 24px;">
              <!-- GREETING -->
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #e5e7eb;">
                ¡Hola <strong>${userName}</strong>! 👋
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #9ca3af;">
                Te presentamos el informe de la órbita de esta semana con las actividades más destacadas, los eventos programados del calendario para coordinarnos y los logros del equipo técnico y administrativo de **UTFSM CubeSat**.
              </p>

              <!-- STATS SECTION -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                <tr>
                  <td width="32%" style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 18px; font-weight: bold; color: #06b6d4;">${upcomingEvents.length}</div>
                    <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; margin-top: 4px; font-weight: bold;">Eventos</div>
                  </td>
                  <td width="2%">&nbsp;</td>
                  <td width="32%" style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 18px; font-weight: bold; color: #10b981;">${completedTasks.length}</div>
                    <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; margin-top: 4px; font-weight: bold;">Logros</div>
                  </td>
                  <td width="2%">&nbsp;</td>
                  <td width="32%" style="background-color: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 18px; font-weight: bold; color: #a855f7;">${inProgressTasks.length}</div>
                    <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; margin-top: 4px; font-weight: bold;">En Progreso</div>
                  </td>
                </tr>
              </table>

              <!-- SECTION 1: CALENDAR EVENTS -->
              <h3 style="margin: 0 0 16px 0; color: #ffffff; font-size: 15px; border-bottom: 1px solid #1f2937; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
                📅 Próximos Eventos y Hitos (Próximos 7 días)
              </h3>
              <div style="margin-bottom: 28px;">
                ${eventsHTML}
              </div>

              <!-- SECTION 2: WORK IN ORBIT -->
              <h3 style="margin: 0 0 16px 0; color: #ffffff; font-size: 15px; border-bottom: 1px solid #1f2937; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
                🚀 Avances y Logros de la Semana
              </h3>
              
              <div style="background-color: #111827; border: 1px solid #1f2937; padding: 18px; border-radius: 12px; margin-bottom: 28px;">
                <h4 style="margin: 0 0 10px 0; color: #10b981; font-size: 13px; text-transform: uppercase; font-weight: bold;">✅ Tareas Completadas Recientemente</h4>
                <ul style="margin: 0 0 16px 0; padding-left: 0; list-style-type: none;">
                  ${completedHTML}
                </ul>

                <h4 style="margin: 0 0 10px 0; color: #a855f7; font-size: 13px; text-transform: uppercase; font-weight: bold;">⚡ Tareas en Progreso Activo</h4>
                <ul style="margin: 0; padding-left: 0; list-style-type: none;">
                  ${inProgressHTML}
                </ul>
              </div>

              <!-- DYNAMIC QUOTE -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 10px;">
                <tr>
                  <td style="background-color: #1e1b4b; border-left: 4px solid #a855f7; border-radius: 6px; padding: 16px; font-style: italic; color: #c084fc; font-size: 13px; line-height: 1.5; text-align: center;">
                    ${randomQuote}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CALL TO ACTION -->
          <tr>
            <td style="padding: 0 24px 28px 24px; text-align: center;">
              <a href="https://alean-b.github.io/Cubesat-team-page/" target="_blank" style="background: linear-gradient(90deg, #06b6d4, #a855f7); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 15px rgba(6, 182, 212, 0.3); transition: all 0.2s;">
                Entrar al Portal CubeSat 🛰️
              </a>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #0b0f19; padding: 24px; text-align: center; border-top: 1px solid #1e293b; color: #6b7280; font-size: 11px; line-height: 1.5;">
              <p style="margin: 0 0 6px 0;">© ${now.getFullYear()} UTFSM CubeSat Team. Todos los derechos reservados.</p>
              <p style="margin: 0;">Este es un correo institucional generado por la plataforma del proyecto satelital.</p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  }

  /**
   * Envía el noticiario semanal de correo a todos los usuarios activos
   */
  static async sendWeeklyDigest(actorId: string): Promise<Omit<MailDigestLog, 'id'>> {
    try {
      logger.info('Iniciando compilación y envío del noticiario semanal', { actorId })

      // 1. Compilar datos
      const digestData = await this.compileDigestData()

      // 2. Obtener todos los usuarios activos
      const allUsers = await UserService.getAll()
      const activeUsers = allUsers.filter(u => u.isActive && u.email)

      if (activeUsers.length === 0) {
        throw new Error('No hay usuarios activos registrados con correo electrónico.')
      }

      // 3. Crear los correos en la colección /mail
      const recipientsEmails: string[] = []
      const promises = activeUsers.map(async (user) => {
        const userName = user.nombre || 'Miembro'
        const html = this.generateHTMLTemplate(userName, digestData)

        recipientsEmails.push(user.email)

        // Escribir a la colección 'mail' (procesada por la Firebase Trigger Email extension)
        return addDoc(collection(db, COLLECTIONS.MAIL), {
          to: user.email,
          message: {
            subject: 'UTFSM CubeSat: Boletín de la Órbita y Eventos Próximos 🛰️',
            html: html,
          },
          createdAt: Timestamp.now(),
        })
      })

      await Promise.all(promises)

      // 4. Registrar en la bitácora de boletines /mail_digests
      const logPayload = {
        createdAt: new Date(),
        triggeredBy: actorId,
        recipientCount: activeUsers.length,
        eventsCount: digestData.upcomingEvents.length,
        tasksCount: digestData.completedTasks.length + digestData.inProgressTasks.length,
        recipients: recipientsEmails,
      }

      await addDoc(collection(db, COLLECTIONS.MAIL_DIGESTS), {
        ...logPayload,
        createdAt: Timestamp.fromDate(logPayload.createdAt),
      })

      // 5. Registrar en la bitácora de actividad social general
      await ActivityLogService.create({
        userId: actorId === 'sistema_automatico' ? 'sistema' : actorId,
        type: 'deliverable_status_changed', // Usar un tipo general o similar
        relatedId: 'weekly_digest',
        description: `Se despachó el Boletín Semanal ("Noticiario de la Órbita") a ${activeUsers.length} miembros del equipo.`,
        metadata: {
          recipientCount: activeUsers.length,
          eventsIncluded: digestData.upcomingEvents.length,
          tasksIncluded: digestData.completedTasks.length,
          triggeredBy: actorId,
        },
      }).catch(err => {
        logger.warn('No se pudo registrar la actividad del noticiario', { err })
      })

      logger.info('Noticiario semanal despachado con éxito', { recipientCount: activeUsers.length })
      return logPayload
    } catch (error) {
      logger.error('Error en EmailNotificationService.sendWeeklyDigest', { error: error instanceof Error ? error : undefined })
      throw error
    }
  }

  /**
   * Daemon automático: Verifica si hace falta enviar el boletín (más de 7 días) y lo despacha
   */
  static async checkAndTriggerWeeklyDigest(_actorId: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, COLLECTIONS.MAIL_DIGESTS),
        orderBy('createdAt', 'desc'),
        limit(1)
      )
      const snap = await getDocs(q)

      let shouldTrigger = false
      if (snap.empty) {
        shouldTrigger = true
      } else {
        const lastDigestDoc = snap.docs[0].data()
        const lastCreatedAt = lastDigestDoc.createdAt?.toDate() as Date | undefined
        if (lastCreatedAt) {
          const diffMs = Date.now() - lastCreatedAt.getTime()
          const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
          if (diffMs >= sevenDaysMs) {
            shouldTrigger = true
          }
        } else {
          shouldTrigger = true
        }
      }

      if (shouldTrigger) {
        logger.info('Han pasado más de 7 días desde el último noticiario o no existe registro. Disparando envío automático...')
        await this.sendWeeklyDigest('sistema_automatico')
        return true
      }

      return false
    } catch (error) {
      logger.warn('Error en checkAndTriggerWeeklyDigest, el daemon continuará en el próximo ciclo', { error: error instanceof Error ? error : undefined })
      return false
    }
  }

  /**
   * Obtiene el último log de envío del noticiario
   */
  static async getLastDigestLog(): Promise<MailDigestLog | null> {
    try {
      const q = query(
        collection(db, COLLECTIONS.MAIL_DIGESTS),
        orderBy('createdAt', 'desc'),
        limit(1)
      )
      const snap = await getDocs(q)
      if (snap.empty) return null

      const d = snap.docs[0]
      const data = d.data()
      return {
        id: d.id,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        triggeredBy: data.triggeredBy || '',
        recipientCount: data.recipientCount || 0,
        eventsCount: data.eventsCount || 0,
        tasksCount: data.tasksCount || 0,
        recipients: data.recipients || [],
      } as MailDigestLog
    } catch (error) {
      logger.error('Error en EmailNotificationService.getLastDigestLog', { error: error instanceof Error ? error : undefined })
      return null
    }
  }
}
