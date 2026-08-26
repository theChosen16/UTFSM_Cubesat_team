export interface ReviewAuthor {
  login?: string | null;
  __typename?: string | null;
}

export interface ReviewComment {
  id?: string;
  author?: ReviewAuthor | null;
  body?: string | null;
  path?: string | null;
  line?: number | null;
  createdAt?: string | null;
}

export interface ReviewThread {
  id: string;
  isResolved: boolean;
  comments?: {
    nodes?: ReviewComment[];
  };
}

export interface UnresolvedBotThreadSummary {
  id: string;
  author: string;
  authorType?: string | null;
  path?: string | null;
  line?: number | null;
  bodyPreview: string;
  createdAt?: string | null;
}

export const KNOWN_BOT_LOGINS = [
  'sentry',
  'sentry[bot]',
  'coderabbitai',
  'coderabbitai[bot]',
  'codecov',
  'codecov[bot]',
  'sonarcloud',
  'sonarcloud[bot]',
  'github-actions',
  'github-actions[bot]',
  'copilot',
  'copilot[bot]',
  'gemini-code-assist',
  'gemini-code-assist[bot]',
];

/**
 * Determina si el autor de un comentario es un bot revisor conocido.
 */
export function isBotAuthor(author?: ReviewAuthor | null): boolean {
  if (!author) return false;
  if (author.__typename === 'Bot') return true;
  const login = (author.login || '').toLowerCase();
  if (login.endsWith('[bot]')) return true;
  return KNOWN_BOT_LOGINS.includes(login);
}

/**
 * Filtra los hilos de revisión devolviendo únicamente aquellos que no están resueltos
 * y cuyo comentario principal fue generado por un bot.
 */
export function filterUnresolvedBotThreads(threads?: ReviewThread[] | null): UnresolvedBotThreadSummary[] {
  const unresolvedBotThreads: UnresolvedBotThreadSummary[] = [];

  for (const thread of threads || []) {
    if (thread.isResolved) continue;
    const firstComment = thread.comments?.nodes?.[0];
    if (!firstComment) continue;

    if (isBotAuthor(firstComment.author)) {
      unresolvedBotThreads.push({
        id: thread.id,
        author: firstComment.author?.login || 'unknown-bot',
        authorType: firstComment.author?.__typename,
        path: firstComment.path,
        line: firstComment.line,
        bodyPreview: firstComment.body
          ? firstComment.body.substring(0, 150).replace(/\r?\n/g, ' ')
          : '',
        createdAt: firstComment.createdAt,
      });
    }
  }

  return unresolvedBotThreads;
}
