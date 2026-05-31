import { GoogleGenerativeAI, ChatSession, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { ProjectService } from './ProjectService'
import { TaskService } from './TaskService'
import { AdminActionsService } from './AdminActionsService'
import { SecretsService } from './SecretsService'
import { logger } from '@/lib/logger'
import { ProcessedBotFile } from '@/types'
import { auth } from '@/lib/firebase'

// En producción siempre se usa el proxy seguro (Apps Script). En desarrollo, solo se usa modo directo
// si se configura explícitamente VITE_ENABLE_DIRECT_AI=true (NO exponer la key por defecto).
const API_KEY = (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DIRECT_AI === 'true')
  ? import.meta.env.VITE_GOOGLE_AI_KEY
  : undefined
const MODEL_CANDIDATES = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'] as const

// Only use direct SDK mode if explicitly enabled AND a real, valid API Key is provided
const isDirectMode = Boolean(API_KEY && API_KEY !== 'your-google-ai-key' && !API_KEY.includes('placeholder'))

let genAI: GoogleGenerativeAI | null = null
if (isDirectMode && API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY)
}

const MAX_CHAT_HISTORY_TURNS = 20

export class BotService {
  private static chatSession: ChatSession | null = null
  private static chatHistory: any[] = []
  private static activeModelIndex = 0
  private static activeSessionRole: string | null = null

  private static isRecoverableModelError(error: unknown): boolean {
    const status = (error as { status?: number })?.status
    const message = String((error as Error)?.message || '').toLowerCase()

    return status === 404 ||
      message.includes('404') ||
      message.includes('not found') ||
      message.includes('model') && message.includes('not') && (message.includes('available') || message.includes('found') || message.includes('supported'))
  }

