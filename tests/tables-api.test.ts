import { afterEach, describe, expect, it, vi } from 'vitest';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createTablesApi } from '../server/tables-api.mjs';

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(cleanups.splice(0).map(fn => fn())); });
async function setup(options?: Parameters<typeof createTablesApi>[0]) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dss-tables-api-'));
  const handler = createTablesApi(options || { dataDir });
  const server = http.createServer(async (req, res) => { if (!await handler(req, res)) { res.writeHead(404); res.end('fallback'); } });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanups.push(async () => { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); await fs.rm(dataDir, { recursive: true, force: true }); });
  const addr = server.address(); if (!addr || typeof addr === 'string') throw new Error('No server address');
  const request = (url: string, method = 'GET', value?: unknown) => fetch(`http://127.0.0.1:${addr.port}${url}`, { method, ...(value === undefined ? {} : { body: JSON.stringify(value), headers: { 'Content-Type': 'application/json' } }) });
  return { request };
}

describe('tables API mount', () => {
  it('serves repository shapes and yields character paths to existing handler', async () => {
    const { request } = await setup();
    expect(await (await request('/api/tables')).json()).toEqual({ tables: [] });
    const res = await request('/api/table-command', 'POST', { tableId: null, command: { type: 'create', operationId: 'create', payload: { name: 'Стол', memberName: 'Ведущий' } } });
    expect(res.status).toBe(200); expect(res.headers.get('cache-control')).toBe('no-store');
    const t = await res.json(); expect(t.actorId).toBe('local');
    expect(await (await request(`/api/tables/${t.id}`)).json()).toEqual(t);
    expect(await (await request('/api/tables')).json()).toMatchObject({ tables: [{ id: t.id }] });
    const stale = await request('/api/table-command', 'POST', { tableId: t.id, command: { type: 'rename', operationId: 'stale', expectedRevision: 9, payload: { name: 'Новое' } } });
    expect(stale.status).toBe(409);
    const wrong = await request('/api/tables', 'POST', {}); expect(wrong.status).toBe(405); expect(wrong.headers.get('allow')).toBe('GET');
    expect(await (await request('/api/characters')).text()).toBe('fallback');
    expect(await (await request('/other')).text()).toBe('fallback');
    expect((await request('/api/table-command', 'POST', { command: {} })).status).toBe(400);
    expect((await request('/api/table-command', 'POST', { tableId: null, command: { type: 'join', operationId: 'join', payload: {} } })).status).toBe(422);
  });
  it('saves versioned templates and deletes only the requested template', async () => {
    const { request } = await setup();
    const template = { id: 'item', name: 'Меч', kind: 'item', version: 0, item: { id: 'sword', name: 'Меч', category: 'gear', qty: 1, notes: '', equipped: false } };
    const saved = await (await request('/api/table-templates', 'PUT', template)).json(); expect(saved.version).toBe(1);
    expect((await request('/api/table-templates', 'PUT', template)).status).toBe(409);
    expect(await (await request('/api/table-templates')).json()).toEqual({ templates: [saved] });
    expect(await (await request('/api/table-templates/item', 'DELETE')).json()).toEqual({ ok: true });
    expect(await (await request('/api/table-templates')).json()).toEqual({ templates: [] });
  });
  it('never emits exception or command contents to responses or logs', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { request } = await setup({ store: { read: async () => { throw new Error('SECRET-MONSTER stamina 37'); } } });
    const res = await request('/api/tables/table');
    expect(res.status).toBe(500); expect(await res.json()).toEqual({ error: 'Внутренняя ошибка' });
    expect(log).not.toHaveBeenCalled();
  });
  it('rejects malformed and oversized JSON requests', async () => {
    const { request } = await setup();
    expect((await request('/api/table-command', 'POST', [])).status).toBe(400);
    expect((await request('/api/table-command', 'POST', { text: 'x'.repeat(2 * 1024 * 1024) })).status).toBe(413);
    expect((await request('/api/tables/%ZZ')).status).toBe(400);
  });
});
