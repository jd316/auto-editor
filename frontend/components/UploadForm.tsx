import React, { useState, FormEvent } from 'react';
import { Form, Button, Card } from 'react-bootstrap';
import { FaRocket, FaVideo, FaFileAlt, FaRobot } from 'react-icons/fa';
import FileDropzone from './FileDropzone';

interface UploadFormProps {
  onUploadStart: (formData: FormData) => Promise<void>;
}

const UploadForm: React.FC<UploadFormProps> = ({ onUploadStart }) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [scriptFile, setScriptFile] = useState<File | null>(null);
  const [scriptText, setScriptText] = useState('');
  const [scriptType, setScriptType] = useState('text');
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [scriptTextError, setScriptTextError] = useState<string | null>(null);
  
  const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
  const MAX_SCRIPT_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_SCRIPT_TEXT_LENGTH = 10000; // 10,000 characters

  const handleVideoFileDrop = (acceptedFiles: File[]) => {
    setFileError(null);
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.size > MAX_VIDEO_SIZE) {
        setFileError(`Video file is too large. Maximum size is ${MAX_VIDEO_SIZE / 1024 / 1024}MB.`);
        return;
      }
      setVideoFile(file);
    } else {
      setVideoFile(null);
    }
  };

  const handleScriptFileDrop = (acceptedFiles: File[]) => {
    setFileError(null);
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.size > MAX_SCRIPT_SIZE) {
        setFileError(`Script file is too large. Maximum size is ${MAX_SCRIPT_SIZE / 1024 / 1024}MB.`);
        return;
      }
      setScriptFile(file);
    } else {
      setScriptFile(null);
    }
  };

  const handleScriptTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScriptType(e.target.value);
  };

  const handleScriptTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setScriptText(text);
    
    // Validate script text length
    if (text.length > MAX_SCRIPT_TEXT_LENGTH) {
      setScriptTextError(`Script is too long. Maximum length is ${MAX_SCRIPT_TEXT_LENGTH} characters.`);
    } else {
      setScriptTextError(null);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!videoFile) {
      alert('Please select a video file');
      return;
    }
    
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('video', videoFile);
    
    if (scriptType === 'text' && scriptText.trim()) {
      formData.append('script_text', scriptText);
    } else if (scriptType === 'file' && scriptFile) {
      formData.append('script', scriptFile);
    }
    
    onUploadStart(formData)
      .catch(error => {
        console.error('Error in upload process:', error);
        setFileError('An error occurred during the upload process. Please try again.');
      })
      .finally(() => {
        setIsUploading(false);
      });
  };
  
  const isFormValid = () => {
    if (!videoFile) return false;
    
    if (scriptType === 'text') {
      return scriptText.trim() !== '' && !scriptTextError;
    } else if (scriptType === 'file') {
      return scriptFile !== null;
    }
    
    return false;
  };

  return (
    <Form onSubmit={handleSubmit}>
      {fileError && (
        <div className="alert alert-danger mb-3">
          {fileError}
        </div>
      )}
      
      <Form.Group className="mb-4">
        <Form.Label className="form-label-primary d-flex align-items-center">
          <FaVideo className="me-2" /> Video File
        </Form.Label>
        
        <FileDropzone
          accept={{
            'video/*': ['.mp4', '.mov', '.avi', '.mkv']
          }}
          onFileDrop={handleVideoFileDrop}
          icon="video"
          label="Drag and drop your video file here or click to browse"
          file={videoFile}
          maxSize={MAX_VIDEO_SIZE}
        />
      </Form.Group>

      <Form.Group className="mb-4">
        <Form.Label className="form-label-primary d-flex align-items-center">
          <FaFileAlt className="me-2" /> Script
        </Form.Label>
        
        <Card className="script-options-card mb-3">
          <div className="d-flex flex-wrap p-3">
            <Form.Check
              className="me-4 mb-2"
              type="radio"
              name="scriptType"
              id="script-text"
              value="text"
              label={<span className="text-white">Text Input</span>}
              checked={scriptType === 'text'}
              onChange={handleScriptTypeChange}
            />
            <Form.Check
              className="mb-2"
              type="radio"
              name="scriptType"
              id="script-file"
              value="file"
              label={<span className="text-white">File Upload</span>}
              checked={scriptType === 'file'}
              onChange={handleScriptTypeChange}
            />
          </div>
        </Card>

        {scriptType === 'text' && (
          <>
            <Form.Control
              as="textarea"
              rows={5}
              placeholder="Enter your script here..."
              value={scriptText}
              onChange={handleScriptTextChange}
              className={`mb-2 script-textarea ${scriptTextError ? 'is-invalid' : ''}`}
              maxLength={MAX_SCRIPT_TEXT_LENGTH}
            />
            <div className="d-flex justify-content-between mb-3">
              <div>
                {scriptTextError && (
                  <div className="text-danger small">{scriptTextError}</div>
                )}
              </div>
              <div className="text-muted small">
                {scriptText.length}/{MAX_SCRIPT_TEXT_LENGTH} characters
              </div>
            </div>
          </>
        )}

        {scriptType === 'file' && (
          <FileDropzone
            accept={{
              'text/plain': ['.txt'],
              'text/markdown': ['.md'],
              'application/pdf': ['.pdf'],
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
            }}
            onFileDrop={handleScriptFileDrop}
            icon="document"
            label="Drag and drop your script file here or click to browse"
            file={scriptFile}
            maxSize={MAX_SCRIPT_SIZE}
          />
        )}
      </Form.Group>

      <div className="d-grid gap-2">
        <Button 
          type="submit" 
          className="btn-lg process-btn"
          disabled={!isFormValid() || isUploading}
        >
          {isUploading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Processing...
            </>
          ) : (
            <>
              <FaRocket className="me-2" /> Process Video
            </>
          )}
        </Button>
      </div>
    </Form>
  );
};

export default UploadForm; 