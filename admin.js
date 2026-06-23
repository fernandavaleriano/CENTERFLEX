const loginShell = document.getElementById('login-shell');
const adminShell = document.getElementById('admin-shell');
const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const usernameInput = document.getElementById('admin-username');
const passwordInput = document.getElementById('admin-password');
const logoutButton = document.getElementById('logout-button');
const form = document.getElementById('product-form');
const formTitle = document.getElementById('form-title');
const productId = document.getElementById('product-id');
const productName = document.getElementById('product-name');
const productDescription = document.getElementById('product-description');
const imagePreviewList = document.getElementById('image-preview-list');
const imageFiles = document.getElementById('product-image-files');
const imageUrl = document.getElementById('product-image-url');
const productsList = document.getElementById('admin-products');
const statusText = document.getElementById('status');

let products = [];
let imagePaths = [];

const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const getToken = () => sessionStorage.getItem('centerflexAdminToken') || '';

const setStatus = (message) => {
    statusText.textContent = message;
};

const setLoginStatus = (message) => {
    loginStatus.textContent = message;
};

const showLogin = () => {
    adminShell.classList.add('is-hidden');
    loginShell.classList.remove('is-hidden');
    passwordInput.value = '';
    usernameInput.focus();
};

const showAdmin = () => {
    loginShell.classList.add('is-hidden');
    adminShell.classList.remove('is-hidden');
};

const api = (path) => `${API_URL.replace(/\/+$/, '')}${path}`;

const request = async (path, options = {}) => {
    const isFormData = options.body instanceof FormData;
    const headers = {
        'x-admin-token': getToken(),
        ...(options.headers || {})
    };

    if (!isFormData) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
        const response = await fetch(api(path), {
            ...options,
            headers,
            signal: controller.signal
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Erro ao conversar com a API');
        return data;
    } finally {
        clearTimeout(timeout);
    }
};

const renderImageManager = () => {
    if (!imagePaths.length) {
        imagePreviewList.innerHTML = '<p class="image-empty">Nenhuma imagem adicionada ainda.</p>';
        return;
    }

    imagePreviewList.innerHTML = imagePaths.map((src, index) => `
        <div class="image-preview">
            <img src="${escapeHtml(src)}" alt="Imagem ${index + 1}">
            <button class="danger" type="button" data-remove-image="${index}" aria-label="Remover imagem">X</button>
        </div>
    `).join('');
};

const setImages = (images = []) => {
    imagePaths = Array.isArray(images) ? images.filter(Boolean) : [];
    renderImageManager();
};

const clearForm = () => {
    productId.value = '';
    productName.value = '';
    productDescription.value = '';
    imageUrl.value = '';
    imageFiles.value = '';
    setImages([]);
    formTitle.textContent = 'Adicionar produto';
    productName.focus();
};

const imgUrl = (src) => {
    if (!src) return '';
    if (src.startsWith('http')) return src;
    const baseUrl = API_URL.replace(/\/+$/, '');
    return `${baseUrl}/${src.replace(/^\//, '')}`;
};

const renderProducts = () => {
    if (!products.length) {
        productsList.innerHTML = '<p>Nenhum produto cadastrado.</p>';
        return;
    }

    productsList.innerHTML = products.map(product => `
        <article class="admin-product">
            <img src="${escapeHtml(imgUrl(product.images?.[0]))}" alt="${escapeHtml(product.name)}">
            <div>
                <h3>${escapeHtml(product.name)}</h3>
                <p>${escapeHtml(product.description)}</p>
                <small>${product.images?.length || 0} imagem(ns)</small>
            </div>
            <div class="product-actions">
                <button type="button" data-action="edit" data-id="${escapeHtml(product.id)}">Editar</button>
                <button class="danger" type="button" data-action="delete" data-id="${escapeHtml(product.id)}">Remover</button>
            </div>
        </article>
    `).join('');
};

const loadProducts = async () => {
    setStatus('Carregando produtos...');
    products = await request('/api/products');
    renderProducts();
    setStatus('Produtos carregados.');
};

const fillForm = (product) => {
    productId.value = product.id;
    productName.value = product.name;
    productDescription.value = product.description;
    imageUrl.value = '';
    imageFiles.value = '';
    setImages(product.images || []);
    formTitle.textContent = 'Editar produto';
    productName.focus();
};

const uploadSelectedImages = async () => {
    if (!imageFiles.files.length) return;

    const formData = new FormData();
    Array.from(imageFiles.files).forEach(file => {
        formData.append('images', file);
    });

    setStatus('Enviando imagem...');
    const data = await request('/api/uploads', {
        method: 'POST',
        body: formData
    });

    // Converte caminhos relativos para URL completa do Render
    const baseUrl = API_URL.replace(/\/+$/, '');
    const fullPaths = data.images.map(img =>
        img.startsWith('http') ? img : `${baseUrl}/${img.replace(/^\//, '')}`
    );
    setImages([...imagePaths, ...fullPaths]);
    imageFiles.value = '';
    setStatus('Imagem adicionada. Clique em salvar produto para publicar.');
};

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setLoginStatus('Entrando...');

    try {
        const data = await request('/api/login', {
            method: 'POST',
            body: JSON.stringify({
                username: usernameInput.value.trim(),
                password: passwordInput.value
            })
        });

        sessionStorage.setItem('centerflexAdminToken', data.token);
        showAdmin();
        await loadProducts();
        setLoginStatus('');
    } catch (error) {
        sessionStorage.removeItem('centerflexAdminToken');
        setLoginStatus(error.message);
    }
});

