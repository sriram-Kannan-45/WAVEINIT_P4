#!/usr/bin/env node
/**
 * Server-side Admin Provisioning & Credential Bootstrap Tool
 * Usage: npx tsx scripts/bootstrap-admin.ts <username> <email> <password>
 */
import { hashPassword } from "../src/lib/admin-auth";

function printUsage() {
  console.log("Usage: npx tsx scripts/bootstrap-admin.ts <username> <email> <password>");
  console.log("Example: npx tsx scripts/bootstrap-admin.ts achu admin@achuboutique.com MySecurePassword123!");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    printUsage();
    process.exit(1);
  }

  const [username, email, password] = args;

  if (password.length < 12) {
    console.error("Error: Admin password must be at least 12 characters long.");
    process.exit(1);
  }

  const hash = hashPassword(password);

  console.log("\n--- SECURE ADMIN CREDENTIAL GENERATED ---");
  console.log(`Username: ${username}`);
  console.log(`Email:    ${email}`);
  console.log(`Hash:     ${hash}`);
  console.log("\nTo configure this in your environment, add to .env.local:");
  console.log(`ADMIN_ID=${username}`);
  console.log(`ADMIN_EMAIL=${email}`);
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log("\nTo insert into PostgreSQL database (supabase/migrations):");
  console.log(
    `INSERT INTO public.admin_users (username, email, password_hash, role, is_active)\n` +
    `VALUES ('${username}', '${email}', '${hash}', 'admin', true)\n` +
    `ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;\n`
  );
}

main().catch((err) => {
  console.error("Bootstrap error:", err);
  process.exit(1);
});
