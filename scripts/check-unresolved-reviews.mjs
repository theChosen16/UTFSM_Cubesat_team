#!/usr/bin/env node

/**
 * Script para verificar si existen conversaciones / hilos de revisión abiertos
 * dejados por bots revisores (Sentry/Seer, CodeRabbit, Copilot, etc.) en un PR.
 *
 * Puede ejecutarse tanto en GitHub Actions como localmente usando el CLI de GitHub (`gh`).
 */

import { spawnSync } from 'child_process';

const KNOWN_BOT_LOGINS = [
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

function isBotAuthor(author) {
  if (!author) return false;
  if (author.__typename === 'Bot') return true;
  const login = (author.login || '').toLowerCase();
  if (login.endsWith('[bot]')) return true;
  return KNOWN_BOT_LOGINS.includes(login);
}

function filterUnresolvedBotThreads(threads) {
  const unresolvedBotThreads = [];

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

export function runCheck(prNumber, owner = 'theChosen16', repo = 'UTFSM_Cubesat_team') {
  console.log(`🔍 Verificando hilos de revisión en PR #${prNumber} (${owner}/${repo})...`);

  const query = `query($owner: String!, $repo: String!, $pr: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100) {
          nodes {
            id
            isResolved
            comments(first: 5) {
              nodes {
                id
                author {
                  login
                  __typename
                }
                body
                path
                line
                createdAt
              }
            }
          }
        }
      }
    }
  }`;

  const ghProcess = spawnSync('gh', [
    'api',
    'graphql',
    '-f', `query=${query}`,
    '-F', `owner=${owner}`,
    '-F', `repo=${repo}`,
    '-F', `pr=${prNumber}`
  ], {
    encoding: 'utf8',
    shell: false
  });

  if (ghProcess.error) {
    console.error('Error al invocar gh CLI:', ghProcess.error.message);
    process.exit(1);
  }

  if (ghProcess.status !== 0) {
    console.error('Error devuelto por gh CLI:', ghProcess.stderr);
    process.exit(ghProcess.status || 1);
  }

  try {
    const data = JSON.parse(ghProcess.stdout);
    const threads = data.data?.repository?.pullRequest?.reviewThreads?.nodes || [];
    console.log(`Total de hilos de revisión encontrados: ${threads.length}`);

    const unresolved = filterUnresolvedBotThreads(threads);

    if (unresolved.length > 0) {
      console.error(`\n❌ ERROR: Se encontraron ${unresolved.length} conversaciones de bots sin resolver:`);
      for (const t of unresolved) {
        console.error(`  - [${t.author}] en ${t.path}:${t.line || '?'} -> "${t.bodyPreview}..."`);
      }
      console.error('\n⚠️ Debes atender y marcar como resueltas todas las conversaciones de bots antes de mergear.\n');
      process.exit(1);
    } else {
      console.log('✅ Todas las conversaciones de bots revisores están resueltas (o no hay ninguna abierta).');
      process.exit(0);
    }
  } catch (error) {
    console.error('Error al procesar la respuesta JSON:', error.message);
    process.exit(1);
  }
}

// Ejecución directa si se llama por CLI
if (process.argv[1] && process.argv[1].includes('check-unresolved-reviews.mjs')) {
  const prArg = process.argv[2] || process.env.PR_NUMBER || '93';
  runCheck(parseInt(prArg, 10));
}
