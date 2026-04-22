import { GoogleGenerativeAI, ChatSession, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { ProjectService } from './ProjectService'
import { TaskService } from './TaskService'
import { logger } from '@/lib/logger'

// Obtiene la API Key con prefijo VITE para Vite localmente.
const API_KEY = import.meta.env.VITE_GOOGLE_AI_KEY
const MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'] as const

let genAI: GoogleGenerativeAI | null = null
if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY)
}

export class BotService {
  private static chatSession: ChatSession | null = null
  private static activeModelIndex = 0

  private static isRecoverableModelError(error: unknown): boolean {
    const status = (error as { status?: number })?.status
    const message = String((error as Error)?.message || '').toLowerCase()

    return status === 404 ||
      message.includes('404') ||
      message.includes('not found') ||
      message.includes('model') && message.includes('not') && (message.includes('available') || message.includes('found') || message.includes('supported'))
  }

  private static async createChatSession(modelName: string): Promise<ChatSession> {
    const domainContext = await this.getDomainContext()

    const systemInstruction = `Eres "Cubesat Bot", el asistente de inteligencia artificial oficial del equipo USM Cubesat Team (Universidad Técnica Federico Santa María).
Tus reglas son estrictas e inquebrantables:
1. DEBES enfocarte NETAMENTE en fines de proyectos aeroespaciales atingentes al Cubesat. Si te preguntan sobre temas no relacionados a programación, aeronáutica, ciencia espacial, robótica, gestión de misión, o tareas actuales del equipo, debes amablemente negar la respuesta indicando tu propósito.
2. Tienes una perspectiva crítica y evalúas las opciones de desarrollo y diseño de componentes o arquitectura considerando múltiples variables (peso, radiación estelar, redundancia, estrés mecánico, consumo energético, software constraints).
3. Eres fanático de los sistemas Sencillos y Robustos, y debes recalcar que es mejor ser funcional antes que sobre-diseñar. 
4. Tu objetivo a largo plazo es ayudar al equipo a iterar proyectos. Piensa a largo plazo. 
5. Tienes acceso a la base de datos viva del equipo. Aquí está el contexto actual: 
${domainContext}

Usa este contexto para referenciar, cuando te pregunten qué hay que hacer o cómo ayudar, tareas pendientes de los miembros, etc. Sé breve y estructurado en tus respuestas. Trata al usuario con respeto y estilo ingenieril.`

    const model = genAI!.getGenerativeModel({
      model: modelName,
      systemInstruction,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }
      ]
    })

    return model.startChat({
      generationConfig: {
        temperature: 0.5,
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
   * Inicializa la sesión de Chat con las instrucciones y reglas estrcitas del modelo.
   */
  static async startSession(): Promise<boolean> {
    if (!genAI) {
      logger.error('Google AI API Key no está configurada o es inválida.')
      return false
    }

    for (let index = 0; index < MODEL_CANDIDATES.length; index++) {
      const modelName = MODEL_CANDIDATES[index]

      try {
        this.chatSession = await this.createChatSession(modelName)
        this.activeModelIndex = index
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
   */
  static async sendMessage(message: string): Promise<string> {
    if (!this.chatSession) {
      const initSuccess = await this.startSession()
      if (!initSuccess || !this.chatSession) return "Error crítico: El núcleo de IA no pudo ser inicializado. Verifica la configuración de la clave en el entorno local."
    }

    for (let attempt = this.activeModelIndex; attempt < MODEL_CANDIDATES.length; attempt++) {
      try {
        if (!this.chatSession || attempt !== this.activeModelIndex) {
          this.chatSession = await this.createChatSession(MODEL_CANDIDATES[attempt])
          this.activeModelIndex = attempt
        }

        const result = await this.chatSession.sendMessage(message)
        return result.response.text()
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
   * Limpia el chat actual.
   */
  static resetSession() {
    this.chatSession = null
  }
}
