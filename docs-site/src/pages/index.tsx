import React from 'react';
import Layout from '@theme/Layout';

import styles from './index.module.css';

const Home: React.FC = () => {
  return (
    <Layout>
      <div className={styles.heroBanner}>
        <h1>Supercharge Your Coding with AI</h1>
        <p>The most powerful way to integrate AI into your development workflow</p>
      </div>

      <section className={styles.container}>
        <h2>Transform How You Code</h2>
        <p>AiderDesk brings the power of AI directly into your development environment, making coding faster, smarter, and more enjoyable.</p>
      </section>

      <div className={styles.container}>
        <img src="../../docs/images/screenshot.png" alt="AiderDesk Interface" width="800" />
      </div>

      <section className={styles.container}>
        <h2>Why Developers Love AiderDesk</h2>

        <div className={styles.features}>
          <div className={styles.feature}>
            <h3>AI-Powered Assistance</h3>
            <p>Generate, modify, and explain code with natural language prompts</p>
          </div>

          <div className={styles.feature}>
            <h3>Context-Aware</h3>
            <p>Understands your entire project for more relevant suggestions</p>
          </div>

          <div className={styles.feature}>
            <h3>Lightning Fast</h3>
            <p>Get AI assistance without leaving your development flow</p>
          </div>
        </div>
      </section>

      <section className={styles.container}>
        <h2>Perfect For</h2>
        <ul className={styles.textCenter}>
          <li>
            <strong>Full-stack developers</strong> looking to accelerate their workflow
          </li>
          <li>
            <strong>Teams</strong> wanting consistent, high-quality code
          </li>
          <li>
            <strong>Open source maintainers</strong> handling complex projects
          </li>
          <li>
            <strong>Learners</strong> who want to understand code better
          </li>
        </ul>
      </section>

      <section className={styles.container}>
        <h2>Get Started in Seconds</h2>
        <div className={styles.buttons}>
          <a href="https://github.com/hotovo/aider-desk/releases" className="button button--primary button--lg">
            Download Now
          </a>
        </div>
        <p>Available for Windows, macOS and Linux</p>
      </section>

      <section className={styles.container}>
        <h2>See It In Action</h2>
        <div className={styles.textCenter}>
          <a href="https://www.youtube.com/watch?v=9oyIdntCh7g">
            <img src="https://img.youtube.com/vi/9oyIdntCh7g/0.jpg" alt="AiderDesk Demo" width="600" />
          </a>
        </div>
      </section>

      <section className={styles.container}>
        <h2>Connect With Us</h2>
        <p>Have questions or feedback? Join our growing community!</p>
        <div className={styles.textCenter}>
          <a href="https://github.com/hotovo/aider-desk/discussions">GitHub Discussions</a>
        </div>
      </section>
    </Layout>
  );
};

export default Home;
