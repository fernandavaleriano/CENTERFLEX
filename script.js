document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.header');
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');

    const updateHeaderState = () => {
        header.classList.toggle('is-scrolled', window.scrollY > 12);
    };

    updateHeaderState();
    window.addEventListener('scroll', updateHeaderState, { passive: true });

    menuToggle.addEventListener('click', () => {
        const isActive = navMenu.classList.toggle('active');
        menuToggle.setAttribute('aria-expanded', isActive);
        navMenu.style.top = header.offsetHeight + 'px';

        const icon = menuToggle.querySelector('i');
        if (isActive) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-xmark');
        } else {
            icon.classList.remove('fa-xmark');
            icon.classList.add('fa-bars');
        }
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

    // --- PRODUCT IMAGE SLIDER ---
    document.querySelectorAll('[data-slider]').forEach(slider => {
        const images = Array.from(slider.querySelectorAll('img'));
        const arrows = Array.from(slider.querySelectorAll('.pcard-arrow'));
        const dots = Array.from(slider.querySelectorAll('.dot'));

        if (images.length < 2) return;

        let activeIndex = 0;

        const showImage = (nextIndex) => {
            images[activeIndex].classList.remove('is-active');
            if (dots[activeIndex]) dots[activeIndex].classList.remove('is-active');

            activeIndex = (nextIndex + images.length) % images.length;

            images[activeIndex].classList.add('is-active');
            if (dots[activeIndex]) dots[activeIndex].classList.add('is-active');
        };

        arrows.forEach(arrow => {
            arrow.addEventListener('click', (e) => {
                e.stopPropagation();
                const direction = arrow.dataset.direction;
                showImage(direction === 'prev' ? activeIndex - 1 : activeIndex + 1);
            });
        });
    });

    // --- ACTIVE NAV LINK ON SCROLL ---
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

    // ─── LIGHTBOX ─────────────────────────────────────────────
    const lightbox     = document.getElementById('lightbox');
    const lightboxImg  = document.getElementById('lightbox-img');
    const lightboxClose = lightbox.querySelector('.lightbox-close');
    const lightboxPrev  = lightbox.querySelector('.lightbox-arrow-left');
    const lightboxNext  = lightbox.querySelector('.lightbox-arrow-right');
    const lightboxCounter = document.getElementById('lightbox-counter');

    let lightboxImages = [];
    let lightboxIndex  = 0;

    function openLightbox(images, index) {
        lightboxImages = images;
        lightboxIndex  = index;
        lightboxImg.src = images[index].src;
        lightboxImg.alt = images[index].alt;
        lightbox.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        updateLightboxNav();
    }

    function closeLightbox() {
        lightbox.classList.remove('is-open');
        document.body.style.overflow = '';
        lightboxImages = [];
        lightboxIndex  = 0;
    }

    function goToImage(index) {
        if (!lightboxImages.length) return;
        lightboxIndex = (index + lightboxImages.length) % lightboxImages.length;
        lightboxImg.src = lightboxImages[lightboxIndex].src;
        lightboxImg.alt = lightboxImages[lightboxIndex].alt;
        updateLightboxNav();
    }

    function updateLightboxNav() {
        const many = lightboxImages.length > 1;
        lightboxPrev.style.display = many ? '' : 'none';
        lightboxNext.style.display = many ? '' : 'none';
        lightboxCounter.style.display = many ? '' : 'none';
        if (many) lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
    }

    // Clique nas imagens dos produtos
    document.querySelectorAll('.pcard-img').forEach(imgWrapper => {
        imgWrapper.addEventListener('click', (e) => {
            // Ignora clique nas setas do slider
            if (e.target.closest('.pcard-arrow')) return;

            const images = Array.from(imgWrapper.querySelectorAll('img'));
            if (!images.length) return;

            // Para sliders usa a imagem ativa; para cards simples usa a primeira
            const isSlider = imgWrapper.hasAttribute('data-slider');
            let activeIndex = 0;

            if (isSlider) {
                images.forEach((img, i) => {
                    if (img.classList.contains('is-active')) activeIndex = i;
                });
            }
            // Caso nenhuma tenha is-active, activeIndex permanece 0 (seguro)

            openLightbox(images, activeIndex);
        });

        // Cursor de ponteiro para indicar que é clicável
        imgWrapper.style.cursor = 'zoom-in';
    });

    lightboxClose.addEventListener('click', closeLightbox);

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    lightboxPrev.addEventListener('click', () => goToImage(lightboxIndex - 1));
    lightboxNext.addEventListener('click', () => goToImage(lightboxIndex + 1));

    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('is-open')) return;
        if (e.key === 'Escape')     closeLightbox();
        if (e.key === 'ArrowLeft')  goToImage(lightboxIndex - 1);
        if (e.key === 'ArrowRight') goToImage(lightboxIndex + 1);
    });

    // Swipe no lightbox (mobile)
    let touchStartX = 0;
    lightbox.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox.addEventListener('touchend', (e) => {
        const diff = touchStartX - e.changedTouches[0].screenX;
        if (Math.abs(diff) > 50) goToImage(lightboxIndex + (diff > 0 ? 1 : -1));
    }, { passive: true });
});

// ─── SWIPE NOS SLIDERS (cards) ──────────────────────────────
document.querySelectorAll("[data-slider]").forEach(slider => {
    const images = slider.querySelectorAll("img");
    const dots   = slider.querySelectorAll(".dot");

    let current = 0;
    let startX  = 0;

    function showSlide(index) {
        images.forEach((img, i) => img.classList.toggle("is-active", i === index));
        dots.forEach((dot, i)   => dot.classList.toggle("is-active", i === index));
        current = index;
    }

    slider.addEventListener("touchstart", e => {
        startX = e.touches[0].clientX;
    }, { passive: true });

    slider.addEventListener("touchend", e => {
        const dist = startX - e.changedTouches[0].clientX;
        if (Math.abs(dist) < 50) return;
        showSlide(dist > 0
            ? (current + 1) % images.length
            : (current - 1 + images.length) % images.length
        );
    }, { passive: true });
});