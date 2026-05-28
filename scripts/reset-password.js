// ============================================================
// Sale360 — Emergency Password Reset CLI
// Uso: node scripts/reset-password.js <email> [nova-senha]
//
// Se a senha não for informada, gera uma senha aleatória de 12 caracteres.
// Marca forcePasswordChange = true para obrigar troca no próximo login.
// ============================================================

const { PrismaClient } = require('@sale360/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const prisma = new PrismaClient();

function generatePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars[crypto.randomInt(chars.length)];
  }
  return password;
}

async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3] || generatePassword();

  if (!email) {
    console.error('❌ Uso: node scripts/reset-password.js <email> [nova-senha]');
    console.error('   Exemplo: node scripts/reset-password.js admin@exemplo.com');
    console.error('   Exemplo: node scripts/reset-password.js admin@exemplo.com MinhaSenha123');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.error(`❌ Usuário não encontrado: ${email}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      forcePasswordChange: true,
    },
  });

  // Invalidate existing password reset tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Senha redefinida com sucesso!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  👤 Usuário: ${user.name} (${user.email})`);
  console.log(`  🔑 Nova senha: ${newPassword}`);
  console.log(`  ⚠️  forcePasswordChange: true (usuário será obrigado a trocar no próximo login)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Erro:', err.message);
  prisma.$disconnect();
  process.exit(1);
});
