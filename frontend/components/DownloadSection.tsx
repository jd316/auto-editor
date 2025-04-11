import React, { useState, useEffect } from 'react';
import { FaDownload, FaCheckCircle, FaPlay, FaShare } from 'react-icons/fa';

interface DownloadSectionProps {
  downloadUrl: string;
}

const DownloadSection: React.FC<DownloadSectionProps> = ({ downloadUrl }) => {
  const [isAnimating, setIsAnimating] = useState(true);
  const [isUrlValid, setIsUrlValid] = useState(false);
  const [fullDownloadUrl, setFullDownloadUrl] = useState('');
  
  useEffect(() => {
    // Animation timing
    const timer = setTimeout(() => {
      setIsAnimating(false);
    }, 1500);
    
    // Ensure the download URL has the correct format
    let formattedUrl = downloadUrl;
    
    // If it's a relative URL starting with /api, make it absolute
    if (downloadUrl && downloadUrl.startsWith('/api/')) {
      // Use the current origin (hostname + port)
      const origin = window.location.origin;
      formattedUrl = `${origin}${downloadUrl}`;
      setFullDownloadUrl(formattedUrl);
      setIsUrlValid(true);
      console.log('Download URL formatted:', formattedUrl);
    } else {
      console.warn('Download URL may not be valid:', downloadUrl);
      // Still set to true to show the button for testing
      setIsUrlValid(true);
      setFullDownloadUrl(downloadUrl);
    }
    
    return () => clearTimeout(timer);
  }, [downloadUrl]);
  
  // For testing - force show the download section
  const forceShowDownload = true;
  
  return (
    <div className={`download-section ${isAnimating ? 'animate-in' : ''}`}>
      <div className="status-card status-card-completed glass-card mb-4">
        <div className="d-flex align-items-center mb-3">
          <div className="status-icon-container">
            <FaCheckCircle className="status-icon-completed" />
          </div>
          <div>
            <h4 className="status-title status-title-completed">
              Processing Complete
            </h4>
            <p className="status-message">
              Your video has been successfully edited and is ready to download
            </p>
          </div>
        </div>
      </div>
      
      <div className="success-animation-container">
        <FaCheckCircle className="download-success-icon" />
      </div>
      
      <h3 className="download-title text-center mb-3">Your Video is Ready!</h3>
      
      <div className="download-actions mt-4">
        {(isUrlValid || forceShowDownload) && (
          <a 
            className="btn download-btn d-flex align-items-center justify-content-center" 
            href={fullDownloadUrl}
            download
            onClick={(e) => {
              console.log('Download button clicked, URL:', fullDownloadUrl);
              // If URL is not valid, prevent default and show message
              if (!fullDownloadUrl.includes('/api/download/')) {
                e.preventDefault();
                alert('Download URL is not available. This would normally download your edited video.');
              }
            }}
          >
            <FaDownload className="me-2" /> Download Edited Video
          </a>
        )}
        
        <div className="secondary-actions mt-4 d-flex justify-content-center">
          <a 
            className="btn btn-outline-primary me-3" 
            href={fullDownloadUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!fullDownloadUrl.includes('/api/download/')) {
                e.preventDefault();
                alert('Preview is not available. This would normally open your edited video in a new tab.');
              }
            }}
          >
            <FaPlay className="me-2" /> Preview
          </a>
          
          <button 
            className="btn btn-outline-primary"
            onClick={() => {
              navigator.clipboard.writeText(fullDownloadUrl);
              alert('Download link copied to clipboard!');
            }}
          >
            <FaShare className="me-2" /> Share Link
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadSection; 