# Deployment Guide

SQLite won't work on Vercel serverless. Deploy frontend to Vercel, backend to Railway.

## Step 1: Deploy Backend (Railway)

1. Go to https://railway.app, sign up
2. Click "New Project" → "Deploy from GitHub"
3. Connect your repository
4. Click the deployed service, go to "Settings"
5. Set Root Directory to: `backend`
6. Add environment variable:
   - Name: `JWT_SECRET`
   - Value: `your-random-secret-here` (generate a strong string)
7. Railway auto-detects Node.js and deploys

Your backend URL will be: `https://your-app.up.railway.app`

## Step 2: Deploy Frontend (Vercel)

```bash
# In project root, run:
vercel

# When prompted:
# - Set as production? Yes
# - Override settings? Yes
# - Which directory? Frontend
```

After deployment completes:

1. Go to Vercel dashboard → Your project → Settings → Environment Variables
2. Add:
   - Name: `VITE_API_BASE_URL`
   - Value: `https://your-app.up.railway.app/api` (use your Railway URL)

3. Redeploy: Vercel dashboard → Deployments → Click "⋯" → Redeploy

## Environment Variables

**Backend (Railway):**
```
JWT_SECRET=your-random-secret-here
```

**Frontend (Vercel):**
```
VITE_API_BASE_URL=https://your-backend-url.com/api
```

## Alternative: Render.com (Backend)

1. Create account at https://render.com
2. New → Web Service
3. Connect GitHub repo
4. Settings:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. Add environment variable: `JWT_SECRET`
6. Deploy

Use Render URL in frontend env var instead of Railway URL.

