# Creative Hub — Setup

## 1. Variables de entorno

Edita `.env.local` con tus credenciales reales:

```env
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=xxx              # genera con: openssl rand -base64 32
ANTHROPIC_API_KEY=xxx
GOOGLE_DRIVE_REFRESH_TOKEN=xxx   # ver sección 3 abajo
UPLOAD_FOLDER_ID=xxx             # ID de la carpeta de Drive donde subir archivos
```

## 2. Google Cloud Console

1. Ir a https://console.cloud.google.com/
2. Crear proyecto o seleccionar uno existente
3. **APIs & Services → Enable APIs** → habilitar **Google Drive API**
4. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client IDs**
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
5. Copiar **Client ID** y **Client Secret** al `.env.local`

## 3. Drive refresh token del admin (OBLIGATORIO)

Todos los usuarios del equipo se autentican con Google scope básico. Las operaciones de Drive las hacen con las credenciales del admin, almacenadas una sola vez.

### Opción A — Variable de entorno (más fácil)

1. Ve a https://developers.google.com/oauthplayground/
2. Clic en ⚙️ → activa **"Use your own OAuth credentials"**
3. Ingresa tu `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`
4. Agrega `https://developers.google.com/oauthplayground` como URI de redireccionamiento autorizado en Google Cloud Console
5. En "Step 1", escribe `https://www.googleapis.com/auth/drive` y haz clic en **Authorize APIs**
6. Inicia sesión como el admin → en "Step 2" clic en **Exchange authorization code for tokens**
7. Copia el **Refresh token**
8. Agrégalo a `.env.local` como `GOOGLE_DRIVE_REFRESH_TOKEN=1//04...`

### Opción B — Ruta de setup automático

Solo funciona si el admin aún tiene una sesión con Drive scope activa (antes del cambio de scope):

1. Asegúrate de estar logueado como admin
2. Visita: `http://localhost:3000/api/admin/setup-drive`
3. Si dice `"ok": true` → listo
4. Si dice "No hay refresh token" → usa la Opción A

## 4. NEXTAUTH_SECRET

```bash
# En terminal (requiere openssl):
openssl rand -base64 32
```

O genera uno en https://generate-secret.vercel.app/32

## 5. Correr el proyecto

```bash
npm run dev
```

Abre http://localhost:3000 → clic en **Continuar con Google** (scope básico, no necesita Drive).

## 6. Uso

- **Grid**: muestra todos los videos/imágenes de tu Drive con thumbnail
- **Filtros**: por tipo, carpeta, fecha, tipo de contenido, plataforma, estado
- **✨ Etiquetar con Claude**: analiza el nombre del archivo y sugiere etiquetas
- **Lápiz (hover)**: edición manual de etiquetas
- **CSV**: exporta la lista filtrada actual
- **Sincronizar**: re-escanea el Drive sin recargar la página
