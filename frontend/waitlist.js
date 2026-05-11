const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3050/api' 
    : 'https://voxachat-jbyj.onrender.com/api'; 

document.addEventListener('DOMContentLoaded', () => {
    // === COUNTDOWN LOGIC ===
    // Target date: August 10, 2026 (Exactly 3 months from May 10, 2026)
    const targetDate = new Date('August 10, 2026 00:00:00').getTime();

    const updateCountdown = () => {
        const now = new Date().getTime();
        const distance = targetDate - now;

        if (distance < 0) {
            document.getElementById('countdown').innerHTML = "LAUNCH SEQUENCE INITIATED";
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        document.getElementById('days').innerText = days.toString().padStart(2, '0');
        document.getElementById('hours').innerText = hours.toString().padStart(2, '0');
        document.getElementById('minutes').innerText = minutes.toString().padStart(2, '0');
        document.getElementById('seconds').innerText = seconds.toString().padStart(2, '0');
    };

    // Update the count down every 1 second
    setInterval(updateCountdown, 1000);
    updateCountdown(); // Initial call


    // === FORM LOGIC ===
    const waitlistForm = document.getElementById('waitlistForm');
    const waitlistBtn = document.getElementById('waitlistBtn');

    if (waitlistForm) {
        waitlistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('waitlistEmail');
            const usernameInput = document.getElementById('waitlistUsername');
            const email = emailInput.value;
            const username = usernameInput ? usernameInput.value : '';
            const originalText = waitlistBtn.innerHTML;

            try {
                waitlistBtn.innerHTML = 'SECURING SPOT...';
                waitlistBtn.disabled = true;

                // Attempt real transmission
                const res = await fetch(`${API_BASE}/waitlist`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, username })
                });
                
                const data = await res.json();

                if (data.success) {
                    // Store user data for the dashboard
                    localStorage.setItem('voxa_user', JSON.stringify(data.user));
                    showSuccess();
                } else {
                    alert(data.error || 'Failed to join waitlist.');
                    waitlistBtn.innerHTML = originalText;
                    waitlistBtn.disabled = false;
                }
            } catch (err) {
                alert('Network Error. Please ensure the backend server is running.');
                waitlistBtn.innerHTML = originalText;
                waitlistBtn.disabled = false;
            }

            function showSuccess() {
                waitlistForm.innerHTML = `
                    <div class="success-message" style="background: rgba(0, 229, 255, 0.1); border: 1px solid #00e5ff; padding: 25px; border-radius: 15px; animation: fadeIn 0.5s ease-out;">
                        <div style="font-size: 40px; margin-bottom: 15px;">✓</div>
                        <h3 style="color: #00e5ff; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px;">Access Granted</h3>
                        <p style="margin: 0; color: #fff; line-height: 1.6;">Welcome <strong>${username || 'Operator'}</strong>! Your network ID has been prioritized. Clearance protocols have been dispatched to your inbox.</p>
                        <button onclick="window.location.href='dashboard.html'" style="margin-top: 20px; background: #00e5ff; border: none; color: #0b0d17; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-weight: 800; width: 100%;">Enter Control Center</button>
                    </div>
                `;
            }
        });
    }

    // === NAVIGATION LOGIC ===
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-link');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Close menu when a link is clicked
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }
});