logoutButton.addEventListener('click', () => {
    sessionStorage.removeItem('centerflexAdminToken');
    clearForm();
    showLogin();
});

document.getElementById('clear-form').addEventListener('click', clearForm);
document.getElementById('reload-products').addEventListener('click', () => {
    loadProducts().catch(error => setStatus(error.message));
});

document.getElementById('add-image-url').addEventListener('click', () => {
    const value = imageUrl.value.trim();
    if (!value) return;
    setImages([...imagePaths, value]);
    imageUrl.value = '';
    setStatus('Imagem adicionada. Clique em salvar produto para publicar.');
});

imageFiles.addEventListener('change', () => {
    uploadSelectedImages().catch(error => {
        setStatus(error.message);
        if (error.message.includes('Login')) showLogin();
    });
});

imagePreviewList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-image]');
    if (!button) return;

    const index = Number(button.dataset.removeImage);
    setImages(imagePaths.filter((_, currentIndex) => currentIndex !== index));
    setStatus('Imagem removida da lista. Clique em salvar produto para publicar.');
});

productsList.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const product = products.find(item => item.id === button.dataset.id);
    if (!product) return;

    if (button.dataset.action === 'edit') {
        fillForm(product);
        return;
    }

    if (!confirm(`Remover "${product.name}"?`)) return;

    try {
        await request(`/api/products/${encodeURIComponent(product.id)}`, { method: 'DELETE' });
        await loadProducts();
        clearForm();
        setStatus('Produto removido. O site ja recebe essa alteracao pela API.');
    } catch (error) {
        setStatus(error.message);
        if (error.message.includes('Login')) showLogin();
    }
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
        name: productName.value.trim(),
        description: productDescription.value.trim(),
        images: imagePaths
    };

    try {
        if (productId.value) {
            await request(`/api/products/${encodeURIComponent(productId.value)}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            setStatus('Produto atualizado. O site ja recebe essa alteracao pela API.');
        } else {
            await request('/api/products', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            setStatus('Produto adicionado. O site ja recebe essa alteracao pela API.');
        }

        await loadProducts();
        clearForm();
    } catch (error) {
        setStatus(error.message);
        if (error.message.includes('Login')) showLogin();
    }
});

if (getToken()) {
    showAdmin();
    loadProducts().catch(() => showLogin());
} else {
    showLogin();
}
