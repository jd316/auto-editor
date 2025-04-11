'use client';

// Suppress the util._extend deprecation warning
process.removeAllListeners('warning');

import React, { useState, useEffect, useRef } from 'react';
import { Card, Spinner, Button } from 'react-bootstrap';
import axios from 'axios';
import UploadForm from '../components/UploadForm';
import ProcessingStatus, { JobStatus } from '../components/ProcessingStatus';
import FeaturesSection from '../components/FeaturesSection';
import HowItWorks from '../components/HowItWorks';
import { useAuth } from '../context/AuthContext';
import AuthForm from '../components/AuthForm';

// Define the progress info interface
interface ProgressInfo {
  percent: number;
  current_step: number;
  total_steps: number;
  message: string;
  estimated_remaining_seconds?: number;
  formatted_remaining_time?: string;
}

export default function Home(): React.ReactElement {
  const { session, loading } = useAuth();
  const [jobStatus, setJobStatus] = useState<JobStatus>('queued');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [progressInfo, setProgressInfo] = useState<ProgressInfo | null>(null);
  
  // Ref to store the polling cancellation function
  const pollingCancelRef = useRef<(() => void) | null>(null);
  
  // Refs for sections (used for accessibility and focus management)
  const sectionRefs = {
    upload: useRef<HTMLElement>(null),
    howItWorks: useRef<HTMLElement>(null),
    features: useRef<HTMLElement>(null)
  };

  // Add scroll event listener for header scroll effect only
  useEffect(() => {
    const handleScroll = () => {
      // Handle header scroll effect
      const isScrolled = window.scrollY > 50;
      
      // Apply class to header based on scroll position
      const header = document.querySelector('.app-header');
      if (header) {
        if (isScrolled) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
      }
    };

    // Create debounced version of the scroll handler
    const debouncedHandleScroll = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => handleScroll(), 50);
    };
    
    let timeout: NodeJS.Timeout | null = null;
    window.addEventListener('scroll', debouncedHandleScroll);
    
    // Initial call to set correct values
    handleScroll();
    
    return () => window.removeEventListener('scroll', debouncedHandleScroll);
  }, []);
  
  // For testing/debugging - simulate a completed job
  const simulateCompletedJob = () => {
    setJobStatus('completed');
    setDownloadUrl('/api/download/test-job-id');
    setShowForm(false);
    setDebugInfo('Using simulated completed job for testing');
  };

  const handleUploadStart = async (formData: FormData): Promise<void> => {
    try {
      // Cancel any existing polling
      if (pollingCancelRef.current) {
        pollingCancelRef.current();
        pollingCancelRef.current = null;
      }
      
      setShowForm(false);
      setJobStatus('queued');
      setDebugInfo(null);
      setProgressInfo(null);
      
      // Log the form data for debugging
      console.log('Form data keys:', Array.from(formData.keys()));
      
      const response = await axios.post('/api/upload', formData);
      const data = response.data;
      
      console.log('Upload response:', data);
      setDebugInfo(`Job ID: ${data.job_id}, Status: ${data.status}`);
      
      // Initialize progress info with estimate from server
      if (data.estimated_seconds) {
        setProgressInfo({
          percent: 0,
          current_step: 0,
          total_steps: 5,
          message: 'Starting processing...',
          estimated_remaining_seconds: data.estimated_seconds,
          formatted_remaining_time: formatRemainingTime(data.estimated_seconds)
        });
      }
      
      // Store the cancellation function
      pollingCancelRef.current = startPolling(data.job_id);
    } catch (error) {
      console.error('Error uploading:', error);
      setErrorMessage('Error uploading files');
      setJobStatus('failed');
      setDebugInfo(`Upload error: ${error instanceof Error ? error.message : String(error)}`);
      throw error; // Re-throw the error so the form can handle it
    }
  };

  const formatRemainingTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    }
  };

  const startPolling = (jobId: string): (() => void) => {
    let isCancelled = false;
    
    const pollStatus = async () => {
      if (isCancelled) return;
      
      try {
        const response = await axios.get(`/api/status/${jobId}`);
        const statusData = response.data;
        
        console.log('Status update:', statusData);
        
        // Update state with the latest status
        setJobStatus(statusData.status as JobStatus);
        
        // Update progress information if available
        if (statusData.progress) {
          setProgressInfo(statusData.progress);
        }
        
        if (statusData.status === 'completed') {
          setDownloadUrl(statusData.download_url);
          // We can stop polling now
          return;
        } else if (statusData.status === 'failed') {
          setErrorMessage(statusData.error || 'Unknown error occurred');
          // We can stop polling now
          return;
        }
        
        // Continue polling if still in progress
        if (!isCancelled) {
          setTimeout(pollStatus, 2000);
        }
      } catch (error) {
        console.error('Error checking status:', error);
        if (!isCancelled) {
          // If we get an error, wait longer before retrying
          setTimeout(pollStatus, 5000);
        }
      }
    };
    
    // Start the polling process
    pollStatus();
    
    // Return a function to cancel the polling
    return () => {
      isCancelled = true;
    };
  };

  const handleStartOver = () => {
    if (pollingCancelRef.current) {
      pollingCancelRef.current();
      pollingCancelRef.current = null;
    }
    setJobStatus('queued');
    setErrorMessage(null);
    setDownloadUrl(null);
    setShowForm(true);
    setDebugInfo(null);
    setProgressInfo(null);
  };

  // For development/testing only
  useEffect(() => {
    // Uncomment the next line to simulate a completed job for testing
    // simulateCompletedJob();
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      // Cancel polling if component unmounts
      if (pollingCancelRef.current) {
        pollingCancelRef.current();
        pollingCancelRef.current = null;
      }
    };
  }, []);

  // Reset form/job state visibility when session changes
  useEffect(() => {
    if (session) {
        // Reset state when user logs in
        handleStartOver(); // Use handleStartOver to reset job state and show form
    } else {
        // Ensure form isn't shown if logged out, cancel polling
        setShowForm(false);
        if (pollingCancelRef.current) {
            pollingCancelRef.current();
            pollingCancelRef.current = null;
        }
        // Also clear any lingering job status/error/download
        setJobStatus('queued');
        setErrorMessage(null);
        setDownloadUrl(null);
        setProgressInfo(null);
        setDebugInfo(null);
    }
  }, [session]);

  if (loading) {
    // Optional: Show a loading spinner fullscreen or similar
    // For now, returning null to avoid flicker while session loads
    return (
      <div className="loading-container">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <>
      <div className="bg-animation">
        <div className="floating-element floating-element-1"></div>
        <div className="floating-element floating-element-2"></div>
        <div className="floating-element floating-element-3"></div>
        <div className="floating-element floating-element-4"></div>
      </div>
      
      <main className="single-page-layout">
        {/* Main Sections */}
        <div className="main-content">
          {/* Upload Section - Content depends on login state */}
          <section id="upload" ref={sectionRefs.upload} className="page-section upload-section">
            <div className="section-header">
              {/* Change title based on login state */}
              <h1>{session ? 'Start' : 'Sign In to Start'} <span className="highlight">Editing</span></h1>
              <p className="section-subtitle">
                {session ? 'Upload your video and let our AI do the work' : 'Sign in via Magic Link below to begin editing your videos.'}
              </p>
            </div>
            
            <Card className="shadow-lg main-card glass-card">
              <Card.Body className="p-4">
                {session ? (
                  // Logged-in view: Show Upload Form or Processing Status
                  showForm ? (
                    <UploadForm onUploadStart={handleUploadStart} />
                  ) : (
                    <>
                      {/* Show ProcessingStatus unless completed */}
                      {jobStatus !== 'completed' && (
                        <ProcessingStatus 
                          status={jobStatus} 
                          errorMessage={errorMessage || undefined}
                          progress={progressInfo} 
                        />
                      )}
                      
                      {/* Show Completed view specifically */}
                      {jobStatus === 'completed' && (
                        <ProcessingStatus 
                          status={jobStatus}
                          downloadUrl={downloadUrl || '/api/download/fallback'}
                          onStartOver={handleStartOver}
                        />
                      )}
                      
                      {/* Show Try Again button ONLY if failed */}
                      {jobStatus === 'failed' && (
                        <div className="text-center mt-3">
                          <Button variant="secondary" onClick={handleStartOver}>Try Again</Button>
                        </div>
                      )}
                    </>
                  )
                ) : (
                  // Logged-out view: Show Auth Form
                  <div id="auth-form-section">
                    <AuthForm />
                  </div>
                )}
                
                {/* Debug info - only visible in development and when logged in */}
                {process.env.NODE_ENV !== 'production' && session && (
                  <div className="debug-section">
                    {debugInfo && (
                      <div className="alert alert-info mt-3 small">
                        <small><strong>Debug:</strong> {debugInfo}</small>
                      </div>
                    )}
                  </div>
                )}
              </Card.Body>
            </Card>
          </section>
          
          {/* Features Section - Always Visible */}
          <section id="features" ref={sectionRefs.features} className="page-section features-section">
            <Card className="shadow-lg features-card glass-card">
              <Card.Body className="p-4">
                <FeaturesSection />
              </Card.Body>
            </Card>
          </section>
          
          {/* How It Works Section - Always Visible */}
          <section id="how-it-works" ref={sectionRefs.howItWorks} className="page-section how-it-works-section">
            <Card className="shadow-lg how-it-works-card glass-card">
              <Card.Body className="p-4">
                <HowItWorks />
              </Card.Body>
            </Card>
          </section>
          
          {/* Call to Action Section - Always Visible */}
          <section className="cta-section">
            <Card className="shadow-lg cta-card glass-card">
              <Card.Body className="p-5 text-center">
                <h2 className="cta-title mb-4">Ready to Transform Your Videos?</h2>
                <p className="cta-text mb-4">
                  {session ? 'Start using our AI-powered video editor now!' : 'Sign in to start using our AI-powered video editor today and save hours of editing time.'}
                </p>
                <button 
                  onClick={() => {
                    // Target depends on login state
                    const targetSectionId = session ? 'upload' : 'auth-form-section';
                    const targetSection = document.getElementById(targetSectionId);
                    if (targetSection) {
                      // Use scrollIntoView for simplicity
                      targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="btn cta-btn"
                >
                  {session ? 'Upload Video' : 'Sign In to Get Started'}
                </button>
              </Card.Body>
            </Card>
          </section>
        </div>
        
        {/* Footer - Always Visible */}
        <footer className="mt-5 pt-3 text-center">
          <div className="footer-content">
            <div className="footer-logo mb-3">
              <span className="logo-text">Auto<span className="highlight">Editor</span></span>
            </div>
            <p className="copyright">
              © {new Date().getFullYear()} Auto Video Editor. All rights reserved.
            </p>
          </div>
        </footer>
      </main>
    </>
  );
} 