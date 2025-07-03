// Create sparkle effects
function createSparkle() {
    const container = document.querySelector('.container');
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle';
    
    // Random position
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;
    
    // Random size
    const size = Math.random() * 6 + 4;
    sparkle.style.width = `${size}px`;
    sparkle.style.height = `${size}px`;
    
    // Random animation delay
    sparkle.style.animationDelay = `${Math.random() * 2}s`;
    
    // Random color variation
    const colors = ['#ff69b4', '#ffb6c1', '#e6e6fa', '#d8bfd8', '#ffc0cb'];
    sparkle.style.background = colors[Math.floor(Math.random() * colors.length)];
    
    container.appendChild(sparkle);
    
    // Remove sparkle after animation
    setTimeout(() => {
        sparkle.remove();
    }, 2000);
}

// Create initial sparkles
for (let i = 0; i < 15; i++) {
    setTimeout(() => {
        createSparkle();
    }, i * 300);
}

// Continuous sparkles
setInterval(createSparkle, 500);

// Add subtle interactive effect
document.querySelector('.domain-container').addEventListener('mouseover', function() {
    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            createSparkle();
        }, i * 100);
    }
});