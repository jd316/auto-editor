import React from 'react';
import { Row, Col } from 'react-bootstrap';
import { FaRobot, FaMicrophone, FaFileAlt, FaClock, FaVideo, FaMagic } from 'react-icons/fa';

const FeaturesSection: React.FC = () => {
  const features = [
    {
      icon: <FaRobot />,
      title: 'AI-Powered Editing',
      description: 'Intelligent video editing using advanced language models'
    },
    {
      icon: <FaMicrophone />,
      title: 'Speech Recognition',
      description: 'Automatic speech detection to remove silences and pauses'
    },
    {
      icon: <FaFileAlt />,
      title: 'Script Alignment',
      description: 'Align your video with a prepared script for better results'
    },
    {
      icon: <FaClock />,
      title: 'Time Saving',
      description: 'Reduce editing time from hours to minutes with automation'
    },
    {
      icon: <FaVideo />,
      title: 'Content Optimization',
      description: 'Create engaging videos optimized for social media platforms'
    },
    {
      icon: <FaMagic />,
      title: 'Smart Processing',
      description: 'Advanced algorithms that understand context and content'
    }
  ];

  return (
    <div className="features-container">
      <h3 className="features-heading">Key Features</h3>
      <Row className="g-4">
        {features.map((feature, index) => (
          <Col key={index} md={6} lg={4}>
            <div className="feature-card">
              <div className="feature-icon">
                {feature.icon}
              </div>
              <h4 className="feature-title">{feature.title}</h4>
              <p className="feature-desc">{feature.description}</p>
            </div>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default FeaturesSection; 