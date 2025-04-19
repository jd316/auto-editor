'use client';

import { Inter, Poppins } from 'next/font/google'
import 'bootstrap/dist/css/bootstrap.css'
import '../styles/main.css'
import React, { useState, useEffect, useRef } from 'react'
import { AuthProvider, useAuth } from '../context/AuthContext'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBars,
  faTimes,
  faHome,
  faUpload,
  faCog,
  faQuestionCircle,
  faSignOutAlt,
  faUser
} from '@fortawesome/free-solid-svg-icons'
import { Button, Spinner } from 'react-bootstrap'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
})

const poppins = Poppins({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap'
})

// Metadata needs to be in a separate file for client components
const metadata = {
  title: 'Auto Video Editor',
  description: 'AI-powered video editing tool',
}

// Navbar component with active state handling and scroll behavior
const Navbar = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const [activeSection, setActiveSection] = useState('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const navbarRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const lastScrollY = React.useRef(0);
  
  // Debounce function to limit scroll event execution frequency
  const debounce = <F extends (...args: unknown[]) => unknown>(func: F, wait: number): ((...args: Parameters<F>) => void) => {
    let timeout: NodeJS.Timeout | null = null;
    return function executedFunction(...args: Parameters<F>): void {
      const later = () => {
        if (timeout) clearTimeout(timeout);
        func(...args);
      };
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };
  
  // Handle scroll to update active section with debounce
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      
      // For active section detection
      const sections = ['upload', 'how-it-works', 'features'];
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element && scrollPosition + 200 >= element.offsetTop) {
          const sectionId = section === 'how-it-works' ? 'howItWorks' : section;
          // Only update if changed to prevent unnecessary re-renders
          if (sectionId !== activeSection) {
            setActiveSection(sectionId);
          }
          break;
        }
      }
      
      // Update last scroll position (kept for potential future use)
      lastScrollY.current = scrollPosition;
    };
    
    // Create debounced version of scroll handler (30ms)
    const debouncedHandleScroll = debounce(handleScroll, 30);
    
    // Add scroll event listener
    window.addEventListener('scroll', debouncedHandleScroll);
    
    // Initialize active section
    handleScroll();
    
    // Clean up
    return () => window.removeEventListener('scroll', debouncedHandleScroll);
  }, [activeSection]);
  
  // Update mobile menu ARIA attributes
  useEffect(() => {
    // Update ARIA attributes directly
    const toggle = document.getElementById('nav-toggle');
    const menu = document.getElementById('mobile-menu');
    
    if (toggle && menu) {
      toggle.setAttribute('aria-expanded', isMobileMenuOpen ? 'true' : 'false');
      
      // Update tabindex on mobile menu links
      const menuLinks = menu.querySelectorAll('a');
      menuLinks.forEach(link => {
        link.setAttribute('tabindex', isMobileMenuOpen ? '0' : '-1');
      });
    }
  }, [isMobileMenuOpen]);
  
  // Make first link tabindex reachable when page loads
  useEffect(() => {
    // Ensure the first nav link is reachable via keyboard
    const firstNavLink = document.querySelector('.nav-links a');
    if (firstNavLink) {
      firstNavLink.setAttribute('tabindex', '0');
    }
  }, []);
  
  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };
  
  // Handle link click for smooth scrolling
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    
    // Convert section ID to match DOM ID
    const domId = sectionId === 'howItWorks' ? 'how-it-works' : sectionId;
    
    // Find the section element
    const section = document.getElementById(domId);
    if (section) {
      // Update active section immediately for better UX
      setActiveSection(sectionId);
      
      // Close mobile menu if open - do this first to prevent jarring transitions
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
      
      // Add a small delay before scrolling for better visual feedback
      setTimeout(() => {
        // Get the header height for accurate scrolling
        const headerElement = document.querySelector('.app-header');
        const headerHeight = headerElement ? headerElement.getBoundingClientRect().height : 0;
        
        // Calculate scroll position accounting for header height
        const scrollTop = section.offsetTop - headerHeight;
        
        // Smooth scroll to section
        window.scrollTo({
          top: scrollTop,
          behavior: 'smooth'
        });
      }, 50);
    }
  };
  
  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLAnchorElement>, sectionId: string) => {
    // Handle Enter or Space key
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      
      // Convert section ID to match DOM ID
      const domId = sectionId === 'howItWorks' ? 'how-it-works' : sectionId;
      
      // Find the section element
      const section = document.getElementById(domId);
      if (section) {
        // Update active section immediately for better UX
        setActiveSection(sectionId);
        
        // Close mobile menu if open - do this first to prevent jarring transitions
        if (isMobileMenuOpen) {
          setIsMobileMenuOpen(false);
        }
        
        // Add a small delay before scrolling for better visual feedback
        setTimeout(() => {
          // Get the header height for accurate scrolling
          const headerElement = document.querySelector('.app-header');
          const headerHeight = headerElement ? headerElement.getBoundingClientRect().height : 0;
          
          // Calculate scroll position accounting for header height
          const scrollTop = section.offsetTop - headerHeight;
          
          // Smooth scroll to section
          window.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
          });
        }, 50);
      }
    }
  };
  
  // Handle mobile menu toggle with keyboard
  const handleToggleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleMobileMenu();
    }
  };
  
  // Sign Out Handler
  const handleSignOut = async () => {
    try {
      await signOut();
      // Optional: Add redirect or UI feedback after sign out
      // router.push('/'); // Example redirect
    } catch (error) {
      console.error("Error signing out:", error);
      // Handle sign out error (e.g., show a message)
    }
  };
  
  return (
    <header className={`app-header ${isScrolled ? 'scrolled' : ''}`} ref={navbarRef}>
      <div className="header-container">
        {/* Left Section - Logo */}
        <div className="header-section header-left">
          <Link href="/" passHref legacyBehavior>
            <a className="logo-link" onClick={(e) => handleLinkClick(e, 'home')} onKeyDown={(e) => handleKeyDown(e, 'home')} tabIndex={0}>
              <span className="logo-text">Auto<span className="highlight">Editor</span></span>
            </a>
          </Link>
        </div>
        
        {/* Center Section - Navigation */}
        <div className="header-section header-center d-none d-md-flex">
          <nav aria-label="Main Navigation">
            <ul className="nav-links">
              {user && (
                <li>
                  <a 
                    href="#upload" 
                    className={activeSection === 'upload' ? 'active' : ''}
                    onClick={(e) => handleLinkClick(e, 'upload')}
                    onKeyDown={(e) => handleKeyDown(e, 'upload')}
                    tabIndex={0}
                  >
                    Upload
                  </a>
                </li>
              )}
              <li>
                <a 
                  href="#features" 
                  className={activeSection === 'features' ? 'active' : ''}
                  onClick={(e) => handleLinkClick(e, 'features')}
                  onKeyDown={(e) => handleKeyDown(e, 'features')}
                  tabIndex={0}
                >
                  Features
                </a>
              </li>
              <li>
                <a 
                  href="#how-it-works" 
                  className={activeSection === 'howItWorks' ? 'active' : ''}
                  onClick={(e) => handleLinkClick(e, 'howItWorks')}
                  onKeyDown={(e) => handleKeyDown(e, 'howItWorks')}
                  tabIndex={0}
                >
                  How It Works
                </a>
              </li>
            </ul>
          </nav>
        </div>
        
        {/* Right Section - Action Buttons */}
        <div className="header-section header-right">
          {/* Conditional rendering based on auth state */}
          {authLoading ? (
            <Spinner animation="border" size="sm" variant="light" />
          ) : user ? (
            <>
              <span className="user-email d-none d-lg-inline me-3 text-light">
                <FontAwesomeIcon icon={faUser} className="me-1" /> {user.email}
              </span>
              <Button
                variant="outline-light"
                size="sm"
                onClick={handleSignOut}
                className="header-btn sign-out-btn"
              >
                <FontAwesomeIcon icon={faSignOutAlt} className="me-1 d-none d-sm-inline" /> Sign Out
              </Button>
            </>
          ) : (
            <a
              href="#auth-form-section"
              className="header-btn me-2"
              onClick={(e) => { e.preventDefault(); const authForm = document.getElementById('auth-form-section'); if(authForm) authForm.scrollIntoView({behavior: 'smooth'}); }}
              tabIndex={0}
            >
              Sign In
            </a>
          )}
          
          {/* Mobile Navigation Toggle */}
          <div className="mobile-nav-toggle d-md-none">
            <input 
              type="checkbox" 
              id="nav-toggle" 
              className="nav-toggle-input" 
              aria-label="Toggle navigation menu"
              aria-controls="mobile-menu"
              checked={isMobileMenuOpen}
              onChange={toggleMobileMenu}
              onKeyDown={handleToggleKeyDown}
            />
            <label 
              htmlFor="nav-toggle" 
              className="nav-toggle-label"
            >
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </label>
            
            {/* Mobile Menu */}
            <div 
              className={`mobile-menu ${isMobileMenuOpen ? 'open' : ''}`}
              id="mobile-menu"
              aria-label="Mobile Navigation"
            >
              <ul className="mobile-nav-links">
                {user && (
                  <li>
                    <a 
                      href="#upload" 
                      className={activeSection === 'upload' ? 'active' : ''}
                      onClick={(e) => handleLinkClick(e, 'upload')}
                      onKeyDown={(e) => handleKeyDown(e, 'upload')}
                    >
                      Upload
                    </a>
                  </li>
                )}
                <li>
                  <a 
                    href="#features" 
                    className={activeSection === 'features' ? 'active' : ''}
                    onClick={(e) => handleLinkClick(e, 'features')}
                    onKeyDown={(e) => handleKeyDown(e, 'features')}
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a 
                    href="#how-it-works" 
                    className={activeSection === 'howItWorks' ? 'active' : ''}
                    onClick={(e) => handleLinkClick(e, 'howItWorks')}
                    onKeyDown={(e) => handleKeyDown(e, 'howItWorks')}
                  >
                    How It Works
                  </a>
                </li>
                <li className="mt-4">
                  {authLoading ? (
                    <Spinner animation="border" size="sm" variant="light" />
                  ) : user ? (
                    <Button
                      variant="light"
                      onClick={handleSignOut}
                      className="mobile-cta sign-out-btn"
                    >
                      <FontAwesomeIcon icon={faSignOutAlt} className="me-2" /> Sign Out ({user.email?.split('@')[0]})
                    </Button>
                  ) : (
                    <a
                      href="#auth-form-section"
                      className="mobile-cta"
                      onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); const authForm = document.getElementById('auth-form-section'); if(authForm) authForm.scrollIntoView({behavior: 'smooth'}); }}
                    >
                      Sign In / Sign Up
                    </a>
                  )}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${inter.variable} ${poppins.variable} ${inter.className}`}>
        <AuthProvider>
          <Navbar />
          <main>
            <div className="container-fluid container-lg py-2 px-3">
              {children}
            </div>
          </main>
        </AuthProvider>
      </body>
    </html>
  )
} 