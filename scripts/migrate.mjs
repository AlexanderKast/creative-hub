#!/usr/bin/env node
// Aplica todas las migraciones al proyecto Supabase del Creative Hub.
// Uso: node scripts/migrate.mjs
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Lee .env.local
function loadEnv() {
  const env = {};
  const raw = readFileSync(join(__dirname, "../.env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

async function execSql(url, serviceKey, sql) {
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json().catch(() => null);
}

async function execSqlDirect(url, serviceKey, sql) {
  // Supabase Management API (necesita access token personal, no service key)
  // Fallback: usa el endpoint /rest/v1/ con una función
  const pgUrl = url.replace("https://", "https://db.").replace(".supabase.co", ".supabase.co");

  // Intentamos via Management REST API de Supabase
  const projectRef = url.replace("https://", "").replace(".supabase.co", "");
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res.ok) {
    return res.json().catch(() => null);
  }

  throw new Error(`No se pudo ejecutar SQL. Aplica manualmente en Supabase SQL Editor.\nStatus: ${res.status}`);
}

const MIGRATIONS = [
  "001_creative_hub.sql",
  "002_changes_token.sql",
  "003_bunny_fields.sql",
  "004_creative_analysis.sql",
  "005_projects_system.sql",
  "006_app_settings.sql",
];

async function run() {
  const env = loadEnv();
  const url = env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !key) {
    console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }

  console.log(`🔗 Conectando a ${url}`);

  // Crear la función exec_sql si no existe
  const createFn = `
    CREATE OR REPLACE FUNCTION exec_sql(sql text)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN EXECUTE sql; END $$;
  `;

  try {
    await execSqlDirect(url, key, createFn);
    console.log("✅ Función exec_sql creada");
  } catch {
    // La Management API requiere access token personal, no service key.
    // Mostramos el SQL para que el usuario lo aplique manualmente.
    console.log("\n📋 La API de gestión requiere token personal. Copia y pega este SQL en Supabase SQL Editor:\n");
    console.log("-- ─────────────────────────────────────────────────────────────────");
    for (const file of MIGRATIONS) {
      const sql = readFileSync(join(__dirname, "../supabase/migrations", file), "utf8");
      console.log(`\n-- ═══ ${file} ═══`);
      console.log(sql);
    }
    console.log("-- ─────────────────────────────────────────────────────────────────");
    console.log("\n👆 Pega todo lo anterior en: https://supabase.com/dashboard/project/amtiyyekjiahszztjkfp/sql/new");
    return;
  }

  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(__dirname, "../supabase/migrations", file), "utf8");
    process.stdout.write(`  Aplicando ${file}... `);
    try {
      await execSql(url, key, sql);
      console.log("✅");
    } catch (err) {
      console.log("❌");
      console.error(`  Error: ${err.message}`);
      process.exit(1);
    }
  }

  console.log("\n🎉 Todas las migraciones aplicadas correctamente.");
}

run().catch(console.error);
