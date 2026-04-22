// ============================================
// video-utils.js
// FFmpeg watermark helpers
// ============================================

const { exec } = require('child_process');
const path = require('path');

// Check if FFmpeg is available
function checkFFmpeg() {
  return new Promise((resolve) => {
    exec('ffmpeg -version', (error) => {
      resolve(!error);
    });
  });
}

// Add watermark to video
function addWatermark(inputPath, outputPath, watermarkText) {
  return new Promise((resolve, reject) => {
    const command = `ffmpeg -i "${inputPath}" -vf "drawtext=text='${watermarkText}':fontcolor=white:fontsize=24:alpha=0.5:x=10:y=10" -codec:a copy "${outputPath}" -y`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(outputPath);
      }
    });
  });
}

module.exports = { checkFFmpeg, addWatermark };
