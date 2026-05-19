async function testRegister() {
    try {
        const randomEmail = `test_${Math.floor(Math.random() * 100000)}@voxa.com`;
        const randomUsername = `Operator_${Math.floor(Math.random() * 100000)}`;
        console.log(`Testing registration with: ${randomEmail} / ${randomUsername}`);
        
        const res = await fetch('https://voxachat-jbyj.onrender.com/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: randomUsername, 
                email: randomEmail, 
                password: 'password123' 
            })
        });
        const data = await res.json();
        console.log('Response:', data);
    } catch (e) {
        console.error('Error:', e);
    }
}
testRegister();
