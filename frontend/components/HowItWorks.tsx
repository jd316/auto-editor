import React from 'react';
import { Row, Col } from 'react-bootstrap';
import { FaUpload, FaEdit, FaCog, FaDownload, FaArrowRight } from 'react-icons/fa';

const HowItWorks: React.FC = () => {
  const steps = [
    {
      icon: <FaUpload className="step-icon-inner" />,
      title: 'Upload Video',
      description: 'Upload your footage to our platform',
      colorClass: 'step-color-1'
    },
    {
      icon: <FaEdit className="step-icon-inner" />,
      title: 'Add Script',
      description: 'Input script or let AI generate one',
      colorClass: 'step-color-2'
    },
    {
      icon: <FaCog className="step-icon-inner" />,
      title: 'AI Processing',
      description: 'Our AI edits your video automatically',
      colorClass: 'step-color-3'
    },
    {
      icon: <FaDownload className="step-icon-inner" />,
      title: 'Download Result',
      description: 'Get your professionally edited video',
      colorClass: 'step-color-4'
    }
  ];

  return (
    <div className="how-it-works-container">
      <div className="text-center">
        <h3 className="how-it-works-heading">How It Works</h3>
      </div>
      <p className="section-subtitle text-center mb-4">Complete your video editing in four simple steps</p>
      
      <div className="step-flow-container">
        <Row className="g-4 position-relative">
          {/* Desktop arrows overlaid between cards */}
          <div className="step-arrows d-none d-lg-flex">
            {[0, 1, 2].map(index => (
              <div 
                key={index} 
                className={`step-arrow-container arrow-position-${index}`}
              >
                <FaArrowRight className={`step-arrow-icon ${steps[index].colorClass}`} />
              </div>
            ))}
          </div>
          
          {steps.map((step, index) => (
            <Col key={index} xs={12} md={6} lg={3} className="mb-4 mb-lg-0">
              <div className="step-card">
                <div className={`step-number ${step.colorClass}-bg`}>{index + 1}</div>
                <div className={`step-icon ${step.colorClass}`}>
                  {step.icon}
                </div>
                <h4 className="step-title">{step.title}</h4>
                <p className="step-desc">{step.description}</p>
                
                {/* Mobile only arrows after each card except the last */}
                {index < steps.length - 1 && (
                  <div className="d-block d-lg-none text-center mt-3">
                    <FaArrowRight className={`mobile-step-arrow ${step.colorClass}`} />
                  </div>
                )}
              </div>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
};

export default HowItWorks; 