import { createTablesStore } from './tables-store.mjs';

function send(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body), ...headers });
  res.end(body);
}
async function bytes(req, limit) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size <= limit) chunks.push(chunk); }
  if (size > limit) throw Object.assign(new Error('Слишком большой запрос'), { status: 413 });
  return Buffer.concat(chunks);
}
async function body(req) {
  const raw = await bytes(req, 2 * 1024 * 1024);
  try {
    const value = JSON.parse(raw.toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw Object.assign(new Error('Ожидается объект JSON'), { status: 400 }); }
}
/** Mount BEFORE createApi: the existing character handler consumes unknown /api paths. */
export function createTablesApi({ store, charactersStore, dataDir, demoPlayer } = {}) {
  const tables = store || createTablesStore({ dataDir, charactersStore, demoPlayer });
  return async function handleTablesApi(req, res) {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname); }
    catch { send(res, 400, { error: 'Некорректный адрес' }); return true; }
    const table = pathname.match(/^\/api\/tables\/([^/]+)$/);
    const heroCombat = pathname.match(/^\/api\/table-hero-combat\/([^/]+)$/);
    const view = pathname.match(/^\/api\/tables\/([^/]+)\/board-view$/);
    const image = pathname.match(/^\/api\/tables\/([^/]+)\/board-images\/([^/]+)$/);
    const template = pathname.match(/^\/api\/table-templates\/([^/]+)$/);
    if (!table && !template && !view && !image && !heroCombat && !['/api/tables', '/api/table-command', '/api/table-templates'].includes(pathname)) return false;
    const allow = image || view ? 'GET, PUT' : table || heroCombat ? 'GET' : template ? 'DELETE' : pathname === '/api/table-command' ? 'POST' : pathname === '/api/table-templates' ? 'GET, PUT' : 'GET';
    if (!allow.split(', ').includes(req.method)) { send(res, 405, { error: 'Метод не поддерживается' }, { Allow: allow }); return true; }
    try {
      if (view) send(res, 200, req.method === 'GET' ? await tables.readBoardView(view[1]) : await tables.writeBoardView(view[1], await body(req)));
      else if (image && req.method === 'PUT') {
        if (req.headers['content-type'] !== 'image/webp') { send(res, 415, { error: 'Ожидается изображение WebP' }); return true; }
        await tables.uploadBoardImage(image[1], image[2], await bytes(req, 8 * 1024 * 1024));
        send(res, 200, { ok: true });
      } else if (image) {
        const data = await tables.readBoardImage(image[1], image[2]);
        res.writeHead(200, { 'Content-Type': 'image/webp', 'Cache-Control': 'no-store', 'Content-Length': data.length, 'X-Content-Type-Options': 'nosniff' });
        res.end(data);
      } else if (table) send(res, 200, await tables.read(table[1]));
      else if (heroCombat) send(res, 200, await tables.readHeroCombat(heroCombat[1]));
      else if (template) { await tables.deleteTemplate(template[1]); send(res, 200, { ok: true }); }
      else if (pathname === '/api/tables') send(res, 200, { tables: await tables.list() });
      else if (pathname === '/api/table-command') {
        const value = await body(req);
        if (!Object.hasOwn(value, 'tableId')) throw Object.assign(new Error('Требуется tableId'), { status: 400 });
        send(res, 200, await tables.command(value.tableId, value.command));
      } else if (req.method === 'GET') send(res, 200, { templates: await tables.templates() });
      else send(res, 200, await tables.saveTemplate(await body(req)));
    } catch (error) {
      // Never log command bodies, scenes, character documents or SQL errors.
      const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
      send(res, status, { error: status >= 500 ? 'Внутренняя ошибка' : error.message });
    }
    return true;
  };
}
