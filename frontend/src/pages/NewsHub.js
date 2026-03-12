import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { newsPosts } from '../data/newsPosts';
import './News.css';

const NewsHub = () => {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'NounPaddi Updates',
    description: 'Public NOUN-related updates and platform news from NounPaddi.',
    url: 'https://paddi.com.ng/news',
    blogPost: newsPosts.map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      datePublished: post.publishedAt,
      url: `https://paddi.com.ng/news/${post.slug}`,
    })),
  };

  return (
    <div className="news-page">
      <SEO
        title="NOUN News and Updates | NounPaddi"
        description="Read NOUN-related study updates, platform announcements, and public learning updates from NounPaddi."
        url="/news"
        keywords="NOUN news, NOUN updates, NounPaddi updates, NOUN student news"
        structuredData={structuredData}
      />
      <div className="container">
        <section className="news-hero">
          <p className="news-kicker">Public Updates</p>
          <h1>NOUN study updates and NounPaddi platform news</h1>
          <p>
            This public section gives Google and students a crawlable updates hub around NOUN learning support,
            practice access, summaries, and platform changes.
          </p>
        </section>

        <section className="news-grid">
          {newsPosts.map((post) => (
            <article key={post.slug} className="news-card">
              <div className="news-card-meta">
                <span className="news-card-category">{post.category}</span>
                <span>{post.publishedAt}</span>
              </div>
              <h2>{post.title}</h2>
              <p>{post.excerpt}</p>
              <Link to={`/news/${post.slug}`}>Read update</Link>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
};

export default NewsHub;