  private static async createChatSession(modelName: string, userRole?: string): Promise<ChatSession> {
    const domainContext = await this.getDomainContext()

    let systemInstruction = `Eres "Cubesat Bot", el asistente de inteligencia artificial oficial del equipo USM Cubesat Team (Universidad Técnica Federico Santa María).
Tus reglas son estrictas e inquebrantables:
1. DEBES enfocarte NETAMENTE en fines de proyectos aeroespaciales atingentes al Cubesat. Si te preguntan sobre temas no relacionados a programación, aeronáutica, ciencia espacial, robótica, gestión de misión, o tareas actuales del equipo, debes amablemente negar la respuesta indicando tu propósito.
2. Tienes una perspectiva crítica y evalúas las opciones de desarrollo y diseño de componentes o arquitectura considerando múltiples variables (peso, radiación estelar, redundancia, estrés mecánico, consumo energético, software constraints).
3. Eres fanático de los sistemas Sencillos y Robustos, y debes recalcar que es mejor ser funcional antes que sobre-diseñar. 
4. Tu objetivo a largo plazo es ayudar al equipo a iterar proyectos. Piensa a largo plazo. 
5. Tienes acceso a la base de datos viva del equipo. Aquí está el contexto actual: 
${domainContext}

Usa este contexto para referenciar, cuando te pregunten qué hay que hacer o cómo ayudar, tareas pendientes de los miembros, etc. Sé breve y estructurado en tus respuestas. Trata al usuario con respeto y estilo ingenieril.`

    const isAdmin = userRole === 'admin' || userRole === 'maestro' || userRole === 'manager'
    if (isAdmin) {
      systemInstruction += `\n\n[MODO ADMINISTRADOR ACTIVO]: Cuentas con herramientas especiales para interactuar con la base de datos viva del equipo. Tienes permisos para ejecutar acciones operativas en tiempo real cuando el usuario te lo solicite.
Herramientas disponibles:
- crearTarea: Si te piden crear o agendar una tarea técnica/gestión, invoca la herramienta 'crearTarea'.
- crearEvento: Si te piden agendar una reunión, cita, visita o hito en el calendario, invoca la herramienta 'crearEvento'.
- sincronizarProyecto: Si te piden sincronizar la base de datos, memoria o Drive, invoca 'sincronizarProyecto'.
- obtenerMetricas: Si te piden métricas, reportes de avance o resúmenes de rendimiento de tareas, invoca 'obtenerMetricas'.
- obtenerEstadoNoticiario: Si te piden verificar o consultar el estado de envío del noticiario o boletín semanal de avances del equipo, invoca la herramienta 'obtenerEstadoNoticiario'.
- forzarEnvioNoticiario: Si te piden despachar, enviar, forzar o gatillar el noticiario o boletín semanal de avances del equipo a todos por correo, invoca la herramienta 'forzarEnvioNoticiario'.

IMPORTANTE: Siempre invoca la función respectiva ante estas solicitudes del administrador. Explica amablemente qué acción ejecutiva estás realizando y confirma el éxito basándote en la respuesta de la función.`
    }

    const tools = isAdmin
      ? [
          {
            functionDeclarations: [
              {
                name: 'crearTarea',
                description: 'Crea una nueva tarea de desarrollo o gestión para el equipo USM Cubesat.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    titulo: { type: 'STRING', description: 'El título o resumen de la tarea.' },
                    descripcion: { type: 'STRING', description: 'Detalle o instrucciones de la tarea (opcional).' },
                    prioridad: { type: 'STRING', enum: ['alta', 'media', 'baja'], description: 'Prioridad de la tarea.' },
                    equipo: { type: 'STRING', enum: ['manager', 'relaciones_publicas', 'tecnico'], description: 'El subsistema o equipo responsable.' },
                    fechaLimite: { type: 'STRING', description: 'La fecha límite en formato YYYY-MM-DD (opcional).' },
                    projectId: { type: 'STRING', description: 'El ID del proyecto al que pertenece la tarea (opcional).' },
                    generarHitosAeroespaciales: { type: 'BOOLEAN', description: 'Si es verdadero y la tarea es técnica (firmware, simulación térmica, estructural, etc.), autogenera sub-hitos técnicos aeroespaciales en Firestore (opcional).' }
                  },
                  required: ['titulo', 'prioridad', 'equipo']
                }
              },
              {
                name: 'crearEvento',
                description: 'Agenda una nueva reunión, hito o evento en el calendario de actividades del equipo.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    titulo: { type: 'STRING', description: 'El nombre o motivo del evento.' },
                    descripcion: { type: 'STRING', description: 'Detalles adicionales o enlace de reunión (opcional).' },
                    tipo: { type: 'STRING', enum: ['reunion', 'deadline', 'visita', 'social', 'otro'], description: 'Categoría o tipo de evento.' },
                    fechaInicio: { type: 'STRING', description: 'Fecha y hora de inicio en formato ISO o YYYY-MM-DD.' },
                    fechaFin: { type: 'STRING', description: 'Fecha y hora de término (opcional).' },
                    todoElDia: { type: 'BOOLEAN', description: 'Indica si dura todo el día (opcional).' }
                  },
                  required: ['titulo', 'tipo', 'fechaInicio']
                }
              },
              {
                name: 'sincronizarProyecto',
                description: 'Sincroniza los activos de la plataforma, base de datos y archivos de Google Drive.',
                parameters: {
                  type: 'OBJECT',
                  properties: {}
                }
              },
              {
                name: 'obtenerMetricas',
                description: 'Muestra un reporte consolidado con las métricas actuales del desarrollo de proyectos y tareas pendientes.',
                parameters: {
                  type: 'OBJECT',
                  properties: {}
                }
              },
              {
                name: 'registrarCumpleanos',
                description: 'Registra o actualiza la fecha de cumpleaños de un miembro del equipo en Firestore.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    miembroId: { type: 'STRING', description: 'El ID único del usuario/miembro.' },
                    fecha: { type: 'STRING', description: 'La fecha de cumpleaños en formato MM-DD (ej: "11-14").' }
                  },
                  required: ['miembroId', 'fecha']
                }
              },
              {
                name: 'gestionarCubeDesign',
                description: 'Gestiona la participación de la nómina técnica y el sembrado de hitos del evento CubeDesign 2026.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    accion: { type: 'STRING', enum: ['confirmar_miembro', 'desconfirmar_miembro', 'auditar_preparacion', 'crear_hitos'], description: 'La acción de gestión a ejecutar.' },
                    miembroId: { type: 'STRING', description: 'El ID del miembro a confirmar o desconfirmar (requerido solo si la acción es confirmar_miembro o desconfirmar_miembro).' }
                  },
                  required: ['accion']
                }
              },
              {
                name: 'auditarActaDrive',
                description: 'Audita y procesa un acta o minuta de reunión resumida del equipo de Google Drive para poblar Firestore con tareas y reuniones masivas.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    fechaActa: { type: 'STRING', description: 'La fecha de la reunión o acta en formato YYYY-MM-DD.' },
                    acuerdosResumen: { type: 'STRING', description: 'El bloque de texto con los acuerdos de la reunión del Drive para procesar.' }
                  },
                  required: ['fechaActa', 'acuerdosResumen']
                }
              },
              {
                name: 'obtenerEstadoNoticiario',
                description: 'Obtiene el estado de despacho y log del último envío del noticiario o boletín semanal del equipo Cubesat.',
                parameters: {
                  type: 'OBJECT',
                  properties: {}
                }
              },
              {
                name: 'forzarEnvioNoticiario',
                description: 'Fuerza de forma inmediata el despacho del noticiario o boletín semanal de avances y próximos eventos a todos los miembros activos.',
                parameters: {
                  type: 'OBJECT',
                  properties: {}
                }
              }
            ]
          }
        ]
      : undefined

    const model = genAI!.getGenerativeModel({
      model: modelName,
      systemInstruction,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }
      ],
      tools: tools as any
    })

    return model.startChat({
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1000,
      }
    })
  }

  /**
   * Recopila la memoria persistente activa de la base de datos de Firebase.
   */
  private static async getDomainContext(): Promise<string> {
    try {
      const [projects, tasks] = await Promise.all([
        ProjectService.getAll(),
        TaskService.getAll()
      ])

      const activeProjects = projects.filter(p => p.estado !== 'completado')
      const activeTasks = tasks.filter(t => t.estado !== 'completado')

      // Construyendo el string de memoria para el System Prompt
      let context = `MEMORIA DEL EQUIPO CUBESAT USM:\n\n`
      
      context += `-- PROYECTOS ACTIVOS (${activeProjects.length}) --\n`
      activeProjects.forEach(p => {
        context += `- [${p.nombre}] Estado: ${p.estado}. Fecha Limite: ${p.fechaLimite || 'N/A'}. Desc: ${p.descripcion.substring(0, 50)}...\n`
      })
      
      context += `\n-- TAREAS PENDIENTES O EN PROGRESO (${activeTasks.length}) --\n`
      activeTasks.forEach(t => {
        context += `- [Tarea: ${t.titulo}] Estado: ${t.estado}. Prioridad: ${t.prioridad}. Proyecto ID: ${t.projectId}\n`
      })

      return context
    } catch (error) {
      logger.error('Error fetching domain context for Bot', { error: error instanceof Error ? error : undefined })
      return 'MEMORIA: No se pudo obtener el estado de los proyectos y tareas.'
    }
  }

  /**
   * Inicializa la sesión de Chat con las instrucciones y reglas estrictas del modelo.
   */
  static async startSession(userRole?: string): Promise<boolean> {
    if (!isDirectMode) {
      // Proxy Mode: No direct model initialization required
      if (userRole !== this.activeSessionRole) {
        this.resetSession()
        this.activeSessionRole = userRole || null
      }
      return true
    }

    if (!genAI) {
      logger.error('Google AI API Key no está configurada o es inválida.')
      return false
    }

    // Reinicia la sesión si cambia el rol del usuario para refrescar la inyección de herramientas
    if (this.chatSession && userRole !== this.activeSessionRole) {
      this.resetSession()
    }

    if (this.chatSession) {
      return true
    }

    for (let index = 0; index < MODEL_CANDIDATES.length; index++) {
      const modelName = MODEL_CANDIDATES[index]

      try {
        this.chatSession = await this.createChatSession(modelName, userRole)
        this.activeModelIndex = index
        this.activeSessionRole = userRole || null
        return true
      } catch (error) {
        logger.warn('Error initializing AI session with candidate model', {
          modelName,
          error: error instanceof Error ? error : undefined,
        })
      }
    }

    logger.error('Error initializing AI session', { modelCandidates: MODEL_CANDIDATES })
    return false
  }

  /**
   * Envía un mensaje al modelo y retorna la respuesta procesada.
   * Soporta de forma transparente la ejecución recursiva de Function Calling (Llamada a Funciones).
   */
  static async sendMessage(
    message: string, 
    userId?: string, 
    userRole?: string,
    fileData?: ProcessedBotFile | null
  ): Promise<string> {
    // If not in direct mode, utilize the secure Google Apps Script Proxy
    if (!isDirectMode) {
      await this.startSession(userRole)
      return this.sendProxyMessage(message, userId, userRole, fileData)
    }

    if (!this.chatSession || userRole !== this.activeSessionRole) {
      const initSuccess = await this.startSession(userRole)
      if (!initSuccess || !this.chatSession) {
        return "Error crítico: El núcleo de IA no pudo ser inicializado. Verifica la configuración de la clave en el entorno local."
      }
    }

    const activeUserId = userId || 'bot_admin_fallback'

    for (let attempt = this.activeModelIndex; attempt < MODEL_CANDIDATES.length; attempt++) {
      try {
        if (!this.chatSession || attempt !== this.activeModelIndex) {
          this.chatSession = await this.createChatSession(MODEL_CANDIDATES[attempt], userRole)
          this.activeModelIndex = attempt
          this.activeSessionRole = userRole || null
        }

        let response
        if (fileData) {
          if (fileData.inlineData) {
            const promptParts = [
              {
                inlineData: {
                  data: fileData.inlineData.data,
                  mimeType: fileData.inlineData.mimeType
                }
              },
              message
            ]
            response = await this.chatSession.sendMessage(promptParts)
          } else if (fileData.extractedText) {
            const formattedMessage = `[DOCUMENTO ADJUNTO: "${fileData.name}"]\n---\n${fileData.extractedText}\n---\n\nConsulta sobre el documento: ${message}`
            response = await this.chatSession.sendMessage(formattedMessage)
          } else {
            response = await this.chatSession.sendMessage(message)
          }
        } else {
          response = await this.chatSession.sendMessage(message)
        }
        let functionCalls = response.response.functionCalls()
        let iterations = 0

        // Bucle para resolver Function Calling (soporta hasta 3 llamadas encadenadas por petición)
        while (functionCalls && functionCalls.length > 0 && iterations < 3) {
          iterations++
          const functionCall = functionCalls[0]
          
          let functionResult: any
          try {
            functionResult = await this.executeAdminAction(functionCall.name, functionCall.args, activeUserId, userRole)
          } catch (err) {
            functionResult = { 
              success: false, 
              message: `Error local de ejecución: ${err instanceof Error ? err.message : String(err)}` 
            }
          }

          // Inyectamos la respuesta de la función para que el modelo redacte su texto final
          const responsePart = {
            functionResponse: {
              name: functionCall.name,
              response: { result: functionResult }
            }
          }

          response = await this.chatSession.sendMessage([responsePart])
          functionCalls = response.response.functionCalls()
        }

        return response.response.text()
      } catch (error) {
        const modelName = MODEL_CANDIDATES[attempt]

        logger.error('Error sending message to AI', {
          modelName,
          error: error instanceof Error ? error : undefined,
        })

        if (!this.isRecoverableModelError(error) || attempt === MODEL_CANDIDATES.length - 1) {
          this.chatSession = null
          return "Hubo una interferencia espacial con mi señal. Por favor, intenta conectar nuevamente en unos segundos."
        }

        this.chatSession = null
        logger.warn('Retrying AI request with fallback model', {
          failedModel: modelName,
          nextModel: MODEL_CANDIDATES[attempt + 1],
        })
      }
    }

    return "Hubo una interferencia espacial con mi señal. Por favor, intenta conectar nuevamente en unos segundos."
  }

  /**
   * Envía un mensaje al modelo de forma segura a través del proxy de Google Apps Script.
   * Soporta de forma transparente el flujo completo de Function Calling.
   */
  private static async sendProxyMessage(
    message: string,
    userId?: string,
    userRole?: string,
    fileData?: ProcessedBotFile | null
  ): Promise<string> {
    const userEmail = auth.currentUser?.email || 'bot_admin_fallback@usm.cl'
    const domainContext = await this.getDomainContext()

    let systemInstruction = `Eres "Cubesat Bot", el asistente de inteligencia artificial oficial del equipo USM Cubesat Team (Universidad Técnica Federico Santa María).
Tus reglas son estrictas e inquebrantables:
1. DEBES enfocarte NETAMENTE en fines de proyectos aeroespaciales atingentes al Cubesat. Si te preguntan sobre temas no relacionados a programación, aeronáutica, ciencia espacial, robótica, gestión de misión, o tareas actuales del equipo, debes amablemente negar la respuesta indicando tu propósito.
2. Tienes una perspectiva crítica y evalúas las opciones de desarrollo y diseño de componentes o arquitectura considerando múltiples variables (peso, radiación estelar, redundancia, estrés mecánico, consumo energético, software constraints).
3. Eres fanático de los sistemas Sencillos y Robustos, y debes recalcar que es mejor ser funcional antes que sobre-diseñar. 
4. Tu objetivo a largo plazo es ayudar al equipo a iterar proyectos. Piensa a largo plazo. 
5. Tienes acceso a la base de datos viva del equipo. Aquí está el contexto actual: 
${domainContext}

Usa este contexto para referenciar, cuando te pregunten qué hay que hacer o cómo ayudar, tareas pendientes de los miembros, etc. Sé breve y estructurado en tus respuestas. Trata al usuario con respeto y estilo ingenieril.`

    const isAdmin = userRole === 'admin' || userRole === 'maestro' || userRole === 'manager'
    if (isAdmin) {
      systemInstruction += `\n\n[MODO ADMINISTRADOR ACTIVO]: Cuentas con herramientas especiales para interactuar con la base de datos viva del equipo. Tienes permisos para ejecutar acciones operativas en tiempo real cuando el usuario te lo solicite.
Herramientas disponibles:
- crearTarea: Si te piden crear o agendar una tarea técnica/gestión, invoca la herramienta 'crearTarea'.
- crearEvento: Si te piden agendar una reunión, cita, visita o hito en el calendario, invoca la herramienta 'crearEvento'.
- sincronizarProyecto: Si te piden sincronizar la base de datos, memoria o Drive, invoca 'sincronizarProyecto'.
- obtenerMetricas: Si te piden métricas, reportes de avance o resúmenes de rendimiento de tareas, invoca 'obtenerMetricas'.
- obtenerEstadoNoticiario: Si te piden verificar o consultar el estado de envío del noticiario o boletín semanal de avances del equipo, invoca la herramienta 'obtenerEstadoNoticiario'.
- forzarEnvioNoticiario: Si te piden despachar, enviar, forzar o gatillar el noticiario o boletín semanal de avances del equipo a todos por correo, invoca la herramienta 'forzarEnvioNoticiario'.

IMPORTANTE: Siempre invoca la función respectiva ante estas solicitudes del administrador. Explica amablemente qué acción ejecutiva estás realizando y confirma el éxito basándote en la respuesta de la función.`
    }

    const tools = isAdmin
      ? [
          {
            functionDeclarations: [
              {
                name: 'crearTarea',
                description: 'Crea una nueva tarea de desarrollo o gestión para el equipo USM Cubesat.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    titulo: { type: 'STRING', description: 'El título o resumen de la tarea.' },
                    descripcion: { type: 'STRING', description: 'Detalle o instrucciones de la tarea (opcional).' },
                    prioridad: { type: 'STRING', enum: ['alta', 'media', 'baja'], description: 'Prioridad de la tarea.' },
                    equipo: { type: 'STRING', enum: ['manager', 'relaciones_publicas', 'tecnico'], description: 'El subsistema o equipo responsable.' },
                    fechaLimite: { type: 'STRING', description: 'La fecha límite en formato YYYY-MM-DD (opcional).' },
                    projectId: { type: 'STRING', description: 'El ID del proyecto al que pertenece la tarea (opcional).' },
                    generarHitosAeroespaciales: { type: 'BOOLEAN', description: 'Si es verdadero y la tarea es técnica (firmware, simulación térmica, estructural, etc.), autogenera sub-hitos técnicos aeroespaciales en Firestore (opcional).' }
                  },
                  required: ['titulo', 'prioridad', 'equipo']
                }
              },
              {
                name: 'crearEvento',
                description: 'Agenda una nueva reunión, hito o evento en el calendario de actividades del equipo.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    titulo: { type: 'STRING', description: 'El nombre o motivo del evento.' },
                    descripcion: { type: 'STRING', description: 'Detalles adicionales o enlace de reunión (opcional).' },
                    tipo: { type: 'STRING', enum: ['reunion', 'deadline', 'visita', 'social', 'otro'], description: 'Categoría o tipo de evento.' },
                    fechaInicio: { type: 'STRING', description: 'Fecha y hora de inicio en formato ISO o YYYY-MM-DD.' },
                    fechaFin: { type: 'STRING', description: 'Fecha y hora de término (opcional).' },
                    todoElDia: { type: 'BOOLEAN', description: 'Indica si dura todo el día (opcional).' }
                  },
                  required: ['titulo', 'tipo', 'fechaInicio']
                }
              },
              {
                name: 'sincronizarProyecto',
                description: 'Sincroniza los activos de la plataforma, base de datos y archivos de Google Drive.',
                parameters: {
                  type: 'OBJECT',
                  properties: {}
                }
              },
              {
                name: 'obtenerMetricas',
                description: 'Muestra un reporte consolidado con las métricas actuales del desarrollo de proyectos y tareas pendientes.',
                parameters: {
                  type: 'OBJECT',
                  properties: {}
                }
              },
              {
                name: 'registrarCumpleanos',
                description: 'Registra o actualiza la fecha de cumpleaños de un miembro del equipo en Firestore.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    miembroId: { type: 'STRING', description: 'El ID único del usuario/miembro.' },
                    fecha: { type: 'STRING', description: 'La fecha de cumpleaños en formato MM-DD (ej: "11-14").' }
                  },
                  required: ['miembroId', 'fecha']
                }
              },
              {
                name: 'gestionarCubeDesign',
                description: 'Gestiona la participación de la nómina técnica y el sembrado de hitos del evento CubeDesign 2026.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    accion: { type: 'STRING', enum: ['confirmar_miembro', 'desconfirmar_miembro', 'auditar_preparacion', 'crear_hitos'], description: 'La acción de gestión a ejecutar.' },
                    miembroId: { type: 'STRING', description: 'El ID del miembro a confirmar o desconfirmar (requerido solo si la acción es confirmar_miembro o desconfirmar_miembro).' }
                  },
                  required: ['accion']
                }
              },
              {
                name: 'auditarActaDrive',
                description: 'Audita y procesa un acta o minuta de reunión resumida del equipo de Google Drive para poblar Firestore con tareas y reuniones masivas.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    actaTexto: { type: 'STRING', description: 'El fragmento de texto o acuerdos contenidos en el acta de reunión.' }
                  },
                  required: ['actaTexto']
                }
              },
              {
                name: 'obtenerEstadoNoticiario',
                description: 'Obtiene el estado de despacho y log del último envío del noticiario o boletín semanal del equipo Cubesat.',
                parameters: {
                  type: 'OBJECT',
                  properties: {}
                }
              },
              {
                name: 'forzarEnvioNoticiario',
                description: 'Fuerza de forma inmediata el despacho del noticiario o boletín semanal de avances y próximos eventos a todos los miembros activos.',
                parameters: {
                  type: 'OBJECT',
                  properties: {}
                }
              }
            ]
          }
        ]
      : undefined

    // Build the user turn in the chat history
    const newParts: any[] = []
    if (fileData) {
      if (fileData.inlineData) {
        newParts.push({
          inlineData: {
            data: fileData.inlineData.data,
            mimeType: fileData.inlineData.mimeType
          }
        })
        newParts.push({ text: message })
      } else if (fileData.extractedText) {
        const formattedMessage = `[DOCUMENTO ADJUNTO: "${fileData.name}"]\n---\n${fileData.extractedText}\n---\n\nConsulta sobre el documento: ${message}`
        newParts.push({ text: formattedMessage })
      } else {
        newParts.push({ text: message })
      }
    } else {
      newParts.push({ text: message })
    }

    this.chatHistory.push({
      role: 'user',
      parts: newParts
    })

    // Trim history to avoid unbounded memory growth and oversized API payloads
    if (this.chatHistory.length > MAX_CHAT_HISTORY_TURNS * 2) {
      this.chatHistory = this.chatHistory.slice(-MAX_CHAT_HISTORY_TURNS * 2)
    }

    const activeUserId = userId || 'bot_admin_fallback'

    for (let attempt = this.activeModelIndex; attempt < MODEL_CANDIDATES.length; attempt++) {
      const modelName = MODEL_CANDIDATES[attempt]
      try {
        let functionCalls: any[] | undefined = undefined
        let responseJson: any = null
        let iterations = 0

        do {
          const secrets = await SecretsService.getSecrets()

          if (!secrets.driveUploadUrl || !secrets.driveUploadSecret) {
            throw new Error('drive-bridge-not-configured')
          }

          const payload = {
            action: 'chat',
            userEmail,
            model: modelName,
            contents: this.chatHistory,
            systemInstruction,
            tools: tools || undefined,
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 1000,
            }
          }

          const response = await fetch(secrets.driveUploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ secret: secrets.driveUploadSecret, ...payload })
          })

          if (!response.ok) {
            throw new Error(`drive-bridge-http-${response.status}`)
          }

          responseJson = await response.json()
          if (responseJson.error) {
            throw new Error(`drive-bridge-gemini-${responseJson.error}`)
          }

          // Parse function calls if any
          const firstCandidatePart = responseJson.candidates?.[0]?.content?.parts?.[0]
          functionCalls = firstCandidatePart?.functionCall ? [firstCandidatePart.functionCall] : undefined

          if (functionCalls && functionCalls.length > 0 && iterations < 3) {
            iterations++
            const functionCall = functionCalls[0]
            
            // Guardamos el turno del modelo que contiene la llamada a la función
            this.chatHistory.push(responseJson.candidates[0].content)

            let functionResult: any
            try {
              functionResult = await this.executeAdminAction(functionCall.name, functionCall.args, activeUserId, userRole)
            } catch (err) {
              functionResult = { 
                success: false, 
                message: `Error local de ejecución: ${err instanceof Error ? err.message : String(err)}` 
              }
            }

            // Inyectamos la respuesta de la función
            this.chatHistory.push({
              role: 'function',
              parts: [{
                functionResponse: {
                  name: functionCall.name,
                  response: { result: functionResult }
                }
              }]
            })
          } else {
            // Guardamos la respuesta final de texto del modelo en el historial
            if (responseJson.candidates?.[0]?.content) {
              this.chatHistory.push(responseJson.candidates[0].content)
            }
            break
          }
        } while (functionCalls && functionCalls.length > 0 && iterations < 3)

        this.activeModelIndex = attempt
        return responseJson.candidates?.[0]?.content?.parts?.[0]?.text || ''
      } catch (error) {
        logger.error('Error sending message via AI Proxy', {
          modelName,
          error: error instanceof Error ? error : undefined,
        })

        if (!this.isRecoverableModelError(error) || attempt === MODEL_CANDIDATES.length - 1) {
          this.resetSession()
          return "Hubo una interferencia espacial con mi señal de proxy. Por favor, intenta conectar nuevamente en unos segundos."
        }

        logger.warn('Retrying AI request via Proxy with fallback model', {
          failedModel: modelName,
          nextModel: MODEL_CANDIDATES[attempt + 1],
        })
      }
    }

    return "Hubo una interferencia espacial con mi señal de proxy. Por favor, intenta conectar nuevamente en unos segundos."
  }

  /**
   * Resuelve y ejecuta localmente la acción de administración solicitada de forma segura.
   */
  private static async executeAdminAction(name: string, args: any, userId: string, userRole?: string): Promise<any> {
    const isAuthorized = userRole === 'admin' || userRole === 'maestro' || userRole === 'manager'
    
    if (!isAuthorized) {
      return { 
        success: false, 
        message: 'Acceso Denegado: No cuentas con roles autorizados para realizar modificaciones.' 
      }
    }

    switch (name) {
      case 'crearTarea':
        return AdminActionsService.crearTarea(args, userId)
      case 'crearEvento':
        return AdminActionsService.crearEvento(args, userId)
      case 'sincronizarProyecto':
        return AdminActionsService.sincronizarProyecto(userId)
      case 'obtenerMetricas':
        return AdminActionsService.obtenerMetricas()
      case 'registrarCumpleanos':
        return AdminActionsService.registrarCumpleanos(args, userId)
      case 'gestionarCubeDesign':
        return AdminActionsService.gestionarCubeDesign(args, userId)
      case 'auditarActaDrive':
        return AdminActionsService.auditarActaDrive(args, userId)
      case 'obtenerEstadoNoticiario':
        return AdminActionsService.obtenerEstadoNoticiario()
      case 'forzarEnvioNoticiario':
        return AdminActionsService.forzarEnvioNoticiario(userId)
      default:
        return { 
          success: false, 
          message: `Acción ejecutiva "${name}" no está mapeada en el núcleo del sistema.` 
        }
    }
  }

  /**
   * Limpia el chat actual.
   */
  static resetSession() {
    this.chatSession = null
    this.chatHistory = []
    this.activeSessionRole = null
  }
}
