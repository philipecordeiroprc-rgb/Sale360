import re
with open("/home/opc/sale360/scripts/backup.sh", "r") as f:
    content = f.read()

old = 'DB_URL="${DATABASE_URL:-postgresql://neondb_owner:npg_Xk2TdJrqNx5p@ep-holy-rain-actxoqs3-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require}"'
new = 'DB_URL=$(grep -oP "DATABASE_URL=\\K.*" /home/opc/sale360/packages/api/.env | tr -d \'"\')'

if old in content:
    content = content.replace(old, new)
    with open("/home/opc/sale360/scripts/backup.sh", "w") as f:
        f.write(content)
    print("DB_URL replaced successfully")
else:
    print("OLD STRING NOT FOUND - checking content:")
    for i, line in enumerate(content.splitlines()):
        if "DB_URL" in line:
            print(f"Line {i+1}: {repr(line)}")
