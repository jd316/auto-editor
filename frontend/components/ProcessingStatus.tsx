import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ProgressBar } from 'react-bootstrap';
import { FaSpinner, FaClock, FaCheckCircle, FaExclamationTriangle, FaVideo, FaRobot, FaMagic, FaDownload, FaShareAlt, FaPlay } from 'react-icons/fa';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

interface ProgressInfo {
  percent: number;
  current_step: number;
  total_steps: number;
  message: string;
  estimated_remaining_seconds?: number;
  formatted_remaining_time?: string;
}

interface ProcessingStatusProps {
  status: JobStatus;
  errorMessage?: string;
  progress?: ProgressInfo | null;
  downloadUrl?: string;
  onStartOver?: () => void;
}

const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ 
  status, 
  errorMessage, 
  progress,
  downloadUrl,
  onStartOver
}) => {
  const [progressValue, setProgressValue] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const lastStepChangeTime = useRef<number>(0);
  const MIN_STEP_DURATION_MS = 2000; // Minimum 2 seconds per step
  
  const processingSteps = [
    { icon: <FaVideo className="step-color-1" />, title: 'Analyzing video', description: 'Examining content and structure' },
    { icon: <FaRobot className="step-color-2" />, title: 'AI processing', description: 'Applying intelligent editing algorithms' },
    { icon: <FaMagic className="step-color-3" />, title: 'Editing content', description: 'Optimizing for viewer engagement' },
    { icon: <FaDownload className="step-color-4" />, title: 'Finalizing', description: 'Preparing your edited video' }
  ];
  
  // Helper function to safely update the current step with minimum duration
  const updateStepWithMinDuration = useCallback((newStep: number) => {
    const now = Date.now();
    const timeSinceLastChange = now - lastStepChangeTime.current;
    
    // Only advance to next step if minimum duration has passed
    if (newStep > currentStep) {
      if (timeSinceLastChange >= MIN_STEP_DURATION_MS) {
        // Only advance one step at a time
        const nextStep = currentStep + 1 > 3 ? 3 : currentStep + 1;
        setCurrentStep(nextStep);
        lastStepChangeTime.current = now;
      }
    } else if (newStep < currentStep) {
      // Allow going backwards immediately (rare case)
      setCurrentStep(newStep);
      lastStepChangeTime.current = now;
    }
  }, [currentStep, MIN_STEP_DURATION_MS]);
  
  // Helper function to map backend progress to frontend steps
  const mapProgressToStep = useCallback((percent: number, currentBackendStep?: number, totalBackendSteps?: number) => {
    // If we have backend step information, use it as the primary factor
    if (currentBackendStep !== undefined && totalBackendSteps !== undefined && totalBackendSteps > 0) {
      // Map the 5 backend steps to our 4 UI steps
      // Step 1: Extracting audio -> UI Step 0 (Analyzing video)
      // Step 2: Detecting speech -> UI Step 0 (Analyzing video)
      // Step 3: Transcribing -> UI Step 1 (AI processing)
      // Step 4: Processing segments -> UI Step 2 (Editing content)
      // Step 5: Creating final video -> UI Step 3 (Finalizing)
      
      if (currentBackendStep >= 5) return 3; // Finalizing
      if (currentBackendStep >= 4) return 2; // Editing content
      if (currentBackendStep >= 3) return 1; // AI processing
      return 0; // Analyzing video
    }
    
    // Fallback to percentage-based mapping if backend step info is not available
    if (percent >= 80) return 3; // Finalizing
    if (percent >= 50) return 2; // Editing content
    if (percent >= 20) return 1; // AI processing
    return 0; // Analyzing video
  }, []);
  
  useEffect(() => {
    let progressChangeTimeout: NodeJS.Timeout | null = null;
    
    // Initialize lastStepChangeTime on first render
    if (lastStepChangeTime.current === 0) {
      lastStepChangeTime.current = Date.now();
    }
    
    // For completed status
    if (status === 'completed') {
      setProgressValue(100);
      setCurrentStep(processingSteps.length - 1);
      return;
    }
    
    // For 'queued' or 'failed', reset progress
    if (status === 'queued' || status === 'failed') {
      setProgressValue(0);
      setCurrentStep(0);
      lastStepChangeTime.current = Date.now();
      return;
    }
    
    // If we have server-provided progress info, use it
    if (progress && status === 'processing') {
      // Use a longer timeout to throttle updates and prevent UI shakiness
      progressChangeTimeout = setTimeout(() => {
        // Only update if significantly different (to reduce unnecessary re-renders)
        if (Math.abs(progressValue - progress.percent) > 1) {
          setProgressValue(progress.percent);
        }
        
        // Use our mapping function to determine the appropriate step
        const newStep = mapProgressToStep(
          progress.percent, 
          progress.current_step, 
          progress.total_steps
        );
        
        // Use our helper function to update the step with minimum duration
        updateStepWithMinDuration(newStep);
      }, 200); // 200ms throttle to smooth UI updates
      
      return () => {
        if (progressChangeTimeout) clearTimeout(progressChangeTimeout);
      };
    }
    
    // Fallback to simulated progress if no server progress data
    // Initialize progress to 10% if it's at 0
    if (progressValue === 0 && status === 'processing') {
      setProgressValue(10);
      return;
    }
    
    // Simulate progress for better visual feedback
    if (status === 'processing') {
      const interval = setInterval(() => {
        setProgressValue(prev => {
          if (prev >= 95) {
            clearInterval(interval);
            return prev;
          }
          
          // More natural increment as progress value increases
          let increment;
          if (prev < 30) increment = 0.5;
          else if (prev < 60) increment = 0.3;
          else increment = 0.1;
          
          // Calculate new value
          const newValue = prev + increment;
          
          // Use our mapping function for simulated progress
          const newStep = mapProgressToStep(newValue);
          
          // Use our helper function to update the step with minimum duration
          updateStepWithMinDuration(newStep);
          
          return newValue;
        });
      }, 1000); // Slow down to 1 second interval for smoother animation
      
      return () => clearInterval(interval);
    }
  }, [status, progress, progressValue, currentStep, processingSteps.length, updateStepWithMinDuration, mapProgressToStep]);
  
  const getStatusIcon = () => {
    switch (status) {
      case 'queued':
        return <FaClock className="status-icon queued-icon" />;
      case 'processing':
        return <FaSpinner className="status-icon processing-icon spin-animation" />;
      case 'completed':
        return <FaCheckCircle className="status-icon completed-icon" />;
      case 'failed':
        return <FaExclamationTriangle className="status-icon failed-icon" />;
      default:
        return null;
    }
  };
  
  const getStatusMessage = () => {
    switch (status) {
      case 'queued':
        return <div className="status-message visible-status-message">Your video is in the queue...</div>;
      case 'processing':
        return (
          <div className="status-message visible-status-message">
            {progress?.message ? progress.message : 'Processing your video...'}
            {progress?.formatted_remaining_time && (
              <div className="time-remaining visible-time-remaining">
                <FaClock className="time-icon" />
                <span>Estimated time remaining: {progress.formatted_remaining_time}</span>
              </div>
            )}
          </div>
        );
      case 'completed':
        return <div className="status-message visible-status-message">Your video is ready to download</div>;
      case 'failed':
        return <div className="status-message visible-status-message">Processing failed: {errorMessage}</div>;
      default:
        return null;
    }
  };
  
  const renderSteps = () => {
    return (
      <div className="processing-steps">
        {processingSteps.map((step, index) => {
          // Determine step status: active = current step, completed = past step
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          
          return (
            <div 
              key={index}
              className={`processing-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            >
              <div 
                className={`step-icon ${isActive || isCompleted ? `step-color-${index + 1}-bg` : ''}`}
              >
                {step.icon}
              </div>
              <div className="step-content">
                <div className="step-title visible-step-title">
                  {step.title}
                </div>
                <div className="step-description visible-step-description">
                  {step.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  
  // Handle download click
  const handleDownload = () => {
    if (downloadUrl) {
      window.location.href = downloadUrl;
    }
  };

  // Handle preview click
  const handlePreview = (e: React.MouseEvent) => {
    e.preventDefault();
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  // Handle share link click
  const handleShareLink = () => {
    if (downloadUrl) {
      navigator.clipboard.writeText(downloadUrl);
      alert('Download link copied to clipboard!');
    }
  };

  return (
    <div className={`status-card glass-card ${status === 'processing' ? 'status-processing' : 
                                           status === 'completed' ? 'status-completed' : 
                                           status === 'failed' ? 'status-failed' : 
                                           'status-queued'}`}>
      <div className="card-header">
        <div className="d-flex align-items-center">
          <div className="status-icon-container">
            {getStatusIcon()}
          </div>
          <h3 className={`status-title ${status === 'processing' ? 'status-title-processing' : 
                                      status === 'completed' ? 'status-title-completed' : 
                                      status === 'failed' ? 'status-title-failed' : 
                                      'status-title-queued'}`}>
            {status === 'queued' && 'Waiting in Queue'}
            {status === 'processing' && 'Processing Video'}
            {status === 'completed' && 'Processing Complete'}
            {status === 'failed' && 'Processing Failed'}
          </h3>
        </div>
      </div>
      
      <div className="card-body">
        {/* Status message section */}
        <div className="status-message-container">
          {getStatusMessage()}
        </div>
        
        {/* Progress bar section - only show during processing */}
        {status === 'processing' && (
          <div className="status-progress-wrapper">
            <ProgressBar 
              now={progressValue} 
              className={`status-progress status-progress-bar-processing`} 
              label={`${Math.round(progressValue)}%`}
            />
          </div>
        )}
        
        {/* Processing steps section - Only show during processing */}
        {status === 'processing' && (
          <div className="steps-container">
            {renderSteps()}
          </div>
        )}
        
        {/* Completed success section */}
        {status === 'completed' && (
          <div className="completed-container text-center mt-4">
            <div className="action-buttons">
              <button 
                className="btn btn-primary btn-lg download-button"
                onClick={handleDownload}
              >
                <FaDownload className="button-icon me-2" /> Download Edited Video
              </button>
              <div className="secondary-actions mt-3">
                <button 
                  className="btn btn-outline-secondary me-3"
                  onClick={handlePreview}
                >
                  <FaPlay className="button-icon me-1" /> Preview
                </button>
                <button 
                  className="btn btn-outline-secondary"
                  onClick={handleShareLink}
                >
                  <FaShareAlt className="button-icon me-1" /> Share Link
                </button>
              </div>
              <div className="mt-4">
                <button 
                  className="btn btn-link start-over-button"
                  onClick={onStartOver}
                >
                  Start Over
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Error details section */}
        {status === 'failed' && errorMessage && (
          <div className="error-details">
            <h4>Error Details:</h4>
            <div className="error-message">{errorMessage}</div>
          </div>
        )}
        
        {/* Start over button for failed status */}
        {status === 'failed' && (
          <div className="text-center mt-4">
            <button 
              className="btn btn-outline-primary"
              onClick={onStartOver}
            >
              Start Over
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProcessingStatus; 