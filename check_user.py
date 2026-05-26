import paramiko
c=paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.15.25",username="it",password="temp_C_25!",timeout=10)

# Test login
s,o,e=c.exec_command('curl -s -X POST http://localhost:8080/auth/signin -H "Content-Type: application/json" -d '"'"'{"email":"fernando.pandolphi@exemplo.com.br","password":"123456"}'"'"' 2>&1')
print("Login 123456:", o.read().decode(errors="replace")[:300])

s,o,e=c.exec_command('curl -s -X POST http://localhost:8080/auth/signin -H "Content-Type: application/json" -d '"'"'{"email":"fernando.pandolphi@exemplo.com.br","password":"password"}'"'"' 2>&1')
print("\nLogin password:", o.read().decode(errors="replace")[:300])

s,o,e=c.exec_command('curl -s -X POST http://localhost:8080/auth/signin -H "Content-Type: application/json" -d '"'"'{"email":"admin@piloto.com","password":"123456"}'"'"' 2>&1')
print("\nLogin admin piloto:", o.read().decode(errors="replace")[:300])

c.close()
