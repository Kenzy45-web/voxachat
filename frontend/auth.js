const API_BASE = 'http://localhost:3050/api';

window.togglePassword = function(inputId, iconElement) {
    const input = document.getElementById(inputId);
    const svg = iconElement.querySelector('svg');
    if (input.type === 'password') {
        input.type = 'text';
        svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        input.type = 'password';
        svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const otpForm = document.getElementById('otpForm');
    const forgotForm = document.getElementById('forgotForm');
    const googleLoginBtn = document.getElementById('googleLoginBtn');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btn = loginForm.querySelector('button');
            const originalText = btn.innerHTML;
            
            try {
                btn.innerHTML = 'CONNECTING...';
                btn.disabled = true;

                const res = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();

                if (data.success) {
                    alert('Connection Established! Welcome ' + data.username);
                    localStorage.setItem('voxa_token', data.token);
                    localStorage.setItem('voxa_username', data.username);
                    window.location.href = 'dashboard.html';
                } else {
                    alert(data.error || 'Connection Failed');
                }
            } catch (err) {
                alert('Network Error');
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btn = document.getElementById('signupBtn');
            const originalText = btn.innerHTML;
            
            try {
                btn.innerHTML = 'REQUESTING...';
                btn.disabled = true;

                const res = await fetch(`${API_BASE}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });
                const data = await res.json();

                if (data.success) {
                    alert(data.message);
                    signupForm.style.display = 'none';
                    document.getElementById('otpForm').style.display = 'block';
                } else {
                    alert(data.error || 'Registration Failed');
                }
            } catch (err) {
                alert('Network Error');
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const otp = document.getElementById('otp').value;
            const btn = document.getElementById('verifyBtn');
            const originalText = btn.innerHTML;

            try {
                btn.innerHTML = 'VERIFYING...';
                btn.disabled = true;

                const res = await fetch(`${API_BASE}/auth/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp })
                });
                const data = await res.json();

                if (data.success) {
                    alert('Account Verified! Proceed to profile setup.');
                    localStorage.setItem('voxa_email', email);
                    window.location.href = 'onboarding.html';
                } else {
                    alert(data.error || 'Verification Failed');
                }
            } catch (err) {
                alert('Network Error');
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const btn = document.getElementById('forgotBtn');
            const originalText = btn.innerHTML;
            
            try {
                btn.innerHTML = 'SENDING...';
                btn.disabled = true;
                // Hook up to actual forgot password backend route
                setTimeout(() => {
                    alert(`Recovery protocol initiated for ${email}`);
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }, 1000);
            } catch (err) {
                alert('Network Error');
                btn.disabled = false;
            }
        });
    }

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
            if (!window.google) {
                alert('Google API script is still loading or failed to load. Please try again in a moment.');
                return;
            }

            const client = google.accounts.oauth2.initTokenClient({
                client_id: '363368979052-8pjfociribrs4tnl288tn7oq57sf31hm.apps.googleusercontent.com',
                scope: 'https://www.googleapis.com/auth/userinfo.email',
                callback: async (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        try {
                            const btn = googleLoginBtn;
                            const originalText = btn.innerHTML;
                            btn.innerHTML = 'VERIFYING...';
                            btn.disabled = true;

                            // Get user profile from Google using the token
                            const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                            });
                            const profile = await profileRes.json();

                            if (profile.email) {
                                // Send to our backend
                                const authRes = await fetch(`${API_BASE}/auth/google`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ email: profile.email, google_id: profile.sub })
                                });
                                const authData = await authRes.json();

                                if (authData.success) {
                                    if (authData.requiresRegistration) {
                                        // Hide normal form and button, show complete form
                                        if (loginForm) loginForm.style.display = 'none';
                                        googleLoginBtn.style.display = 'none';
                                        const divider = document.querySelector('.divider');
                                        if (divider) divider.style.display = 'none';
                                        
                                        const completeForm = document.getElementById('googleCompleteForm');
                                        completeForm.style.display = 'block';
                                        // Store google info in the form
                                        completeForm.dataset.email = profile.email;
                                        completeForm.dataset.googleId = profile.sub;
                                    } else {
                                        // Logged in successfully
                                        localStorage.setItem('voxa_token', authData.token);
                                        localStorage.setItem('voxa_username', authData.username);
                                        window.location.href = 'dashboard.html';
                                    }
                                } else {
                                    alert(authData.error || 'Google login failed on our servers.');
                                    btn.innerHTML = originalText;
                                    btn.disabled = false;
                                }
                            }
                        } catch (err) {
                            alert('Network Error connecting to Google.');
                            googleLoginBtn.innerHTML = '<img src="https://developers.google.com/identity/images/g-logo.png" alt="Google Logo"> CONNECT VIA GOOGLE';
                            googleLoginBtn.disabled = false;
                        }
                    }
                },
            });
            client.requestAccessToken();
        });
    }

    const googleCompleteForm = document.getElementById('googleCompleteForm');
    if (googleCompleteForm) {
        googleCompleteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('googleUsername').value;
            const password = document.getElementById('googlePassword').value;
            const email = googleCompleteForm.dataset.email;
            const google_id = googleCompleteForm.dataset.googleId;
            const btn = document.getElementById('googleCompleteBtn');
            const originalText = btn.innerHTML;

            try {
                btn.innerHTML = 'FINALIZING...';
                btn.disabled = true;

                const res = await fetch(`${API_BASE}/auth/google-complete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, email, google_id })
                });
                const data = await res.json();

                if (data.success) {
                    alert('Registration Complete! Proceed to profile setup.');
                    localStorage.setItem('voxa_email', email); // Store for onboarding
                    localStorage.setItem('voxa_token', data.token);
                    localStorage.setItem('voxa_username', data.username);
                    window.location.href = 'onboarding.html';
                } else {
                    alert(data.error || 'Registration Failed');
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            } catch (err) {
                alert('Network Error');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // --- ONBOARDING LOGIC ---
    const imageUpload = document.getElementById('imageUpload');
    const completeOnboardingBtn = document.getElementById('completeOnboardingBtn');
    let currentAvatarUrl = null;

    window.selectAvatar = function(url) {
        currentAvatarUrl = url;
        const preview = document.getElementById('mainAvatarPreview');
        preview.innerHTML = `<img src="${url}" alt="Selected Avatar">`;
        
        document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
        event.currentTarget.classList.add('selected');
        
        completeOnboardingBtn.disabled = false;
    };

    if (imageUpload) {
        imageUpload.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const base64Str = event.target.result;
                    currentAvatarUrl = base64Str;
                    document.getElementById('mainAvatarPreview').innerHTML = `<img src="${base64Str}" alt="Custom Avatar">`;
                    document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
                    completeOnboardingBtn.disabled = false;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (completeOnboardingBtn) {
        completeOnboardingBtn.addEventListener('click', async () => {
            const email = localStorage.getItem('voxa_email');
            if (!email || !currentAvatarUrl) return alert('Missing information');
            
            const originalText = completeOnboardingBtn.innerHTML;
            completeOnboardingBtn.innerHTML = 'ESTABLISHING...';
            completeOnboardingBtn.disabled = true;

            try {
                const res = await fetch(`${API_BASE}/auth/onboarding`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, avatarUrl: currentAvatarUrl })
                });
                const data = await res.json();

                if (data.success) {
                    window.location.href = 'dashboard.html';
                } else {
                    alert(data.error || 'Onboarding Failed');
                }
            } catch (err) {
                alert('Network Error');
            } finally {
                completeOnboardingBtn.innerHTML = originalText;
                completeOnboardingBtn.disabled = false;
            }
        });
    }
});
