import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { toString } from 'mdast-util-to-string';
import YAML from 'yaml';
import type { Root, ListItem } from 'mdast';
import type {
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketType,
  TicketEditablePatch,
  NewTicketInput,
  AcceptanceCriterion,
  ArchitectureDecision,
} from '../types/domain';

const VALID_STATUSES: TicketStatus[] = ['backlog', 'ready', 'in_progress', 'review', 'done'];
const VALID_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'critical'];
const VALID_TYPES: TicketType[] = ['epic', 'story', 'task', 'bug', 'lab'];

interface ExtractedFrontmatter {
  data: Record<string, unknown>;
  body: string;
}

export function extractFrontmatter(raw: string): ExtractedFrontmatter {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { data: {}, body: raw };
  }
  try {
    const parsed = YAML.parse(match[1]);
    const data =
      typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
    return { data, body: match[2] };
  } catch {
    return { data: {}, body: raw };
  }
}

export function parseMarkdownAst(markdownBody: string): Root {
  const processor = unified().use(remarkParse).use(remarkGfm);
  return processor.parse(markdownBody);
}

function normalizeStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.map((item) => String(item).trim()).filter(Boolean);
}

export function extractSummaryFromAst(ast: Root): string {
  for (const node of ast.children) {
    if (node.type === 'paragraph') {
      const text = toString(node).replace(/\s+/g, ' ').trim();
      if (text.length > 0) {
        return text;
      }
    }
  }
  return '';
}

function extractChecklistFromAst(ast: Root): AcceptanceCriterion[] {
  const criteria: AcceptanceCriterion[] = [];
  let index = 0;

  function visitNode(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const typed = node as { type?: string; checked?: boolean | null; children?: unknown[] };

    if (typed.type === 'listItem' && typeof typed.checked === 'boolean') {
      const listItem = typed as unknown as ListItem;
      criteria.push({
        index,
        text: toString(listItem).trim(),
        completed: Boolean(listItem.checked),
      });
      index += 1;
    }

    if (Array.isArray(typed.children)) {
      for (const child of typed.children) {
        visitNode(child);
      }
    }
  }

  visitNode(ast);
  return criteria;
}

export function parseTicketFile(
  filename: string,
  rawContent: string,
  lastModified: number
): Ticket {
  const { data, body } = extractFrontmatter(rawContent);
  const ast = parseMarkdownAst(body);

  const rawStatus = String(data.status ?? 'backlog').toLowerCase() as TicketStatus;
  const status: TicketStatus = VALID_STATUSES.includes(rawStatus) ? rawStatus : 'backlog';

  const rawPriority = String(data.priority ?? 'medium').toLowerCase() as TicketPriority;
  const priority: TicketPriority = VALID_PRIORITIES.includes(rawPriority) ? rawPriority : 'medium';

  const rawType = String(data.type ?? 'task').toLowerCase() as TicketType;
  const type: TicketType = VALID_TYPES.includes(rawType) ? rawType : 'task';

  const fallbackId = filename.replace(/\.md$/i, '').toUpperCase();

  return {
    filename,
    lastModified,
    rawContent,
    id: String(data.id ?? fallbackId),
    title: String(data.title ?? fallbackId),
    summary: extractSummaryFromAst(ast),
    type,
    status,
    priority,
    tags: normalizeStringArray(data.tags),
    concepts: normalizeStringArray(data.concepts),
    dependencies: normalizeStringArray(data.dependencies),
    decisions: normalizeStringArray(data.decisions),
    acceptanceCriteria: extractChecklistFromAst(ast),
    ast,
  };
}

export function parseDecisionFile(
  filename: string,
  rawContent: string,
  lastModified: number
): ArchitectureDecision {
  const { data, body } = extractFrontmatter(rawContent);
  const ast = parseMarkdownAst(body);
  const fallbackId = filename.replace(/\.md$/i, '').toUpperCase();

  const validStatuses = ['proposed', 'accepted', 'deprecated', 'superseded'] as const;
  const rawStatus = String(data.status ?? 'accepted').toLowerCase();
  const status = (validStatuses as readonly string[]).includes(rawStatus)
    ? (rawStatus as ArchitectureDecision['status'])
    : 'accepted';

  return {
    filename,
    lastModified,
    id: String(data.id ?? fallbackId),
    title: String(data.title ?? fallbackId),
    status,
    date: String(data.date ?? 'Sem data'),
    ast,
  };
}

function upsertScalarInFrontmatter(rawContent: string, key: string, value: string): string {
  const frontmatterRegex = /^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?[\s\S]*)$/;
  const match = rawContent.match(frontmatterRegex);

  if (!match) {
    return `---\n${key}: ${value}\n---\n\n${rawContent}`;
  }

  const [, open, yamlBlock, rest] = match;
  const lineRegex = new RegExp(`^${key}\\s*:.*$`, 'm');
  if (lineRegex.test(yamlBlock)) {
    const updatedYaml = yamlBlock.replace(lineRegex, `${key}: ${value}`);
    return `${open}${updatedYaml}${rest}`;
  }

  return `${open}${yamlBlock}\n${key}: ${value}${rest}`;
}

