import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({
  title = 'NounPaddi Community for NOUN Students | Founded by Kingsley Udoma',
  description = 'NounPaddi is a learning and community platform for National Open University of Nigeria (NOUN) students, with course materials, summaries, practice questions, and support built by Kingsley Udoma.',
  keywords = 'NounPaddi, NOUN community, National Open University of Nigeria, NOUN students, course materials, practice questions, summaries, Kingsley Udoma',
  image = '/og-image.png',
  url = '',
  type = 'website',
  author = 'Kingsley Udoma',
  robots = 'index, follow',
  structuredData = null,
}) => {
  const siteUrl = process.env.REACT_APP_SITE_URL || 'https://paddi.com.ng';
  const fullUrl = url
    ? (url.startsWith('http') ? url : `${siteUrl}${url}`)
    : siteUrl;
  const imageUrl = image.startsWith('http') ? image : `${siteUrl}${image}`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:site_name" content="NounPaddi" />
      <meta property="og:locale" content="en_NG" />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={fullUrl} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={imageUrl} />

      {/* Additional Meta Tags */}
      <meta name="robots" content={robots} />
      <meta name="language" content="English" />
      <meta name="revisit-after" content="7 days" />
      <meta name="theme-color" content="#667eea" />

      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
