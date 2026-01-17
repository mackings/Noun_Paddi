# NounPaddi - AI-Powered Educational Platform

A modern EdTech platform for Nigerian universities that uses AI to generate summaries and practice questions from course materials.

![NounPaddi](https://img.shields.io/badge/Built%20with-React%20%26%20Node.js-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-Active-success)

## Features

### For Students
- 📚 **Browse Courses** - Explore available courses by faculty and department
- 📄 **Study Materials** - Access uploaded course materials
- 🤖 **AI Summaries** - Get AI-generated summaries of complex materials
- ✏️ **Practice Questions** - Test your knowledge with auto-generated MCQs
- 📊 **Progress Tracking** - Monitor your learning progress
- 🎨 **Modern UI** - Beautiful, responsive interface with dark mode

### For Administrators
- 📤 **Upload Materials** - Upload PDF course materials
- 🧠 **AI Processing** - Automatically generate summaries using Google Gemini AI
- ❓ **Question Generation** - Create 50+ practice questions per material
- 📈 **Analytics Dashboard** - Track usage, materials, and API consumption
- 🎯 **Content Management** - Manage faculties, departments, and courses
- 📊 **API Usage Tracking** - Monitor Gemini API token usage

## Tech Stack

### Frontend
- **React** 18.2 - UI library
- **React Router** 6 - Navigation
- **Axios** - HTTP client
- **React Icons** - Icon library
- **Poppins & Montserrat** - Typography
- **CSS Variables** - Theming system

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **Cloudinary** - File storage
- **Google Gemini AI** - Text generation

## Quick Start

### Prerequisites
- Node.js 14+ and npm
- MongoDB database
- Cloudinary account
- Google Gemini API key

### Local Development

1. **Clone and install**
   ```bash
   git clone <your-repo-url>
   cd nounpaddi
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Configure environment variables** (see .env.example files)

3. **Start development servers**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm start

   # Terminal 2 - Frontend
   cd frontend && npm start
   ```

### Mobile Access (Same WiFi)

Test on your phone while developing:

```bash
# Quick start (macOS/Linux)
./start-mobile.sh

# Quick start (Windows)
start-mobile.bat
```

See [LOCAL_MOBILE_ACCESS.md](LOCAL_MOBILE_ACCESS.md) for detailed instructions.

## Deployment to Vercel

### Quick Deploy
```bash
./deploy.sh
```

### Detailed Instructions
See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guide.

## Documentation

- [Deployment Guide](DEPLOYMENT.md) - Complete deployment instructions
- [Mobile Access Guide](LOCAL_MOBILE_ACCESS.md) - Test on phone during development
- [Quick Deploy Reference](QUICK_DEPLOY.md) - Quick deployment checklist

## Project Structure

```
nounpaddi/
├── backend/          # Express API server
├── frontend/         # React application
├── DEPLOYMENT.md     # Deployment guide
└── README.md        # This file
```

## License

MIT License - feel free to use this project for learning or commercial purposes.

---

**Built with ❤️ for Education**
# Noun_Paddi