function formatYamlScalar(value: string): string {
  if (/[:#[\]{}&*!|>'"%@`]/.test(value) || value.trim() !== value) {
    return JSON.stringify(value);
  }
  return value;
}

function formatYamlInlineArray(items: string[]): string {
  const cleaned = items.map((item) => item.trim()).filter(Boolean);
  if (cleaned.length === 0) return '[]';
  return `[${cleaned.map((item) => formatYamlScalar(item)).join(', ')}]`;
}

/**
 * Surgically updates only the `status:` line in YAML frontmatter
 * to avoid unnecessary diffs across the user's Markdown file.
 */
export function updateTicketStatusInRaw(rawContent: string, newStatus: TicketStatus): string {
  return upsertScalarInFrontmatter(rawContent, 'status', newStatus);
}

/**
 * Surgically updates only the `priority:` line in YAML frontmatter.
 */
export function updateTicketPriorityInRaw(
  rawContent: string,
  newPriority: TicketPriority
): string {
  return upsertScalarInFrontmatter(rawContent, 'priority', newPriority);
}

/**
 * Surgically updates only the `type:` line in YAML frontmatter.
 */
export function updateTicketTypeInRaw(rawContent: string, newType: TicketType): string {
  return upsertScalarInFrontmatter(rawContent, 'type', newType);
}

/**
 * Updates multiple editable fields (title, type, status, priority, tags, and Markdown body)
 * while keeping all other frontmatter fields intact.
 */
export function updateTicketFieldsInRaw(
  rawContent: string,
  patch: TicketEditablePatch
): string {
  let nextRaw = rawContent;

  if (patch.title !== undefined) {
    nextRaw = upsertScalarInFrontmatter(nextRaw, 'title', formatYamlScalar(patch.title.trim()));
  }
  if (patch.type !== undefined) {
    nextRaw = updateTicketTypeInRaw(nextRaw, patch.type);
  }
  if (patch.status !== undefined) {
    nextRaw = updateTicketStatusInRaw(nextRaw, patch.status);
  }
  if (patch.priority !== undefined) {
    nextRaw = updateTicketPriorityInRaw(nextRaw, patch.priority);
  }
  if (patch.tags !== undefined) {
    nextRaw = upsertScalarInFrontmatter(nextRaw, 'tags', formatYamlInlineArray(patch.tags));
  }

  if (patch.body !== undefined) {
    const frontmatterRegex = /^(---\r?\n[\s\S]*?\r?\n---)\r?\n?([\s\S]*)$/;
    const match = nextRaw.match(frontmatterRegex);
    const normalizedBody = patch.body.replace(/^\r?\n+/, '');
    if (match) {
      nextRaw = `${match[1]}\n\n${normalizedBody}`;
    } else {
      nextRaw = normalizedBody;
    }
  }

  return nextRaw;
}

export function extractBodyFromRaw(rawContent: string): string {
  return extractFrontmatter(rawContent).body.replace(/^\r?\n+/, '');
}

/**
 * Surgically toggles the state of the N-th Markdown checkbox (- [ ] or - [x]).
 */
export function toggleCriterionInRaw(rawContent: string, targetIndex: number): string {
  let currentIndex = 0;
  return rawContent.replace(
    /^(\s*[-*+]\s+\[)([ xX])(\]\s+.*)$/gm,
    (fullMatch, prefix, check, suffix) => {
      if (currentIndex === targetIndex) {
        currentIndex += 1;
        const nextCheck = check === ' ' ? 'x' : ' ';
        return `${prefix}${nextCheck}${suffix}`;
      }
      currentIndex += 1;
      return fullMatch;
    }
  );
}

/**
 * Generates a valid Markdown ticket file for `.jiraiya/tickets/`.
 */
export function serializeNewTicketMarkdown(input: NewTicketInput): string {
  const cleanId = input.id.trim().toUpperCase();
  const cleanTitle = input.title.trim();
  const tagsLine = formatYamlInlineArray(input.tags);
  const criteriaLines = input.criteria
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => `- [ ] ${c}`);

  const sections: string[] = [];
  if (input.summary.trim()) {
    sections.push(`## Context & Goals\n${input.summary.trim()}`);
  }
  if (criteriaLines.length > 0) {
    sections.push(`## Acceptance Criteria\n${criteriaLines.join('\n')}`);
  }

  const body = sections.length > 0 ? `\n${sections.join('\n\n')}\n` : '\n';

  return `---
id: ${formatYamlScalar(cleanId)}
title: ${formatYamlScalar(cleanTitle)}
type: ${input.type}
status: ${input.status}
priority: ${input.priority}
tags: ${tagsLine}
concepts: []
dependencies: []
decisions: []
---
${body}`;
}

/**
 * Suggests the next sequential ticket ID based on existing tickets in the workspace.
 */
export function suggestNextTicketId(existingTickets: Ticket[]): string {
  let prefix = 'JIR';
  let maxNumber = 100;

  for (const ticket of existingTickets) {
    const match = ticket.id.trim().match(/^([A-Za-z]+)-(\d+)$/);
    if (match) {
      prefix = match[1].toUpperCase();
      const num = Number.parseInt(match[2], 10);
      if (!Number.isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  return `${prefix}-${String(maxNumber + 1).padStart(3, '0')}`;
}
