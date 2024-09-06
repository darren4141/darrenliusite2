// Add event listener to navbar links
document.querySelectorAll('header nav a').forEach(link => {
    link.addEventListener('click', event => {
        // Prevent default link behavior
        event.preventDefault();

        // Get the target section
        const targetSection = document.querySelector(link.getAttribute('href'));

        // Scroll to the target section with animation
        targetSection.scrollIntoView({ behavior: 'smooth' });
    });
});

// Add event listener to carousel buttons
document.querySelectorAll('.carousel-button').forEach(button => {
    button.addEventListener('click', event => {
        const carousel = button.closest('.carousel');
        const slides = carousel.querySelectorAll('.carousel-slide');
        const activeSlide = carousel.querySelector('.carousel-slide.active');
        const index = Array.prototype.indexOf.call(slides, activeSlide);
        let newIndex;

        if (button.classList.contains('left')) {
            newIndex = (index - 1 + slides.length) % slides.length;
        } else {
            newIndex = (index + 1) % slides.length;
        }

        slides.forEach(slide => slide.classList.remove('active'));
        slides[newIndex].classList.add('active');
    });
});