document.addEventListener('DOMContentLoaded', async () => {
    const WHATSAPP_PHONE = '5531999116222';
    const header = document.querySelector('.header');
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const productsGrid = document.querySelector('[data-products-grid]');

    const escapeHtml = (value = '') => String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const buildWhatsappUrl = (productName) => {
        const message = `Olá, quero saber mais sobre ${productName}.`;
        return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
    };

    const renderProductCard = (product) => {
        const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
        const hasSlider = images.length > 1;
        const imageMarkup = images.map((src, index) => (
            `<img src="${escapeHtml(src)}" alt="${escapeHtml(product.name)}${hasSlider ? ` - imagem ${index + 1}` : ''}"${index === 0 ? ' class="is-active"' : ''}>`
        )).join('');
        const controls = hasSlider ? `
            <button class="pcard-arrow pcard-arrow-left" type="button" data-direction="prev" aria-label="Ver imagem anterior">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <button class="pcard-arrow pcard-arrow-right" type="button" data-direction="next" aria-label="Ver próxima imagem">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
            <div class="pcard-dots">${images.map((_, index) => `<span class="dot${index === 0 ? ' is-active' : ''}"></span>`).join('')}</div>
        ` : '';

        return `
            <div class="pcard">
                <div class="pcard-img"${hasSlider ? ' data-slider' : ''}>
                    ${imageMarkup || '<div class="pcard-placeholder">Sem imagem</div>'}
                    ${controls}
                </div>
                <div class="pcard-body">
                    <p class="pcard-title">${escapeHtml(product.name)}</p>
                    <p class="pcard-desc">${escapeHtml(product.description)}</p>
                    <a href="${buildWhatsappUrl(product.name)}" class="btn-wa" target="_blank" rel="noopener noreferrer">
                        Atendimento WhatsApp
                    </a>
                </div>
            </div>
        `;
    };

    const loadProducts = async () => {
        if (!productsGrid) return;

        try {
            const apiUrl = typeof API_URL !== 'undefined' ? API_URL.replace(/\/+$/, '') : '';
            const response = await fetch(apiUrl + '/api/products', { cache: 'no-store' });
            if (!response.ok) throw new Error('API indisponivel');
            const products = await response.json();
            if (!Array.isArray(products)) throw new Error('Resposta invalida');
            productsGrid.innerHTML = products.map(renderProductCard).join('');
        } catch (error) {
            console.info('Usando produtos estaticos do HTML:', error.message);
        }
    };

    const updateHeaderState = () => {
        if (!header) return;
        header.classList.toggle('is-scrolled', window.scrollY > 12);
    };

    const setupMenu = () => {
        if (!menuToggle || !navMenu || !header) return;

        menuToggle.addEventListener('click', () => {
            const isActive = navMenu.classList.toggle('active');
            menuToggle.setAttribute('aria-expanded', isActive);
            navMenu.style.top = header.offsetHeight + 'px';

            const icon = menuToggle.querySelector('i');
            icon.classList.toggle('fa-bars', !isActive);
            icon.classList.toggle('fa-xmark', isActive);
        });

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', false);
                const icon = menuToggle.querySelector('i');
                icon.classList.remove('fa-xmark');
                icon.classList.add('fa-bars');
            });
        });
    };

    const setupSliders = () => {
        document.querySelectorAll('[data-slider]').forEach(slider => {
            const images = Array.from(slider.querySelectorAll('img'));
            const arrows = Array.from(slider.querySelectorAll('.pcard-arrow'));
            const dots = Array.from(slider.querySelectorAll('.dot'));

            if (images.length < 2) return;

            let activeIndex = images.findIndex(img => img.classList.contains('is-active'));
            if (activeIndex < 0) activeIndex = 0;
            let touchStartX = 0;

            const showImage = (nextIndex) => {
                images[activeIndex].classList.remove('is-active');
                if (dots[activeIndex]) dots[activeIndex].classList.remove('is-active');

                activeIndex = (nextIndex + images.length) % images.length;

                images[activeIndex].classList.add('is-active');
                if (dots[activeIndex]) dots[activeIndex].classList.add('is-active');
            };

            arrows.forEach(arrow => {
                arrow.addEventListener('click', (event) => {
                    event.stopPropagation();
                    showImage(arrow.dataset.direction === 'prev' ? activeIndex - 1 : activeIndex + 1);
                });
            });

            slider.addEventListener('touchstart', event => {
                touchStartX = event.touches[0].clientX;
            }, { passive: true });

            slider.addEventListener('touchend', event => {
                const distance = touchStartX - event.changedTouches[0].clientX;
                if (Math.abs(distance) < 50) return;
                showImage(distance > 0 ? activeIndex + 1 : activeIndex - 1);
            }, { passive: true });
        });
    };

    const setupActiveNav = () => {
        const sections = document.querySelectorAll('section[id], .hero');
        const navLinks = document.querySelectorAll('.nav-link');

        const updateActiveLink = () => {
            let current = '';
            const scrollPos = window.scrollY + 100;

            sections.forEach(section => {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.offsetHeight;
                if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                    current = section.getAttribute('id') || 'inicio';
                }
            });

            navLinks.forEach(link => {
                link.classList.remove('active');
                const href = link.getAttribute('href');
                if (href === `#${current}` || (current === 'inicio' && href === '#')) {
                    link.classList.add('active');
                }
            });
        };

        updateActiveLink();
        window.addEventListener('scroll', updateActiveLink, { passive: true });
    };

    const setupLightbox = () => {
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = document.getElementById('lightbox-img');
        const lightboxClose = lightbox?.querySelector('.lightbox-close');
        const lightboxPrev = lightbox?.querySelector('.lightbox-arrow-left');
        const lightboxNext = lightbox?.querySelector('.lightbox-arrow-right');
        const lightboxCounter = document.getElementById('lightbox-counter');

        if (!lightbox || !lightboxImg || !lightboxClose || !lightboxPrev || !lightboxNext || !lightboxCounter) return;

        let lightboxImages = [];
        let lightboxIndex = 0;
        let touchStartX = 0;

        const updateLightboxNav = () => {
            const many = lightboxImages.length > 1;
            lightboxPrev.style.display = many ? '' : 'none';
            lightboxNext.style.display = many ? '' : 'none';
            lightboxCounter.style.display = many ? '' : 'none';
            if (many) lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
        };

        const openLightbox = (images, index) => {
            lightboxImages = images;
            lightboxIndex = index;
            lightboxImg.src = images[index].src;
            lightboxImg.alt = images[index].alt;
            lightbox.classList.add('is-open');
            document.body.style.overflow = 'hidden';
            updateLightboxNav();
        };

        const closeLightbox = () => {
            lightbox.classList.remove('is-open');
            document.body.style.overflow = '';
            lightboxImages = [];
            lightboxIndex = 0;
        };

        const goToImage = (index) => {
            if (!lightboxImages.length) return;
            lightboxIndex = (index + lightboxImages.length) % lightboxImages.length;
            lightboxImg.src = lightboxImages[lightboxIndex].src;
            lightboxImg.alt = lightboxImages[lightboxIndex].alt;
            updateLightboxNav();
        };

        document.querySelectorAll('.pcard-img').forEach(imgWrapper => {
            imgWrapper.addEventListener('click', (event) => {
                if (event.target.closest('.pcard-arrow')) return;

                const images = Array.from(imgWrapper.querySelectorAll('img'));
                if (!images.length) return;

                const activeIndex = Math.max(0, images.findIndex(img => img.classList.contains('is-active')));
                openLightbox(images, activeIndex);
            });

            imgWrapper.style.cursor = 'zoom-in';
        });

        lightboxClose.addEventListener('click', closeLightbox);
        lightbox.addEventListener('click', event => {
            if (event.target === lightbox) closeLightbox();
        });
        lightboxPrev.addEventListener('click', () => goToImage(lightboxIndex - 1));
        lightboxNext.addEventListener('click', () => goToImage(lightboxIndex + 1));

        document.addEventListener('keydown', event => {
            if (!lightbox.classList.contains('is-open')) return;
            if (event.key === 'Escape') closeLightbox();
            if (event.key === 'ArrowLeft') goToImage(lightboxIndex - 1);
            if (event.key === 'ArrowRight') goToImage(lightboxIndex + 1);
        });

        lightbox.addEventListener('touchstart', event => {
            touchStartX = event.changedTouches[0].screenX;
        }, { passive: true });

        lightbox.addEventListener('touchend', event => {
            const diff = touchStartX - event.changedTouches[0].screenX;
            if (Math.abs(diff) > 50) goToImage(lightboxIndex + (diff > 0 ? 1 : -1));
        }, { passive: true });
    };

    await loadProducts();
    updateHeaderState();
    setupMenu();
    setupSliders();
    setupActiveNav();
    setupLightbox();
    window.addEventListener('scroll', updateHeaderState, { passive: true });
});
