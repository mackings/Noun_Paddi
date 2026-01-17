const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Log Cloudinary configuration status
console.log('Cloudinary Config:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '✓ Set' : '✗ Missing',
  api_key: process.env.CLOUDINARY_API_KEY ? `✓ Set (${process.env.CLOUDINARY_API_KEY})` : '✗ Missing',
  api_secret: process.env.CLOUDINARY_API_SECRET ? '✓ Set' : '✗ Missing',
});

// Storage for course materials (PDFs, docs)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'nounpaddi-materials',
    allowed_formats: ['pdf', 'doc', 'docx', 'txt'],
    resource_type: 'raw',
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Storage for profile images
const profileImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'nounpaddi-profile-images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }],
  },
});

const profileImageUpload = multer({
  storage: profileImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for images
  }
});

// Storage for project submissions (plagiarism checker)
const projectStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'nounpaddi-projects',
    allowed_formats: ['pdf', 'doc', 'docx'],
    resource_type: 'raw',
  },
});

const projectUpload = multer({
  storage: projectStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for projects
  }
});

module.exports = { cloudinary, upload, profileImageUpload, projectUpload };
