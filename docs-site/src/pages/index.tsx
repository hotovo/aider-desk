import React, { useEffect } from 'react';
import Layout from '@theme/Layout';

import styles from './index.module.css';

const Home = () => {
  useEffect(() => {
    // Add intersection observer for scroll animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = entry.target as HTMLElement;
          target.style.opacity = '1';
          target.style.transform = 'translateY(0)';
        }
      });
    }, observerOptions);

    // Observe all sections
    const sections = document.querySelectorAll('section');
    sections.forEach((section) => {
      const htmlSection = section as HTMLElement;
      htmlSection.style.opacity = '0';
      htmlSection.style.transform = 'translateY(30px)';
      htmlSection.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
      observer.observe(section);
    });

    // Scroll to top button visibility
    const scrollToTopButton = document.querySelector(`.${styles.scrollToTop}`);
    if (scrollToTopButton) {
      const toggleScrollToTopButton = () => {
        if (window.scrollY > 300) {
          scrollToTopButton.classList.add('visible');
        } else {
          scrollToTopButton.classList.remove('visible');
        }
      };

      window.addEventListener('scroll', toggleScrollToTopButton);
      toggleScrollToTopButton(); // Initial check

      return () => {
        window.removeEventListener('scroll', toggleScrollToTopButton);
        sections.forEach((section) => observer.unobserve(section));
      };
    }

    return () => {
      sections.forEach((section) => observer.unobserve(section));
    };
  }, []);

  return (
    <Layout>
      <div className={styles.heroBanner}>
        <div className={styles.heroContent}>
          <div className={styles.heroMain}>
            <div className={styles.heroContentCentered}>
              <div className={styles.brandSection}>
                <img src="img/icon.png" alt="AiderDesk Logo" className={styles.heroIcon} />
                <h1 className={styles.brandTitle}>AiderDesk</h1>
              </div>
              <div className={styles.heroText}>
                <h2 className={styles.heroTagline}>Supercharge Your Coding with AI</h2>
                <p className={styles.heroSubtitle}>The smart way to integrate AI into your development workflow</p>
                <div className={styles.floatingCard}>
                  <div className={styles.cardContent}>
                    <div className={styles.codeBlock}>
                      <div className={styles.codeHeader}>
                        <div className={styles.codeDots}>
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                      <div className={styles.codeBody}>
                        {/* eslint-disable-next-line react/jsx-no-comment-textnodes */}
                        <span className={styles.codeComment}>// AI-powered coding</span>
                        <br />
                        <span className={styles.codeKeyword}>const</span> <span className={styles.codeVariable}>result</span> ={' '}
                        <span className={styles.codeFunction}>generateCode</span>();
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.heroCTA}>
              <a
                href="https://github.com/hotovo/aider-desk/releases"
                className={`button button--primary button--lg ${styles.primaryButton}`}
                onClick={(e) => {
                  e.currentTarget.style.transform = 'scale(0.95)';
                  setTimeout(() => {
                    e.currentTarget.style.transform = '';
                  }, 150);
                }}
              >
                Download Now
              </a>
              <a
                href="docs"
                className={`button button--lg ${styles.secondaryButton}`}
                onClick={(e) => {
                  e.currentTarget.style.transform = 'scale(0.95)';
                  setTimeout(() => {
                    e.currentTarget.style.transform = '';
                  }, 150);
                }}
              >
                Documentation
              </a>
            </div>
          </div>
        </div>
      </div>

      <section className={styles.transformSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Transform How You Code</h2>
          <p className={styles.sectionSubtitle}>
            AiderDesk brings the power of AI directly into your development environment, making coding faster, smarter, and more enjoyable.
          </p>
        </div>
      </section>

      <section className={styles.screenshotSection}>
        <div className={styles.container}>
          <div className={styles.screenshotWrapper}>
            <img src="img/screenshot.png" alt="AiderDesk Interface" className={styles.screenshot} />
          </div>
        </div>
      </section>

      <section className={styles.downloadSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Get Started in Seconds</h2>
          <div className={styles.downloadButtons}>
            <a
              href="https://github.com/hotovo/aider-desk/releases"
              className={`button button--primary button--lg ${styles.primaryButton}`}
              onClick={(e) => {
                e.currentTarget.style.transform = 'scale(0.95)';
                setTimeout(() => {
                  e.currentTarget.style.transform = '';
                }, 150);
              }}
            >
              Download Now
            </a>
            <a
              href="docs"
              className={`button button--lg ${styles.secondaryButton}`}
              onClick={(e) => {
                e.currentTarget.style.transform = 'scale(0.95)';
                setTimeout(() => {
                  e.currentTarget.style.transform = '';
                }, 150);
              }}
            >
              Documentation
            </a>
          </div>
          <p className={styles.platformNote}>Available for Windows, macOS and Linux</p>
        </div>
      </section>

      <section className={styles.featuresSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Why Developers Love AiderDesk</h2>
          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🤖</div>
              <h3>AI-Powered Assistance</h3>
              <p>Generate, modify, and explain code with natural language prompts</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🧠</div>
              <h3>Context-Aware</h3>
              <p>Understands your entire project for more relevant suggestions</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>⚡</div>
              <h3>Lightning Fast</h3>
              <p>Get AI assistance without leaving your development flow</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.audienceSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Perfect For</h2>
          <div className={styles.audienceGrid}>
            <div className={styles.audienceCard}>
              <div className={styles.audienceIcon}>👨‍💻</div>
              <div className={styles.audienceContent}>
                <strong>Full-stack developers</strong>
                <span>looking to accelerate their workflow</span>
              </div>
            </div>
            <div className={styles.audienceCard}>
              <div className={styles.audienceIcon}>👥</div>
              <div className={styles.audienceContent}>
                <strong>Teams</strong>
                <span>wanting consistent, high-quality code</span>
              </div>
            </div>
            <div className={styles.audienceCard}>
              <div className={styles.audienceIcon}>🔧</div>
              <div className={styles.audienceContent}>
                <strong>Open source maintainers</strong>
                <span>handling complex projects</span>
              </div>
            </div>
            <div className={styles.audienceCard}>
              <div className={styles.audienceIcon}>📚</div>
              <div className={styles.audienceContent}>
                <strong>Learners</strong>
                <span>who want to understand code better</span>
              </div>
            </div>
            <div className={styles.audienceCard}>
              <div className={styles.audienceIcon}>🧠</div>
              <div className={styles.audienceContent}>
                <strong>LLM Experts</strong>
                <span>experimenting with different AI models</span>
              </div>
            </div>
            <div className={styles.audienceCard}>
              <div className={styles.audienceIcon}>💼</div>
              <div className={styles.audienceContent}>
                <strong>Freelancers</strong>
                <span>staying competitive with AI assistance</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.demoSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>See It In Action</h2>
          <div className={styles.videoWrapper}>
            <a href="https://www.youtube.com/watch?v=9oyIdntCh7g" className={styles.videoLink}>
              <div className={styles.videoThumbnail}>
                <img src="https://img.youtube.com/vi/9oyIdntCh7g/0.jpg" alt="AiderDesk Demo" />
                <div className={styles.playButton}>
                  <div className={styles.playIcon}>▶</div>
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>

      <section className={styles.communitySection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Connect With Us</h2>
          <p className={styles.sectionSubtitle}>Have questions or feedback? Join our growing community!</p>
          <div className={styles.communityLinks}>
            <a href="https://github.com/hotovo/aider-desk/discussions" className={styles.communityLink}>
              GitHub Discussions
            </a>
          </div>
        </div>
      </section>

      {/* Scroll to top button */}
      <button className={styles.scrollToTop} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Scroll to top">
        ↑
      </button>
    </Layout>
  );
};

export default Home;
