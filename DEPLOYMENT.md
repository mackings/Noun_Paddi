# NounPaddi Deployment Guide

This guide will walk you through deploying the NounPaddi application to Vercel.

## Prerequisites

- [Vercel Account](https://vercel.com/signup) (free tier works)
- [MongoDB Atlas Account](https://www.mongodb.com/cloud/atlas/register) (free tier works)
- [Cloudinary Account](https://cloudinary.com/users/register_free) (free tier works)
- [Google Gemini API Key](https://makersuite.google.com/app/apikey)
- Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Prepare Your MongoDB Database

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create a new cluster (or use existing)
3. Click "Connect" → "Connect your application"
4. Copy your connection string (it looks like: `mongodb+srv://username:password@cluster.mongodb.net/nounpaddi`)
5. Replace `<password>` with your actual password
6. Keep this connection string handy

## Step 2: Set Up Cloudinary

1. Go to [Cloudinary Dashboard](https://cloudinary.com/console)
2. Copy these values:
   - Cloud Name
   - API Key
   - API Secret
3. Keep these values handy

## Step 3: Get Google Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the API key
4. Keep it handy

## Step 4: Deploy Backend to Vercel

### Option A: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Navigate to the backend directory:
   ```bash
   cd backend
   ```

3. Login to Vercel:
   ```bash
   vercel login
   ```

4. Deploy:
   ```bash
   vercel
   ```

5. Follow the prompts:
   - Set up and deploy? **Yes**
   - Which scope? Select your account
   - Link to existing project? **No**
   - Project name? **nounpaddi-backend** (or your preferred name)
   - Directory? **.** (current directory)
   - Override settings? **No**

6. Add environment variables:
   ```bash
   vercel env add MONGODB_URI
   vercel env add JWT_SECRET
   vercel env add CLOUDINARY_CLOUD_NAME
   vercel env add CLOUDINARY_API_KEY
   vercel env add CLOUDINARY_API_SECRET
   vercel env add GEMINI_API_KEY
   vercel env add NODE_ENV
   ```

   For each variable, paste the value when prompted and select:
   - Production? **Yes**
   - Preview? **Yes**
   - Development? **No**

   Example values:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: A random secure string (e.g., `your-super-secret-jwt-key-12345`)
   - `CLOUDINARY_CLOUD_NAME`: Your Cloudinary cloud name
   - `CLOUDINARY_API_KEY`: Your Cloudinary API key
   - `CLOUDINARY_API_SECRET`: Your Cloudinary API secret
   - `GEMINI_API_KEY`: Your Gemini API key
   - `NODE_ENV`: `production`

7. Redeploy to apply environment variables:
   ```bash
   vercel --prod
   ```

8. Your backend will be deployed! Note the URL (e.g., `https://nounpaddi-backend.vercel.app`)

### Option B: Deploy via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your Git repository
4. Select the `backend` directory as the root directory
5. Click "Environment Variables" and add:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: A random secure string
   - `CLOUDINARY_CLOUD_NAME`: Your Cloudinary cloud name
   - `CLOUDINARY_API_KEY`: Your Cloudinary API key
   - `CLOUDINARY_API_SECRET`: Your Cloudinary API secret
   - `GEMINI_API_KEY`: Your Gemini API key
   - `NODE_ENV`: `production`
6. Click "Deploy"
7. Wait for deployment to complete
8. Note your backend URL (e.g., `https://nounpaddi-backend.vercel.app`)

## Step 5: Deploy Frontend to Vercel

### Option A: Deploy via Vercel CLI

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```

2. Create a `.env.production` file:
   ```bash
   echo "REACT_APP_API_URL=https://your-backend-url.vercel.app/api" > .env.production
   ```
   Replace `your-backend-url.vercel.app` with your actual backend URL from Step 4

3. Deploy:
   ```bash
   vercel
   ```

4. Follow the prompts:
   - Set up and deploy? **Yes**
   - Which scope? Select your account
   - Link to existing project? **No**
   - Project name? **nounpaddi-frontend** (or your preferred name)
   - Directory? **.** (current directory)
   - Override settings? **No**

5. Add environment variable:
   ```bash
   vercel env add REACT_APP_API_URL
   ```
   Enter your backend URL with `/api` at the end (e.g., `https://nounpaddi-backend.vercel.app/api`)

6. Deploy to production:
   ```bash
   vercel --prod
   ```

7. Your frontend will be deployed! Note the URL (e.g., `https://nounpaddi-frontend.vercel.app`)

### Option B: Deploy via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your Git repository
4. Select the `frontend` directory as the root directory
5. Framework Preset: **Create React App**
6. Click "Environment Variables" and add:
   - Key: `REACT_APP_API_URL`
   - Value: `https://your-backend-url.vercel.app/api` (use your actual backend URL)
7. Click "Deploy"
8. Wait for deployment to complete
9. Note your frontend URL

### Option C: Deploy Frontend to Netlify (while keeping backend on Vercel)

1. Go to [Netlify](https://app.netlify.com/) and click **Add new site** → **Import an existing project**
2. Connect your Git repository
3. Configure build settings:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `build`
4. Add environment variable:
   - Key: `REACT_APP_API_URL`
   - Value: `https://your-backend-url.vercel.app/api`
5. Deploy site
6. Note your Netlify frontend URL (e.g., `https://nounpaddi.netlify.app`)

## Step 6: Update Backend CORS Settings

1. Go to your backend project in Vercel Dashboard
2. Go to "Settings" → "Environment Variables"
3. Add a new variable:
   - Key: `FRONTEND_URL`
   - Value: Primary frontend URL (e.g., `https://nounpaddi-frontend.vercel.app` or `https://nounpaddi.netlify.app`)
4. If you are serving frontend from both Vercel and Netlify, also add:
   - Key: `CORS_ORIGINS`
   - Value: Comma-separated list, e.g. `https://nounpaddi-frontend.vercel.app,https://nounpaddi.netlify.app`
5. Redeploy the backend:
   ```bash
   cd backend
   vercel --prod
   ```

## Step 7: Test Your Deployment

1. Visit your frontend URL
2. Try signing up for a new account
3. Login with admin credentials (if you created one)
4. Upload a test PDF
5. Generate summary and questions
6. Verify everything works!

## Troubleshooting

### Backend Issues

**Error: "Cannot connect to MongoDB"**
- Verify your `MONGODB_URI` is correct
- Check if your MongoDB cluster allows connections from anywhere (0.0.0.0/0)
- In MongoDB Atlas: Network Access → Add IP Address → Allow Access from Anywhere

**Error: "CORS policy error"**
- Make sure `FRONTEND_URL` environment variable is set in backend
- Verify the URL matches exactly (no trailing slash)
- Redeploy backend after adding the variable

**Error: "Gemini API error"**
- Verify your `GEMINI_API_KEY` is correct and active
- Check if you have quota remaining in Google AI Studio

### Frontend Issues

**Error: "Network Error" or "Failed to fetch"**
- Verify `REACT_APP_API_URL` points to your backend URL
- Make sure `/api` is included at the end
- Check browser console for CORS errors

**Blank page after deployment**
- Check browser console for errors
- Verify build completed successfully
- Try clearing browser cache and hard refresh

## Environment Variables Reference

### Backend (.env)
```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/nounpaddi
JWT_SECRET=your-super-secret-jwt-key-here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
GEMINI_API_KEY=your_gemini_api_key
NODE_ENV=production
FRONTEND_URL=https://your-frontend.vercel.app
```

### Frontend (.env.production)
```bash
REACT_APP_API_URL=https://your-backend.vercel.app/api
```

## Custom Domain (Optional)

### For Frontend:
1. Go to your frontend project in Vercel
2. Settings → Domains
3. Add your custom domain
4. Follow DNS configuration instructions

### For Backend:
1. Go to your backend project in Vercel
2. Settings → Domains
3. Add your custom domain (e.g., api.yourdomain.com)
4. Update `REACT_APP_API_URL` in frontend to use custom domain
5. Update `FRONTEND_URL` in backend if using custom domain for frontend

## Automatic Deployments

Vercel automatically deploys:
- **Production**: When you push to the main/master branch
- **Preview**: When you push to any other branch or create a PR

This means any changes you push to GitHub will automatically deploy!

## Monitoring

- View deployment logs in Vercel Dashboard
- Check function logs for debugging
- Monitor MongoDB Atlas for database performance
- Track Gemini API usage in Google AI Studio

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for frontend errors
3. Review MongoDB Atlas metrics
4. Verify all environment variables are set correctly

---

**Congratulations! Your NounPaddi application is now live! 🎉**
