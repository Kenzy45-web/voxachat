const isLocalhost = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.hostname || window.location.protocol === 'file:');
const isCapacitor = typeof window !== 'undefined' && (window.Capacitor || window.location.protocol === 'capacitor:');
const API_BASE = (isLocalhost && !isCapacitor)
    ? 'http://localhost:3050/api' 
    : 'https://voxachat-jbyj.onrender.com/api'; 

document.addEventListener('DOMContentLoaded', () => {

    // === COUNTDOWN LOGIC ===
    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');
    const countdownEl = document.getElementById('countdown');

    if (daysEl && hoursEl && minutesEl && secondsEl) {
        // Target date: August 10, 2026 (Exactly 3 months from May 10, 2026)
        const targetDate = new Date('August 10, 2026 00:00:00').getTime();

        const updateCountdown = () => {
            const now = new Date().getTime();
            const distance = targetDate - now;

            if (distance < 0) {
                if (countdownEl) countdownEl.innerHTML = "<p style='color:var(--primary-color);font-weight:800;letter-spacing:2px;'>LAUNCH SEQUENCE INITIATED</p>";
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            daysEl.innerText = days.toString().padStart(2, '0');
            hoursEl.innerText = hours.toString().padStart(2, '0');
            minutesEl.innerText = minutes.toString().padStart(2, '0');
            secondsEl.innerText = seconds.toString().padStart(2, '0');
        };

        setInterval(updateCountdown, 1000);
        updateCountdown();
    }


    // === FORM LOGIC ===
    const waitlistForm = document.getElementById('waitlistForm');
    const waitlistBtn = document.getElementById('waitlistBtn');

    if (waitlistForm && waitlistBtn) {
        waitlistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('waitlistEmail');
            const usernameInput = document.getElementById('waitlistUsername');
            const email = emailInput ? emailInput.value : '';
            const username = usernameInput ? usernameInput.value : '';
            const originalText = waitlistBtn.innerHTML;

            if (!email) {
                alert('Please enter a valid email address.');
                return;
            }

            try {
                waitlistBtn.innerHTML = 'SECURING SPOT...';
                waitlistBtn.disabled = true;

                const res = await fetch(`${API_BASE}/waitlist`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, username })
                });
                
                const data = await res.json();

                if (data.success) {
                    showSuccess();
                } else {
                    alert(data.error || 'Failed to join waitlist. Please try again.');
                    waitlistBtn.innerHTML = originalText;
                    waitlistBtn.disabled = false;
                }
            } catch (err) {
                console.error('Waitlist submission error:', err);
                alert('Network Error. Could not reach the server. Please try again later.');
                waitlistBtn.innerHTML = originalText;
                waitlistBtn.disabled = false;
            }

            function showSuccess() {
                waitlistForm.innerHTML = `
                    <div class="success-message" style="background: rgba(0, 229, 255, 0.1); border: 1px solid #00e5ff; padding: 30px 25px; border-radius: 15px; animation: fadeIn 0.5s ease-out; text-align: center;">
                        <div style="font-size: 50px; margin-bottom: 15px;">✓</div>
                        <h3 style="color: #00e5ff; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px;">Access Granted</h3>
                        <p style="margin: 0; color: #fff; line-height: 1.6;">Your network ID has been prioritized. Clearance protocols have been dispatched to your inbox.</p>
                        <button onclick="location.reload()" style="margin-top: 20px; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-family: inherit;">← Back</button>
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

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });
    }
});
