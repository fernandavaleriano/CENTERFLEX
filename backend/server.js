const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const loadEnvFile = () => {
    try {
        const envPath = path.join(ROOT_DIR, '.env');
        const envFile = require('fs').readFileSync(envPath, 'utf8');

        envFile.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;

            const separatorIndex = trimmed.indexOf('=');
            if (separatorIndex === -1) return;

            const key = trimmed.slice(0, separatorIndex).trim();
            const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
            if (key && process.env[key] === undefined) {
                process.env[key] = value;
            }
        });
    } catch {
        // .env is optional in production when variables are configured by the host.
    }
};

loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const UPLOADS_DIR = path.join(ROOT_DIR, 'imagens', 'uploads');
const sessions = new Set();

if (!ADMIN_PASSWORD) {
    console.error('Configure ADMIN_PASSWORD no arquivo .env ou nas variaveis do servidor.');
    process.exit(1);
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.jfif': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml'
};

const sendJson = (res, status, data) => {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(data));
};

const readBody = (req) => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
        body += chunk;
        if (body.length > 1_000_000) {
            req.destroy();
            reject(new Error('Payload muito grande'));
        }
    });
    req.on('end', () => {
        try {
            resolve(body ? JSON.parse(body) : {});
        } catch {
            reject(new Error('JSON invalido'));
        }
    });
    req.on('error', reject);
});

const readRawBody = (req) => new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', chunk => {
        chunks.push(chunk);
        size += chunk.length;
        if (size > 8_000_000) {
            req.destroy();
            reject(new Error('Imagem muito grande'));
        }
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
});

const slugify = (value) => String(value || 'produto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'produto';

const loadProducts = async () => {
    const file = await fs.readFile(PRODUCTS_FILE, 'utf8');
    return JSON.parse(file);
};

const saveProducts = async (products) => {
    await fs.writeFile(PRODUCTS_FILE, `${JSON.stringify(products, null, 2)}\n`, 'utf8');
};

const normalizeProduct = (input, fallbackId) => {
    const name = String(input.name || '').trim();
    const description = String(input.description || '').trim();
    const images = Array.isArray(input.images)
        ? input.images.map(image => String(image).trim()).filter(Boolean)
        : [];

    if (!name) throw new Error('Nome do produto e obrigatorio');
    if (!description) throw new Error('Descricao do produto e obrigatoria');

    return {
        id: String(input.id || fallbackId || slugify(name)).trim(),
        name,
        description,
        images
    };
};

const requireAdmin = (req, res) => {
    const token = req.headers['x-admin-token'];
    if (token && sessions.has(token)) return true;
    sendJson(res, 401, { error: 'Login necessario para alterar produtos' });
    return false;
};

const handleLoginApi = async (req, res) => {
    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Metodo nao permitido' });
    }

    const body = await readBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) {
        return sendJson(res, 401, { error: 'Usuario ou senha invalidos' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    sessions.add(token);
    sendJson(res, 200, { token, username });
};

const parseMultipartFiles = (req, bodyBuffer) => {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) throw new Error('Formulario de upload invalido');

    const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`;
    const body = bodyBuffer.toString('latin1');
    const parts = body.split(boundary).slice(1, -1);

    return parts.map(part => {
        const cleanPart = part.replace(/^\r\n/, '').replace(/\r\n$/, '');
        const separatorIndex = cleanPart.indexOf('\r\n\r\n');
        if (separatorIndex === -1) return null;

        const rawHeaders = cleanPart.slice(0, separatorIndex);
        const rawContent = cleanPart.slice(separatorIndex + 4);
        const disposition = rawHeaders.match(/content-disposition:.*name="([^"]+)".*filename="([^"]*)"/i);
        const type = rawHeaders.match(/content-type:\s*([^\r\n]+)/i);

        if (!disposition || !disposition[2]) return null;

        return {
            field: disposition[1],
            filename: disposition[2],
            contentType: type ? type[1].trim().toLowerCase() : '',
            buffer: Buffer.from(rawContent, 'latin1')
        };
    }).filter(Boolean);
};

const safeUploadName = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    const base = slugify(path.basename(filename, ext));
    return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${base}${ext}`;
};

const handleUploadApi = async (req, res) => {
    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Metodo nao permitido' });
    }

    if (!requireAdmin(req, res)) return;

    const files = parseMultipartFiles(req, await readRawBody(req));
    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
    const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.jfif', '.webp']);
    const saved = [];

    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    for (const file of files) {
        const ext = path.extname(file.filename).toLowerCase();
        if (!allowedTypes.has(file.contentType) && !allowedExtensions.has(ext)) {
            throw new Error('Envie apenas imagens PNG, JPG, JPEG, JFIF ou WEBP');
        }

        const filename = safeUploadName(file.filename);
        await fs.writeFile(path.join(UPLOADS_DIR, filename), file.buffer);
        saved.push(`imagens/uploads/${filename}`);
    }

    if (!saved.length) {
        return sendJson(res, 400, { error: 'Nenhuma imagem enviada' });
    }

    sendJson(res, 201, { images: saved });
};

