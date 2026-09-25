const cloudinary = require('cloudinary').v2;
const prisma = require('../config/db');

// Safe instantiation depending on whether ENVs exist yet
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

/**
 * Uploads a file buffer to Cloudinary.
 * @param {Buffer} fileBuffer
 * @param {string} folderPath e.g., 'mentorconnect/assignments/references'
 * @param {string} originalName 
 */
const uploadToCloudinary = (fileBuffer, folderPath, originalName) => {
  return new Promise((resolve, reject) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return reject(new Error("Cloudinary credentials are not configured in backend environment."));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderPath,
        resource_type: 'auto',
        use_filename: true,
        filename_override: originalName
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    uploadStream.end(fileBuffer);
  });
};

/**
 * Saves file metadata to PostgreSQL FileAsset model.
 */
const saveFileAssetMetadata = async (ownerId, file, cloudinaryResult, category, entityId) => {
  // We'll store entityId in a custom formatted string within the `category` to associate relations
  // since FileAsset has no native assignmentId or submissionId
  // e.g., category: 'ASSIGNMENT_REF:uuid' or 'SUBMISSION_FILE:uuid'
  
  return await prisma.fileAsset.create({
    data: {
      ownerId: ownerId,
      originalName: file.originalname,
      storageKey: cloudinaryResult.public_id,
      mimeType: file.mimetype,
      size: file.size,
      category: `${category}:${entityId}`
    }
  });
};

/**
 * Main wrapper for handling an array of uploaded files
 */
const processUploads = async (files, ownerId, folderPath, categoryType, entityId) => {
  const assets = [];
  for (const file of files) {
    const cloudinaryRes = await uploadToCloudinary(file.buffer, folderPath, file.originalname);
    const asset = await saveFileAssetMetadata(ownerId, file, cloudinaryRes, categoryType, entityId);
    assets.push(asset);
  }
  return assets;
};

/**
 * Fetch files for a specific entity based on category naming convention
 */
const getFilesForEntity = async (categoryType, entityId) => {
  return await prisma.fileAsset.findMany({
    where: {
      category: `${categoryType}:${entityId}`
    }
  });
};

/**
 * Delete a file asset and its cloudinary counterpart
 */
const deleteFileAsset = async (assetId, ownerId) => {
  const asset = await prisma.fileAsset.findUnique({ where: { id: assetId } });
  if (!asset) throw new Error("Asset not found");
  if (asset.ownerId !== ownerId) throw new Error("Unauthorized file deletion");

  // Remove from Cloudinary
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    await cloudinary.uploader.destroy(asset.storageKey);
  }

  // Remove from DB
  await prisma.fileAsset.delete({ where: { id: assetId } });
  return true;
};

/**
 * Generates secure, short-lived download/view URL (if applicable, else standard secure URL)
 */
const generateSecureUrl = (publicId) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME) return null;
  return cloudinary.url(publicId, { secure: true });
};

module.exports = {
  uploadToCloudinary,
  saveFileAssetMetadata,
  processUploads,
  getFilesForEntity,
  deleteFileAsset,
  generateSecureUrl
};
