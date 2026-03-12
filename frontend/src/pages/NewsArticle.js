import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import SEO from '../components/SEO';
import { newsPosts } from '../data/newsPosts';
import './News.css';

const NewsArticle = () => {
  const { slug } = useParams();
  const post = newsPosts.find((item) => item.slug === slug);

  if (!post) {
    return <Navigate to="/news" replace />;
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    articleSection: post.category,
    url: `https://paddi.com.ng/news/${post.slug}`,
    publisher: {
      '@type': 'Organization',
      name: 'NounPaddi',
      url: 'https://paddi.com.ng',
    },
    author: {
      '@type': 'Person',
      name: 'Kingsley Udoma',
    },
    description: post.excerpt,
  };

  return (
    <div className="news-page">
      <SEO
        title={`${post.title} | NounPaddi`}
        description={post.excerpt}
        url={`/news/${post.slug}`}
        keywords={`NOUN updates, ${post.category}, NounPaddi news`}
        type="article"
        structuredData={structuredData}
      />
      <div className="container">
        <article className="news-article">
          <Link to="/news" className="news-back-link">Back to updates</Link>
          <div className="news-article-meta">
            <span className="news-article-category">{post.category}</span>
            <span>{post.publishedAt}</span>
          </div>
          <h1>{post.title}</h1>
          <p>{post.excerpt}</p>
          <div className="news-article-body">
            {post.body.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
};

export default NewsArticle;