const handleProductsApi = async (req, res, pathname) => {
    const id = decodeURIComponent(pathname.replace(/^\/api\/products\/?/, ''));

    if (req.method === 'GET' && pathname === '/api/products') {
        return sendJson(res, 200, await loadProducts());
    }

    if (!requireAdmin(req, res)) return;

    if (req.method === 'POST' && pathname === '/api/products') {
        const products = await loadProducts();
        const body = await readBody(req);
        let product = normalizeProduct(body, slugify(body.name));
        const baseId = product.id;
        let suffix = 2;
        while (products.some(item => item.id === product.id)) {
            product.id = `${baseId}-${suffix}`;
            suffix += 1;
        }
        products.push(product);
        await saveProducts(products);
        return sendJson(res, 201, product);
    }

    if (req.method === 'PUT' && id) {
        const products = await loadProducts();
        const index = products.findIndex(product => product.id === id);
        if (index === -1) return sendJson(res, 404, { error: 'Produto nao encontrado' });
        products[index] = normalizeProduct({ ...await readBody(req), id }, id);
        await saveProducts(products);
        return sendJson(res, 200, products[index]);
    }

    if (req.method === 'DELETE' && id) {
        const products = await loadProducts();
        const nextProducts = products.filter(product => product.id !== id);
        if (nextProducts.length === products.length) return sendJson(res, 404, { error: 'Produto nao encontrado' });
        await saveProducts(nextProducts);
        return sendJson(res, 200, { ok: true });
    }

    sendJson(res, 405, { error: 'Metodo nao permitido' });
};

const serveStatic = async (req, res, pathname) => {
    const requestedPath = pathname === '/' ? '/index.html' : pathname;
    const safePath = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(ROOT_DIR, safePath);
    const resolved = path.resolve(filePath);

    if (!resolved.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        return res.end('Acesso negado');
    }

    try {
        const file = await fs.readFile(resolved);
        const ext = path.extname(resolved).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(file);
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Arquivo nao encontrado');
    }
};

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token'
};

const server = http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        return res.end();
    }

    // Add CORS to all responses
    const originalWriteHead = res.writeHead.bind(res);
    res.writeHead = (statusCode, headers) => {
        headers = headers || {};
        if (!headers['Access-Control-Allow-Origin']) {
            headers = { ...corsHeaders, ...headers };
        }
        return originalWriteHead(statusCode, headers);
    };

    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        if (url.pathname === '/api/login') {
            await handleLoginApi(req, res);
            return;
        }
        if (url.pathname === '/api/uploads') {
            await handleUploadApi(req, res);
            return;
        }
        if (url.pathname.startsWith('/api/products')) {
            await handleProductsApi(req, res, url.pathname);
            return;
        }
        await serveStatic(req, res, url.pathname);
    } catch (error) {
        sendJson(res, 500, { error: error.message || 'Erro interno' });
    }
});

server.listen(PORT, () => {
    console.log(`Centerflex rodando em http://localhost:${PORT}`);
    console.log(`Painel admin: http://localhost:${PORT}/admin.html`);
    console.log(`Login padrao: ${ADMIN_USER} / ${ADMIN_PASSWORD}`);
});
