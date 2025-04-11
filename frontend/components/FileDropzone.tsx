import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { FaCloudUploadAlt, FaFileVideo, FaFileAlt, FaCheckCircle, FaTimes, FaFilePdf, FaFileWord } from 'react-icons/fa';

interface FileDropzoneProps {
  accept: {
    [key: string]: string[];
  };
  onFileDrop: (acceptedFiles: File[]) => void;
  icon: 'video' | 'document';
  label: string;
  file: File | null;
  maxSize?: number; // Optional max size prop with default value set in component
}

const FileDropzone: React.FC<FileDropzoneProps> = ({ 
  accept, 
  onFileDrop, 
  icon, 
  label, 
  file,
  maxSize = 500 * 1024 * 1024 // Default to 500MB for video, can be overridden by props
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadTimer, setUploadTimer] = useState<NodeJS.Timeout | null>(null);

  // Clear the timer when component unmounts
  useEffect(() => {
    return () => {
      if (uploadTimer) {
        clearTimeout(uploadTimer);
      }
    };
  }, [uploadTimer]);

  // Clean up timer when file changes
  useEffect(() => {
    // Clear any existing timer
    if (uploadTimer) {
      clearTimeout(uploadTimer);
      setUploadTimer(null);
    }
  }, [file, uploadTimer]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      // Ensure only one file is processed even if multiple are dropped
      if (acceptedFiles.length > 0) {
        // Just take the first file if multiple are dropped
        onFileDrop([acceptedFiles[0]]);
      } else {
        onFileDrop([]);
      }
    },
    [onFileDrop]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false, // Explicitly set to false to ensure only one file can be selected
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    onDropAccepted: () => setIsDragActive(false),
    onDropRejected: () => setIsDragActive(false),
  });

  const renderIcon = () => {
    if (file) {
      // Always show success icon when file is present
      return <FaCheckCircle className="dropzone-icon success-icon" />;
    }
    if (icon === 'video') {
      return <FaCloudUploadAlt className="dropzone-icon" />;
    }
    return <FaFileAlt className="dropzone-icon" />;
  };

  const getFileIcon = () => {
    if (icon === 'video') {
      return <FaFileVideo className="file-type-icon" />;
    }
    
    if (file) {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.pdf')) {
        return <FaFilePdf className="file-type-icon" />;
      }
      if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
        return <FaFileWord className="file-type-icon" />;
      }
    }
    
    return <FaFileAlt className="file-type-icon" />;
  };

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onFileDrop([]);
  };

  // Format size to a human-readable format (e.g., 500MB)
  const formatSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb}MB`;
  };

  return (
    <div className="mb-3">
      <div
        {...getRootProps()}
        className={`drop-zone ${isDragActive ? 'active' : ''} ${file ? 'has-file uploaded' : ''}`}
      >
        <div className="dropzone-content">
          {renderIcon()}
          <p className="dropzone-text mb-1">{file ? 'Click or drag to replace file' : label}</p>
          <small className="dropzone-hint">
            {icon === 'video' 
              ? `Supports MP4, MOV, AVI, MKV (max ${formatSize(maxSize)})`
              : `Supports TXT, MD, PDF, DOCX (max ${formatSize(maxSize)})`}
          </small>
          <input {...getInputProps()} />
        </div>
      </div>
      
      {file && (
        <div className="file-info">
          {getFileIcon()}
          <div className="file-details">
            <div className="file-name">{file.name}</div>
            <div className="file-size">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
          <button 
            type="button" 
            className="btn-close-custom" 
            onClick={removeFile}
            aria-label="Remove file"
          >
            <FaTimes />
          </button>
        </div>
      )}
    </div>
  );
};

export default FileDropzone; 