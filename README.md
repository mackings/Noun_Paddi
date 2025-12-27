# NounPaddi - National Open University Student Learning Platform

NounPaddi is a comprehensive learning platform for National Open University students that allows them to explore courses, access AI-generated summaries, and practice with automatically generated exam questions.

## Features

### For Students
- 🔐 Sign up and login with secure authentication
- 📚 Browse courses organized by faculties and departments
- 🔍 Search for specific courses
- 📄 Access course materials and AI-generated summaries
- ✅ Practice exams with automatically generated questions
- 📊 Track exam scores and performance

### For Admins
- 📤 Upload course materials (PDF, DOC, DOCX)
- 🤖 Auto-generate summaries using AI (Hugging Face)
- ❓ Auto-generate practice questions from materials
- 📊 Manage course content and materials

## Tech Stack

### Backend
- Node.js & Express.js
- MongoDB (Database)
- JWT (Authentication)
- Cloudinary (File Storage)
- Hugging Face API (AI Summarization & Question Generation)
- PDF Parse (Text Extraction)

### Frontend
- React.js
- React Router (Navigation)
- Axios (HTTP Client)
- React Icons
- Mobile Responsive Design

## Project Structure

```
nounpaddi/
├── backend/
│   ├── config/          # Database and service configurations
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Authentication middleware
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── utils/           # Helper functions (AI, PDF)
│   ├── server.js        # Main server file
│   └── package.json
├── frontend/
│   ├── public/          # Static files
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── contexts/    # React contexts
│   │   ├── pages/       # Page components
│   │   ├── utils/       # Utility functions
│   │   ├── App.js       # Main app component
│   │   └── index.js     # Entry point
│   └── package.json
└── README.md
```

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn

## Setup Instructions

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd nounpaddi
```

### 2. Backend Setup

#### Install Dependencies
```bash
cd backend
npm install
```

#### Configure Environment Variables
Create a `.env` file in the backend directory:
```bash
cp .env.example .env
```

Edit the `.env` file with your credentials:
```env
PORT=5000
NODE_ENV=development

# MongoDB - Local or Atlas
MONGODB_URI=mongodb://localhost:27017/nounpaddi
# OR use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/nounpaddi

# JWT Secret (use a strong random string)
JWT_SECRET=your_super_secret_jwt_key_here

# Cloudinary Configuration (Get from https://cloudinary.com)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Hugging Face API (Get from https://huggingface.co/settings/tokens)
HUGGINGFACE_API_KEY=your_huggingface_api_key
```

#### Start the Backend Server
```bash
npm start
# Or for development with auto-reload:
npm run dev
```

The backend will run on `http://localhost:5000`

### 3. Frontend Setup

#### Install Dependencies
```bash
cd ../frontend
npm install
```

#### Configure Environment Variables
Create a `.env` file in the frontend directory:
```bash
cp .env.example .env
```

The default configuration should work:
```env
REACT_APP_API_URL=http://localhost:5000/api
```

#### Start the Frontend
```bash
npm start
```

The frontend will open at `http://localhost:3000`

## Getting API Keys

### MongoDB Atlas (Optional - for cloud database)
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a cluster
4. Get your connection string

### Cloudinary (Required)
1. Go to https://cloudinary.com
2. Sign up for a free account
3. Get your Cloud Name, API Key, and API Secret from the dashboard

### Hugging Face (Required)
1. Go to https://huggingface.co
2. Create a free account
3. Go to Settings → Access Tokens
4. Create a new token with read permissions

## Initial Setup

### Create Admin Account
1. Open the app at `http://localhost:3000`
2. Click "Sign Up"
3. Create an account with any email
4. After creating the account, you need to manually change the role to 'admin' in MongoDB:
   ```javascript
   // In MongoDB Compass or Shell
   db.users.updateOne(
     { email: "your-admin-email@example.com" },
     { $set: { role: "admin" } }
   )
   ```

### Add Sample Data (Optional)
You can add faculties, departments, and courses through the MongoDB shell or Compass:

```javascript
// Add a Faculty
db.faculties.insertOne({
  name: "Science",
  description: "Faculty of Science",
  createdAt: new Date()
});

// Add a Department (use the faculty _id)
db.departments.insertOne({
  name: "Computer Science",
  facultyId: ObjectId("faculty_id_here"),
  description: "Department of Computer Science",
  createdAt: new Date()
});

// Add a Course (use the department _id)
db.courses.insertOne({
  courseCode: "CSC101",
  courseName: "Introduction to Computer Science",
  departmentId: ObjectId("department_id_here"),
  description: "Basic concepts of computer science",
  creditUnits: 3,
  createdAt: new Date()
});
```

## Usage Guide

### For Students
1. **Sign Up**: Create an account with your details
2. **Explore Courses**: Browse courses by faculty or search
3. **View Materials**: Access course materials and summaries
4. **Practice Exams**: Take practice tests for any course

### For Admins
1. **Login**: Sign in with admin credentials
2. **Upload Materials**: Upload PDF course materials
3. **Generate Content**: 
   - Click "Generate Summary" to create AI summaries
   - Click "Generate Practice Questions" to create exam questions
4. **Repeat**: Upload more materials for different courses

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Faculties & Departments
- `GET /api/faculties` - Get all faculties
- `GET /api/faculties/:id/departments` - Get departments by faculty

### Courses
- `GET /api/courses` - Get all courses
- `GET /api/courses/search?query=` - Search courses
- `GET /api/courses/:id/materials` - Get course materials

### Materials (Admin)
- `POST /api/materials/upload` - Upload material
- `POST /api/materials/:id/summarize` - Generate summary
- `POST /api/materials/:id/generate-questions` - Generate questions

### Questions
- `GET /api/questions/course/:id` - Get questions for course
- `POST /api/questions/:id/check` - Check answer

## Troubleshooting

### Backend won't start
- Check if MongoDB is running
- Verify your `.env` file has all required variables
- Check if port 5000 is available

### Frontend can't connect to backend
- Ensure backend is running on port 5000
- Check `REACT_APP_API_URL` in frontend `.env`
- Look for CORS errors in browser console

### File upload fails
- Verify Cloudinary credentials in `.env`
- Check file size (max 10MB typically)
- Ensure file format is PDF, DOC, or DOCX

### AI generation fails
- Verify Hugging Face API key
- Check API rate limits (free tier: 30 requests/hour)
- Wait a few seconds between requests

## Mobile Responsiveness

The app is fully responsive with breakpoints at:
- Mobile: 320px - 768px
- Tablet: 768px - 1024px
- Desktop: 1024px+

All touch targets are minimum 44px for mobile usability.

## Future Enhancements

- [ ] Progress tracking dashboard
- [ ] Course recommendations
- [ ] Discussion forums
- [ ] Video lectures support
- [ ] Offline mode
- [ ] Push notifications
- [ ] Social sharing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues or questions:
- Open an issue on GitHub
- Contact: support@nounpaddi.com

## Acknowledgments

- Hugging Face for AI models
- Cloudinary for file storage
- MongoDB for database
- React community for excellent tools

---

Built with ❤️ for National Open University Students
# NounPaddi
