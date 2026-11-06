import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import Layout from '@theme/Layout';
import { HeroSection } from '../components/HeroSection';
import { ShowcaseTabs } from '../components/ShowcaseTabs';
import { PrimitivesSection } from '../components/PrimitivesSection';
import { CodeShowcaseSection } from '../components/CodeShowcaseSection';
import { ComparisonSection } from '../components/ComparisonSection';
import { ProvidersSection } from '../components/ProvidersSection';
import { DownloadSection } from '../components/DownloadSection';
import { FaqSection } from '../components/FaqSection';
import { CtaSection } from '../components/CtaSection';
import styles from './index.module.css';

const Home = () => {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Layout>
      <div className={styles.pageWrapper}>
        <HeroSection />

        <div className={styles.showcaseContainer}>
          <ShowcaseTabs />
        </div>

        <div className={styles.sectionDivider} />
        <PrimitivesSection />

        <div className={styles.sectionDivider} />
        <CodeShowcaseSection />

        <div className={styles.sectionDivider} />
        <ComparisonSection />

        <div className={styles.sectionDivider} />
        <ProvidersSection />

        <div className={styles.sectionDivider} />
        <DownloadSection />

        <div className={styles.sectionDivider} />
        <FaqSection />

        <div className={styles.sectionDivider} />
        <CtaSection />

        <button
          type="button"
          className={clsx(styles.scrollToTop, showScrollTop && styles.scrollToTopVisible)}
          onClick={handleScrollToTop}
          aria-label="Scroll to top"
        >
          ↑
        </button>
      </div>
    </Layout>
  );
};

export default Home;
