// Lógica para abrir/fechar o Menu Hambúrguer no Mobile
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

    document.querySelectorAll('[data-slider]').forEach(slider => {
        const images = Array.from(slider.querySelectorAll('img'));
        const arrows = Array.from(slider.querySelectorAll('.pcard-arrow'));
        const dots = Array.from(slider.querySelectorAll('.dot'));

        if (images.length < 2) return;

        let activeIndex = 0;

        const showImage = (nextIndex) => {
            images[activeIndex].classList.remove('is-active');
            if (dots[activeIndex]) {
                dots[activeIndex].classList.remove('is-active');
            }
            
            activeIndex = (nextIndex + images.length) % images.length;
            
            images[activeIndex].classList.add('is-active');
            if (dots[activeIndex]) {
                dots[activeIndex].classList.add('is-active');
            }
        };

        arrows.forEach(arrow => {
            arrow.addEventListener('click', () => {
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

    // --- SCROLL REVEAL ---
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal-visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    document.querySelectorAll('.reveal').forEach(el => {
        revealObserver.observe(el);
    });
});

document.querySelectorAll("[data-slider]").forEach(slider => {
    const images = slider.querySelectorAll("img");
    const dots = slider.querySelectorAll(".dot");

    let current = 0;
    let startX = 0;
    let endX = 0;

    function showSlide(index) {
        images.forEach((img, i) => {
            img.classList.toggle("is-active", i === index);
        });

        dots.forEach((dot, i) => {
            dot.classList.toggle("is-active", i === index);
        });

        current = index;
    }

    slider.addEventListener("touchstart", e => {
        startX = e.touches[0].clientX;
    });

    slider.addEventListener("touchend", e => {
        endX = e.changedTouches[0].clientX;

        const distance = startX - endX;

        if (Math.abs(distance) < 50) return;

        if (distance > 0) {
            // esquerda
            showSlide((current + 1) % images.length);
        } else {
            // direita
            showSlide((current - 1 + images.length) % images.length);
        }
    });
});