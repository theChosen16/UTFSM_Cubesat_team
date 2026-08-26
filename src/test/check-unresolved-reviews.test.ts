import { describe, expect, it } from 'vitest';
import { filterUnresolvedBotThreads, isBotAuthor, ReviewThread } from '@/lib/botReviewResolution';

describe('check-unresolved-reviews', () => {
  describe('isBotAuthor', () => {
    it('identifies Bot typename as bot', () => {
      expect(isBotAuthor({ __typename: 'Bot', login: 'app-bot' })).toBe(true);
    });

    it('identifies logins ending with [bot] as bot', () => {
      expect(isBotAuthor({ __typename: 'User', login: 'sentry[bot]' })).toBe(true);
      expect(isBotAuthor({ __typename: 'User', login: 'coderabbitai[bot]' })).toBe(true);
      expect(isBotAuthor({ __typename: 'User', login: 'github-actions[bot]' })).toBe(true);
    });

    it('identifies known bot logins regardless of casing', () => {
      expect(isBotAuthor({ __typename: 'User', login: 'sentry' })).toBe(true);
      expect(isBotAuthor({ __typename: 'User', login: 'Sentry' })).toBe(true);
      expect(isBotAuthor({ __typename: 'User', login: 'coderabbitai' })).toBe(true);
      expect(isBotAuthor({ __typename: 'User', login: 'sonarcloud' })).toBe(true);
      expect(isBotAuthor({ __typename: 'User', login: 'codecov' })).toBe(true);
    });

    it('returns false for human users and null values', () => {
      expect(isBotAuthor({ __typename: 'User', login: 'theChosen16' })).toBe(false);
      expect(isBotAuthor({ __typename: 'User', login: 'alean' })).toBe(false);
      expect(isBotAuthor(null)).toBe(false);
      expect(isBotAuthor(undefined)).toBe(false);
    });
  });

  describe('filterUnresolvedBotThreads', () => {
    it('returns empty array when all threads are resolved', () => {
      const threads: ReviewThread[] = [
        {
          id: 'thread-1',
          isResolved: true,
          comments: {
            nodes: [
              { author: { login: 'sentry', __typename: 'User' }, path: 'src/file.ts', line: 10, body: 'Bug found' }
            ]
          }
        },
        {
          id: 'thread-2',
          isResolved: true,
          comments: {
            nodes: [
              { author: { login: 'coderabbitai[bot]', __typename: 'Bot' }, path: 'src/auth.ts', line: 50, body: 'Style issue' }
            ]
          }
        }
      ];

      expect(filterUnresolvedBotThreads(threads)).toEqual([]);
    });

    it('filters out unresolved threads authored by humans and keeps unresolved bot threads', () => {
      const threads: ReviewThread[] = [
        {
          id: 'thread-resolved-bot',
          isResolved: true,
          comments: {
            nodes: [
              { author: { login: 'sentry', __typename: 'User' }, path: 'src/a.ts', line: 10, body: 'Resolved bot comment' }
            ]
          }
        },
        {
          id: 'thread-unresolved-human',
          isResolved: false,
          comments: {
            nodes: [
              { author: { login: 'theChosen16', __typename: 'User' }, path: 'src/b.ts', line: 20, body: 'Question from maintainer' }
            ]
          }
        },
        {
          id: 'thread-unresolved-bot',
          isResolved: false,
          comments: {
            nodes: [
              { author: { login: 'sentry', __typename: 'User' }, path: 'src/c.ts', line: 30, body: 'Unresolved security bug in code' }
            ]
          }
        }
      ];

      const result = filterUnresolvedBotThreads(threads);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'thread-unresolved-bot',
        author: 'sentry',
        path: 'src/c.ts',
        line: 30,
        bodyPreview: 'Unresolved security bug in code'
      });
    });

    it('handles empty or malformed thread lists gracefully', () => {
      expect(filterUnresolvedBotThreads([])).toEqual([]);
      expect(filterUnresolvedBotThreads(null)).toEqual([]);
      expect(filterUnresolvedBotThreads([{ id: 'empty', isResolved: false, comments: { nodes: [] } }])).toEqual([]);
    });
  });
});
