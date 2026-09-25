const multer = require('multer');

// Store files in memory so we can upload them straight to Cloudinary
const storage = multer.memoryStorage();

// Validate file sizes and types
const fileFilter = (req, file, cb) => {
  // Allowed types
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'application/zip',
    'application/x-zip-compressed'
  ];

  // Block obvious executables
  const blockExts = ['.exe', '.bat', '.cmd', '.sh', '.js'];
  const ext = (file.originalname || '').toLowerCase();
  
  if (blockExts.some(e => ext.endsWith(e))) {
    return cb(new Error("Executable files are not permitted"), false);
  }

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type. Please upload PDF, DOC, DOCX, TXT, JPG, PNG, or ZIP."), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per file limit
  },
  fileFilter
});

module.exports = upload;
