const fileService = require('./src/services/fileService');
const cloudinary = require('cloudinary').v2;
cloudinary.config({ cloud_name: 'test-cloud', api_key: '123', api_secret: '456' });
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';

const url = fileService.generateSecureUrl('mentorconnect/credentials/mock_1790838891290_Child_Mortality_Prediction_ML_Project.ipynb_-_Colab.pdf', 'application/pdf');
console.log(url);
