import JSZip from 'jszip'
import { ProcessedBotFile } from '@/types'

/**
 * Decodifica entidades HTML básicas de cadenas de texto XML.
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/**
 * Lee un archivo de texto plano en el navegador.
 */
function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.onerror = () => reject(reader.error || new Error('Error leyendo archivo de texto'))
    reader.readAsText(file, 'utf-8')
  })
}

/**
 * Convierte un archivo a base64 (removiendo el prefijo del data URI).
 */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Resultado inesperado de FileReader'))
        return
      }
      const commaIndex = result.indexOf(',')
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
    }
    reader.onerror = () => reject(reader.error || new Error('Error al codificar en Base64'))
    reader.readAsDataURL(file)
  })
}

/**
 * Extrae texto de un archivo Word (.docx) desempaquetando su XML en el cliente.
 */
async function parseDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)
  
  const documentXmlFile = zip.file('word/document.xml')
  if (!documentXmlFile) {
    throw new Error('No es un archivo Word válido: Falta word/document.xml')
  }

  const xmlText = await documentXmlFile.async('text')
  
  // Capturar todo el contenido entre etiquetas <w:t>...</w:t>
  const matches = xmlText.match(/<w:t[^>]*>(.*?)<\/w:t>/g)
  if (!matches) {
    return 'Documento de Word vacío o sin texto legible.'
  }

  const extracted = matches
    .map(match => {
      const content = match.replace(/<[^>]+>/g, '') // Eliminar etiquetas XML
      return decodeXmlEntities(content)
    })
    .join(' ')

  // Formatear párrafos y limpiar espacios duplicados
  return extracted.replace(/\s+/g, ' ').trim()
}

/**
 * Extrae texto de una presentación de PowerPoint (.pptx) ordenando y leyendo sus diapositivas XML.
 */
async function parsePptx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)
  
  // Buscar archivos de diapositiva: ppt/slides/slide1.xml, slide2.xml, etc.
  const slideFiles = Object.keys(zip.files).filter(path => 
    path.startsWith('ppt/slides/slide') && path.endsWith('.xml')
  )

  if (slideFiles.length === 0) {
    throw new Error('No es una presentación PowerPoint válida: No contiene diapositivas en ppt/slides/')
  }

  // Ordenar secuencialmente por el número de diapositiva
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.replace(/[^\d]/g, ''), 10)
    const numB = parseInt(b.replace(/[^\d]/g, ''), 10)
    return numA - numB
  })

  let fullText = ''

  for (const slidePath of slideFiles) {
    const slideNumber = slidePath.replace(/[^\d]/g, '')
    const slideXmlFile = zip.file(slidePath)
    if (!slideXmlFile) continue

    const xmlText = await slideXmlFile.async('text')
    
    // Capturar todo el contenido entre etiquetas <a:t>...</a:t> (nodos de texto en PowerPoint)
    const matches = xmlText.match(/<a:t[^>]*>(.*?)<\/a:t>/g)
    const slideText = matches
      ? matches
          .map(match => {
            const content = match.replace(/<[^>]+>/g, '') // Eliminar etiquetas XML
            return decodeXmlEntities(content)
          })
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
      : ''

    fullText += `--- DIAPOSITIVA ${slideNumber} ---\n${slideText || '[Diapositiva sin texto legible]'}\n\n`
  }

  return fullText.trim()
}

/**
 * Utilidad principal para procesar archivos y prepararlos para el Cubesat Bot.
 */
export class FileParser {
  static async processFile(file: File): Promise<ProcessedBotFile> {
    const name = file.name
    const mimeType = file.type || 'application/octet-stream'
    const size = file.size
    const extension = name.split('.').pop()?.toLowerCase() || ''

    // 1. Imágenes y PDFs: Enviados nativamente a Gemini
    if (
      mimeType.startsWith('image/') || 
      mimeType === 'application/pdf' || 
      ['png', 'jpg', 'jpeg', 'webp', 'pdf'].includes(extension)
    ) {
      // Ajustar tipo MIME alternativo para PDFs si está vacío
      const finalMime = mimeType === 'application/octet-stream' && extension === 'pdf' 
        ? 'application/pdf' 
        : mimeType

      const base64Data = await readAsBase64(file)
      return {
        name,
        mimeType: finalMime,
        size,
        inlineData: {
          data: base64Data,
          mimeType: finalMime
        }
      }
    }

    // 2. Archivos Word (.docx)
    if (extension === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const extractedText = await parseDocx(file)
      return {
        name,
        mimeType,
        size,
        extractedText
      }
    }

    // 3. Presentaciones PowerPoint (.pptx)
    if (extension === 'pptx' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      const extractedText = await parsePptx(file)
      return {
        name,
        mimeType,
        size,
        extractedText
      }
    }

    // 4. Archivos de texto planos y datos (.txt, .csv, .json, .md, .js, .ts, .html, .css)
    if (
      mimeType.startsWith('text/') || 
      ['txt', 'csv', 'json', 'md', 'js', 'ts', 'tsx', 'html', 'css'].includes(extension)
    ) {
      const extractedText = await readAsText(file)
      return {
        name,
        mimeType,
        size,
        extractedText
      }
    }

    // Fallback: intentar leer como texto, si falla lanzar error
    try {
      const extractedText = await readAsText(file)
      return {
        name,
        mimeType,
        size,
        extractedText
      }
    } catch {
      throw new Error(`El tipo de archivo ".${extension}" no está soportado por Cubesat Bot actualmente.`)
    }
  }
}
