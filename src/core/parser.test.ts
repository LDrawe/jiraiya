import { describe, it, expect } from 'vitest';
import {
  parseTicketFile,
  updateTicketStatusInRaw,
  updateTicketPriorityInRaw,
  updateTicketFieldsInRaw,
  toggleCriterionInRaw,
  serializeNewTicketMarkdown,
  suggestNextTicketId,
} from './parser';

const SAMPLE_TICKET = `---
id: MBL-101
title: Implement thread-safe in-memory queue
type: lab
status: ready
priority: high
tags: [concurrency, queue]
concepts: [Mutex, Ring Buffer]
dependencies: [MBL-100]
decisions: [ADR-001]
---

## Context
We need a robust thread-safe queue structure for multiple concurrent producers and consumers.

## Acceptance Criteria
- [ ] Support atomic enqueue and dequeue operations
- [x] Guarantee zero race conditions under heavy load
`;

describe('Ticket parser and non-destructive AST mutations', () => {
  it('parses frontmatter metadata, summary, and AST checkboxes accurately', () => {
    const ticket = parseTicketFile('MBL-101.md', SAMPLE_TICKET, 1700000000000);

    expect(ticket.id).toBe('MBL-101');
    expect(ticket.title).toBe('Implement thread-safe in-memory queue');
    expect(ticket.summary).toBe(
      'We need a robust thread-safe queue structure for multiple concurrent producers and consumers.'
    );
    expect(ticket.status).toBe('ready');
    expect(ticket.priority).toBe('high');
    expect(ticket.type).toBe('lab');
    expect(ticket.tags).toEqual(['concurrency', 'queue']);
    expect(ticket.concepts).toEqual(['Mutex', 'Ring Buffer']);
    expect(ticket.acceptanceCriteria).toHaveLength(2);
    expect(ticket.acceptanceCriteria[0]).toEqual({
      index: 0,
      text: 'Support atomic enqueue and dequeue operations',
      completed: false,
    });
    expect(ticket.acceptanceCriteria[1].completed).toBe(true);
  });

  it('updates ticket status while preserving the rest of the document intact', () => {
    const updated = updateTicketStatusInRaw(SAMPLE_TICKET, 'in_progress');
    expect(updated).toContain('status: in_progress');
    expect(updated).toContain('title: Implement thread-safe in-memory queue');
    expect(updated).toContain('- [ ] Support atomic enqueue and dequeue operations');
  });

  it('updates priority surgically while preserving other fields', () => {
    const updated = updateTicketPriorityInRaw(SAMPLE_TICKET, 'critical');
    const reparsed = parseTicketFile('MBL-101.md', updated, 1700000000000);

    expect(reparsed.priority).toBe('critical');
    expect(reparsed.status).toBe('ready');
    expect(reparsed.dependencies).toEqual(['MBL-100']);
  });

  it('updates editable fields in batch without dropping existing relationships', () => {
    const updated = updateTicketFieldsInRaw(SAMPLE_TICKET, {
      title: 'Concurrent queue with backpressure: v2',
      priority: 'low',
      type: 'task',
      tags: ['concurrency', 'backpressure'],
    });
    const reparsed = parseTicketFile('MBL-101.md', updated, 1700000000000);

    expect(reparsed.title).toBe('Concurrent queue with backpressure: v2');
    expect(reparsed.priority).toBe('low');
    expect(reparsed.type).toBe('task');
    expect(reparsed.tags).toEqual(['concurrency', 'backpressure']);
    expect(reparsed.decisions).toEqual(['ADR-001']);
  });

  it('toggles a specific acceptance criterion by index without affecting others', () => {
    const toggledFirst = toggleCriterionInRaw(SAMPLE_TICKET, 0);
    const reparsed = parseTicketFile('MBL-101.md', toggledFirst, 1700000000000);

    expect(reparsed.acceptanceCriteria[0].completed).toBe(true);
    expect(reparsed.acceptanceCriteria[1].completed).toBe(true);
  });

  it('serializes a valid new ticket and suggests the next sequential ID', () => {
    const existing = [parseTicketFile('MBL-101.md', SAMPLE_TICKET, 1700000000000)];
    const nextId = suggestNextTicketId(existing);
    expect(nextId).toBe('MBL-102');

    const raw = serializeNewTicketMarkdown({
      id: nextId,
      title: 'Add latency metrics',
      type: 'story',
      status: 'backlog',
      priority: 'medium',
      tags: ['observability'],
      summary: 'Expose wait time histograms in the queue.',
      criteria: ['Track p95 and p99 percentiles'],
    });

    const parsed = parseTicketFile('MBL-102.md', raw, 1700000000000);
    expect(parsed.id).toBe('MBL-102');
    expect(parsed.status).toBe('backlog');
    expect(parsed.summary).toBe('Expose wait time histograms in the queue.');
    expect(parsed.acceptanceCriteria).toHaveLength(1);
  });
});
